"""Graph persistence + queries over Neo4j.

GRAPH MODEL
-----------
Nodes:
  (:Image {sha256})            one per generated image, keyed by content hash
  (:Asset {kind, key, name})   a model/resource an image USES (checkpoint, lora,
                               embedding, vae, controlnet, upscaler)
  (:Tag {name})                a normalized tag

Relationships:
  (:Image)-[:USES]->(:Asset)               image references an asset
  (:Image)-[:TAGGED]->(:Tag)               image carries a tag
  (:Image)-[:DERIVED_FROM {kind}]->(:Image) lineage edge to a PARENT image,
                               kind in {variant, upscale, inpaint}

SHARES_ASSET / tag co-occurrence are NOT materialized. "Neighbors by shared
asset" and "related tags" are computed by traversal at query time (image -> asset
-> other image; tag -> image -> other tag). This keeps upserts cheap and the
projection always consistent, at the cost of a slightly heavier read query.

ASSET IDENTITY / NAME NORMALIZATION
-----------------------------------
ComfyUI assets usually have no hash, so an Asset's identity key is:
  - ("h:" + lowercased hash)            when a hash is present, else
  - ("n:" + normalized name)            keyed on the normalized NAME.
Two refs of the same kind that normalize to the same name (and both lack a hash)
collapse to a single Asset node. Normalization (`normalize_name`):
  - take the basename (strip any '/' or '\\' path components),
  - drop a single trailing file extension (e.g. ".safetensors", ".ckpt", ".pt"),
  - lowercase and strip surrounding whitespace.
So "SD/Foo.safetensors", "foo.ckpt", and "  FOO  " all normalize to "foo".
The original (first-seen) name is retained on the node as `name` for display;
matching/merging is always on (kind, key).
"""
from __future__ import annotations

import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import LiteralString, cast

from neo4j import Driver, ManagedTransaction, Record, Session

from graph.db import get_database, get_driver
from graph.models import (
    AssetRef,
    EdgeUpsert,
    EdgeUpsertResult,
    LineageRef,
    Neighbor,
    PruneResult,
    RelatedTag,
)


def normalize_name(name: str) -> str:
    """Normalize an asset name for identity: basename, no extension, lowercased."""
    base = os.path.basename(name.replace("\\", "/").strip())
    root, _ext = os.path.splitext(base)
    return (root or base).strip().lower()


# Danbooru/A1111 emphasis weight (e.g. "tag:1.2") and balanced/stray emphasis
# brackets ("(tag)", "((tag))", "[tag]") carry no tag identity. Stripping them so
# "(asd)", "(asd:12)" and "asd" all collapse to the SAME Tag node. Mirrors
# deedlit.metadata.prompt_tags._clean_prompt_tag so every tag source (prompt / AI
# labeller / manual edit) agrees on the canonical tag.
_TAG_WEIGHT_RE = re.compile(r":\s*\d+(?:\.\d+)?")
_TAG_LEAD_BRACKET_RE = re.compile(r"^[([{<]+")
_TAG_TRAIL_BRACKET_RE = re.compile(r"[)\]}>]+$")
_TAG_WS_RE = re.compile(r"\s+")


def clean_tag(raw: str) -> str:
    """Canonical lowercased danbooru tag: drop emphasis weight + emphasis brackets.

    "(asd)", "(asd:12)", "((asd))", "[asd]" -> "asd". Empty string when nothing is
    left. Used as the :Tag node identity so a weighted and unweighted spelling of
    the same booru tag never split into separate nodes."""
    t = _TAG_WEIGHT_RE.sub("", raw.replace("\\", "")).strip()
    while t and t[0] in "([{<" and t[-1] in ")]}>":
        t = t[1:-1].strip()
    opens = sum(t.count(c) for c in "([{")
    closes = sum(t.count(c) for c in ")]}")
    if opens != closes:
        t = _TAG_TRAIL_BRACKET_RE.sub("", _TAG_LEAD_BRACKET_RE.sub("", t)).strip()
    return _TAG_WS_RE.sub(" ", t).strip().lower()


# Lookup indexes the ingest MERGE path relies on. Without them every
# MERGE (:Tag {name}) / (:Asset {kind,key}) / (:Image {sha256}) is a FULL LABEL
# SCAN — O(nodes) per upserted tag/asset — which is the dominant write cost (and
# the lag) once the graph grows. Created idempotently; community-edition safe
# (plain indexes, not enterprise node-key constraints).
_SCHEMA_STATEMENTS = (
    "CREATE INDEX image_sha256 IF NOT EXISTS FOR (i:Image) ON (i.sha256)",
    "CREATE INDEX tag_name IF NOT EXISTS FOR (t:Tag) ON (t.name)",
    "CREATE INDEX asset_kind_key IF NOT EXISTS FOR (a:Asset) ON (a.kind, a.key)",
)


def ensure_schema() -> None:
    """Create the MERGE lookup indexes (idempotent). Call on startup / before a
    rebuild. Cheap when they already exist; turns the per-tag full scan into a seek."""
    with _session() as session:
        for stmt in _SCHEMA_STATEMENTS:
            session.run(stmt).consume()


def asset_key(ref: AssetRef) -> str:
    """Stable identity key for an asset: hash if present, else normalized name."""
    if ref.hash:
        return "h:" + ref.hash.strip().lower()
    return "n:" + normalize_name(ref.name)


def _driver() -> Driver:
    return get_driver()


def _session() -> Session:
    """Open a session on the configured database.

    ``Driver.session`` has a ``TYPE_CHECKING``-only overload that basedpyright
    doesn't fully resolve (the member itself types as partially unknown even
    though the returned ``Session`` is precise) — a genuine library typing gap,
    isolated here so the ignore only needs to exist once.
    """
    return _driver().session(database=get_database())  # pyright: ignore[reportUnknownMemberType]


def _rec_str(rec: Record, key: str) -> str:
    return cast(str, rec[key])


def _rec_int(rec: Record, key: str) -> int:
    return cast(int, rec[key])


def _rec_float(rec: Record, key: str) -> float:
    return cast(float, rec[key])


# Row shape sent to Neo4j as Cypher parameters: a plain JSON-ish dict (the
# driver only accepts primitives/dict/list), built from the typed AssetRef /
# LineageRef models just before the query call.
_AssetRow = dict[str, str]
_LineageRow = dict[str, str]
_EdgeRow = dict[str, str | list[str] | list[_AssetRow] | list[_LineageRow]]


def _asset_rows(references: Iterable[AssetRef]) -> list[_AssetRow]:
    return [{"kind": r.kind, "name": r.name, "key": asset_key(r)} for r in references]


def _clean_tags(tags: Iterable[str]) -> list[str]:
    return sorted({c for t in tags if (c := clean_tag(t))})


def _lineage_rows(lineage: Iterable[LineageRef]) -> list[_LineageRow]:
    return [{"parent": ln.parent, "kind": ln.kind} for ln in lineage]


_UPSERT_EDGE_QUERY = """
MERGE (img:Image {sha256: $sha256})
WITH img
// assets
CALL (img) {
    UNWIND $references AS ref
    MERGE (a:Asset {kind: ref.kind, key: ref.key})
      ON CREATE SET a.name = ref.name
    MERGE (img)-[:USES]->(a)
    RETURN count(*) AS _assets
}
// tags
CALL (img) {
    UNWIND $tags AS tname
    MERGE (t:Tag {name: tname})
    MERGE (img)-[:TAGGED]->(t)
    RETURN count(*) AS _tags
}
// lineage (parent images may not be upserted yet — MERGE creates the stub)
CALL (img) {
    UNWIND $lineage AS lin
    MERGE (p:Image {sha256: lin.parent})
    MERGE (img)-[d:DERIVED_FROM]->(p)
      SET d.kind = lin.kind
    RETURN count(*) AS _lineage
}
RETURN size($references) AS assets, size($tags) AS tags, size($lineage) AS lineage
"""


def _run_upsert_edges(
    tx: ManagedTransaction,
    sha256: str,
    references: list[_AssetRow],
    tags: list[str],
    lineage: list[_LineageRow],
) -> Record | None:
    return tx.run(
        _UPSERT_EDGE_QUERY, sha256=sha256, references=references, tags=tags, lineage=lineage
    ).single()


def upsert_edges(edge: EdgeUpsert) -> EdgeUpsertResult:
    """Upsert the image node plus all USES / TAGGED / DERIVED_FROM edges."""
    references = _asset_rows(edge.references)
    tags = _clean_tags(edge.tags)
    lineage = _lineage_rows(edge.lineage)

    with _session() as session:
        # Managed write transaction: auto-retries transient errors / deadlocks
        # (which Neo4j throws under concurrent MERGE load) — see the driver perf
        # guide. The result is consumed inside the tx function.
        def _tx(tx: ManagedTransaction) -> Record | None:
            return _run_upsert_edges(tx, edge.sha256, references, tags, lineage)

        rec = session.execute_write(_tx)
        assert rec is not None
        return EdgeUpsertResult(
            sha256=edge.sha256,
            assets=_rec_int(rec, "assets"),
            tags=_rec_int(rec, "tags"),
            lineage=_rec_int(rec, "lineage"),
        )


def _edge_payload(edge: EdgeUpsert) -> _EdgeRow:
    """Normalize one EdgeUpsert into the {sha256, references, tags, lineage} row
    shape the batched UNWIND query consumes (same normalization as upsert_edges)."""
    return {
        "sha256": edge.sha256,
        "references": _asset_rows(edge.references),
        "tags": _clean_tags(edge.tags),
        "lineage": _lineage_rows(edge.lineage),
    }


def upsert_edges_batch(edges: list[EdgeUpsert]) -> list[EdgeUpsertResult]:
    """Upsert MANY images' edges in ONE Neo4j transaction (UNWIND over the batch).

    The batch counterpart to :func:`upsert_edges`: the index.graph worker pool
    POSTs one /edges per image, and the service's micro-batcher coalesces the
    concurrent calls into this single transaction instead of one write tx per
    image — the dominant Neo4j write cost during bulk ingest / rebuild / reconcile,
    which otherwise floods Neo4j and starves the read queries the UI makes
    (neighbors / lineage / related-tags). Returns one result dict per input edge,
    in order. Idempotent (all MERGE), mirroring the per-image path.
    """
    if not edges:
        return []
    batch = [_edge_payload(e) for e in edges]
    query = """
    UNWIND $batch AS item
    MERGE (img:Image {sha256: item.sha256})
    WITH img, item
    CALL (img, item) {
        UNWIND item.references AS ref
        MERGE (a:Asset {kind: ref.kind, key: ref.key})
          ON CREATE SET a.name = ref.name
        MERGE (img)-[:USES]->(a)
    }
    CALL (img, item) {
        UNWIND item.tags AS tname
        MERGE (t:Tag {name: tname})
        MERGE (img)-[:TAGGED]->(t)
    }
    CALL (img, item) {
        UNWIND item.lineage AS lin
        MERGE (p:Image {sha256: lin.parent})
        MERGE (img)-[d:DERIVED_FROM]->(p)
          SET d.kind = lin.kind
    }
    RETURN item.sha256 AS sha256,
           size(item.references) AS assets,
           size(item.tags) AS tags,
           size(item.lineage) AS lineage
    """

    def _tx(tx: ManagedTransaction) -> list[Record]:
        return list(tx.run(query, batch=batch))

    with _session() as session:
        # Managed write transaction (auto-retry transient/deadlock) for the whole
        # coalesced batch — one round-trip + retry boundary for many images.
        rows = session.execute_write(_tx)
    return [
        EdgeUpsertResult(
            sha256=_rec_str(r, "sha256"),
            assets=_rec_int(r, "assets"),
            tags=_rec_int(r, "tags"),
            lineage=_rec_int(r, "lineage"),
        )
        for r in rows
    ]


def delete_image(sha256: str) -> int:
    """Remove an image node and all its edges (DETACH DELETE). Idempotent.

    Returns the number of Image nodes deleted (0 when it was not in the graph).
    Asset / Tag nodes are intentionally left in place: they may still be USED /
    TAGGED by other images. Any that are now orphaned are harmless and can be
    pruned by a rebuild-from-catalog or a future sweep.
    """
    q = """
    MATCH (img:Image {sha256: $sha256})
    DETACH DELETE img
    RETURN count(*) AS deleted
    """

    def _tx(tx: ManagedTransaction) -> Record | None:
        return tx.run(q, sha256=sha256).single()

    with _session() as session:
        rec = session.execute_write(_tx)
        return _rec_int(rec, "deleted") if rec else 0


def delete_images(sha256s: list[str]) -> int:
    """Remove MANY image nodes + their edges in ONE query (DETACH DELETE).

    The batch counterpart to :func:`delete_image`: a single ``WHERE sha256 IN``
    Cypher for the whole set instead of one round-trip per image. Asset/Tag nodes
    are left in place (still used by other images). Returns the count deleted.
    """
    if not sha256s:
        return 0
    q = """
    MATCH (img:Image) WHERE img.sha256 IN $shas
    DETACH DELETE img
    RETURN count(*) AS deleted
    """

    def _tx(tx: ManagedTransaction) -> Record | None:
        return tx.run(q, shas=sha256s).single()

    with _session() as session:
        rec = session.execute_write(_tx)
        return _rec_int(rec, "deleted") if rec else 0


# Cap how many nodes one prune transaction removes, so a large orphan backlog
# is cleared in bounded batches instead of one giant write tx (which holds long
# locks and Neo4j may reject). Each orphan type loops until a round deletes
# fewer than a full batch.
_PRUNE_BATCH = max(1, int(os.getenv("GRAPH_PRUNE_BATCH", "10000")))


@dataclass(frozen=True, slots=True)
class _OrphanCounts:
    assets: int
    tags: int


def _count_orphans() -> _OrphanCounts:
    """Count orphan :Asset (no incoming USES) and :Tag (no incoming TAGGED)
    nodes without deleting anything — backs the prune ``dry_run`` preview."""
    q = """
    MATCH (a:Asset) WHERE NOT (a)<-[:USES]-(:Image)
    WITH count(a) AS assets
    MATCH (t:Tag) WHERE NOT (t)<-[:TAGGED]-(:Image)
    RETURN assets, count(t) AS tags
    """
    with _session() as session:
        rec = session.run(q).single()
        assert rec is not None
        return _OrphanCounts(assets=_rec_int(rec, "assets"), tags=_rec_int(rec, "tags"))


def _delete_orphan_batches(session: Session, match_clause: str, var: str) -> int:
    """Delete the nodes matched by ``match_clause`` in ``_PRUNE_BATCH``-sized
    transactions, looping until a round removes fewer than a full batch.

    ``match_clause`` binds ``var`` to the orphan nodes; we DELETE (not DETACH):
    a structurally-orphaned :Asset/:Tag has no edges by construction, so a plain
    DELETE that errored would surface a logic bug instead of silently force-
    removing a live edge. Returns the total number of nodes deleted."""
    # match_clause/var are always one of the two internal literals passed by
    # prune_orphans (never user input), so this is safe to treat as a fixed
    # query template — cast past LiteralString since it's built via f-string.
    q = cast(
        LiteralString,
        f"""
    {match_clause}
    WITH {var} LIMIT $batch
    DELETE {var}
    RETURN count(*) AS n
    """,
    )

    def _tx(tx: ManagedTransaction) -> Record | None:
        return tx.run(q, batch=_PRUNE_BATCH).single()

    deleted = 0
    while True:
        rec = session.execute_write(_tx)
        assert rec is not None
        n = _rec_int(rec, "n")
        deleted += n
        if n < _PRUNE_BATCH:
            return deleted


def prune_orphans(*, dry_run: bool = False) -> PruneResult:
    """Remove structurally-orphaned graph entries left behind by image deletes.

    ``delete_image`` removes an :Image and its edges but intentionally leaves the
    :Asset/:Tag nodes it pointed at in place — they may still be USED/TAGGED by
    other images. As images come and go, some of those nodes end up with NO
    remaining edge: pure orphans that only bloat the graph and pollute the entity
    autocomplete (``suggest_entities``). This sweep removes them:

      - :Asset with no incoming :USES   — no image references it any more
      - :Tag   with no incoming :TAGGED — no image carries it any more

    Both are unambiguous: in this model an :Asset/:Tag can ONLY come into being
    via a USES/TAGGED edge from an :Image (see :func:`upsert_edges`), so one with
    none is definitively dead and safe to delete.

    :Image nodes are deliberately NOT pruned here. ``upsert_edges`` sets no
    property on an :Image beyond ``sha256``, so a fully-ingested image that
    happens to have no references and no tags is structurally identical to a
    stranded lineage stub (the ``MERGE (p:Image {sha256: lin.parent})`` of a
    since-deleted child). They can't be told apart without consulting the catalog
    (the source of truth) — reconciling :Image nodes against catalog truth is the
    rebuild/reconcile path, not this purely-structural sweep.

    ``dry_run`` returns the counts that WOULD be removed without deleting (the
    admin "preview impact" before a real run). Idempotent: a run with nothing
    orphaned returns zeros.
    """
    if dry_run:
        counts = _count_orphans()
        return PruneResult(assets_deleted=counts.assets, tags_deleted=counts.tags, dry_run=True)
    with _session() as session:
        assets = _delete_orphan_batches(
            session, "MATCH (a:Asset) WHERE NOT (a)<-[:USES]-(:Image)", "a"
        )
        tags = _delete_orphan_batches(
            session, "MATCH (t:Tag) WHERE NOT (t)<-[:TAGGED]-(:Image)", "t"
        )
    return PruneResult(assets_deleted=assets, tags_deleted=tags, dry_run=False)


def _merge_shared_asset_neighbors(results: dict[str, Neighbor], sha256: str, limit: int) -> None:
    q = """
    MATCH (i:Image {sha256: $sha256})-[:USES]->(a:Asset)<-[:USES]-(o:Image)
    WHERE o.sha256 <> $sha256
    RETURN o.sha256 AS sha256, count(DISTINCT a) AS weight
    ORDER BY weight DESC, sha256
    LIMIT $limit
    """
    with _session() as session:
        for rec in session.run(q, sha256=sha256, limit=limit):
            other = _rec_str(rec, "sha256")
            results[other] = Neighbor(
                sha256=other, relation="shared_asset", weight=_rec_float(rec, "weight")
            )


def _merge_tag_cooccurrence_neighbors(
    results: dict[str, Neighbor], sha256: str, limit: int
) -> None:
    q = """
    MATCH (i:Image {sha256: $sha256})-[:TAGGED]->(t:Tag)<-[:TAGGED]-(o:Image)
    WHERE o.sha256 <> $sha256
    RETURN o.sha256 AS sha256, count(DISTINCT t) AS weight
    ORDER BY weight DESC, sha256
    LIMIT $limit
    """
    with _session() as session:
        for rec in session.run(q, sha256=sha256, limit=limit):
            other = _rec_str(rec, "sha256")
            weight = _rec_float(rec, "weight")
            existing = results.get(other)
            if existing is None:
                results[other] = Neighbor(sha256=other, relation="tag_cooccurrence", weight=weight)
            else:
                # appears under both relations
                existing.relation = "shared_asset+tag_cooccurrence"
                existing.weight = (existing.weight or 0) + weight


def neighbors(sha256: str, relation: str = "any", limit: int = 24) -> list[Neighbor]:
    """Related images by shared asset and/or tag co-occurrence (traversal)."""
    results: dict[str, Neighbor] = {}

    if relation in ("shared_asset", "any"):
        _merge_shared_asset_neighbors(results, sha256, limit)
    if relation in ("tag_cooccurrence", "any"):
        _merge_tag_cooccurrence_neighbors(results, sha256, limit)

    ordered = sorted(results.values(), key=lambda n: (-(n.weight or 0), n.sha256))
    return ordered[:limit]


def lineage(sha256: str) -> list[Neighbor]:
    """Full variant/upscale/inpaint chain: ancestors and descendants of the image."""
    q = """
    MATCH (i:Image {sha256: $sha256})-[:DERIVED_FROM*1..]->(anc:Image)
    RETURN DISTINCT anc.sha256 AS sha256, 'ancestor' AS relation
    UNION
    MATCH (desc:Image)-[:DERIVED_FROM*1..]->(i:Image {sha256: $sha256})
    RETURN DISTINCT desc.sha256 AS sha256, 'descendant' AS relation
    """
    seen: dict[str, Neighbor] = {}
    with _session() as session:
        for rec in session.run(q, sha256=sha256):
            sha = _rec_str(rec, "sha256")
            if sha and sha != sha256 and sha not in seen:
                seen[sha] = Neighbor(sha256=sha, relation=_rec_str(rec, "relation"), weight=None)
    return list(seen.values())


def related_tags(tag: str, limit: int = 24) -> list[RelatedTag]:
    """Tags that co-occur (share an image) with the given tag, by frequency."""
    norm = tag.strip().lower()
    q = """
    MATCH (t:Tag {name: $tag})<-[:TAGGED]-(i:Image)-[:TAGGED]->(o:Tag)
    WHERE o.name <> $tag
    RETURN o.name AS tag, count(DISTINCT i) AS weight
    ORDER BY weight DESC, tag
    LIMIT $limit
    """
    with _session() as session:
        return [
            RelatedTag(tag=_rec_str(rec, "tag"), weight=_rec_float(rec, "weight"))
            for rec in session.run(q, tag=norm, limit=limit)
        ]


def _suggest_tags(pfx: str, limit: int) -> list[str]:
    q = """
    MATCH (t:Tag)
    WHERE $pfx = '' OR toLower(t.name) STARTS WITH $pfx
    OPTIONAL MATCH (t)<-[:TAGGED]-(i:Image)
    WITH t.name AS name, count(i) AS uses
    RETURN name ORDER BY uses DESC, name ASC
    LIMIT $limit
    """
    with _session() as session:
        return [
            name
            for rec in session.run(q, pfx=pfx, limit=limit)
            if (name := _rec_str(rec, "name"))
        ]


def _suggest_assets(kind: str, pfx: str, limit: int) -> list[str]:
    q = """
    MATCH (a:Asset {kind: $kind})
    WHERE $pfx = '' OR toLower(a.name) STARTS WITH $pfx
    OPTIONAL MATCH (a)<-[:USES]-(i:Image)
    WITH a.name AS name, count(i) AS uses
    RETURN name ORDER BY uses DESC, name ASC
    LIMIT $limit
    """
    with _session() as session:
        return [
            name
            for rec in session.run(q, kind=kind, pfx=pfx, limit=limit)
            if (name := _rec_str(rec, "name"))
        ]


def suggest_entities(entity_type: str, prefix: str = "", limit: int = 50) -> list[str]:
    """Distinct graph entity names of ``entity_type`` matching ``prefix``, most-used
    first — backs the graph-filter value autocomplete (one option list per type).

    ``entity_type`` is ``"tag"`` (a :Tag node) or an asset kind (checkpoint / lora
    / embedding / vae / controlnet / upscaler → an :Asset of that ``kind``). The
    prefix match is case-insensitive (Tag names are stored lowercased; Asset names
    keep their first-seen casing). Ranked by how many images USE/are TAGGED with
    the entity so the most relevant options surface first. Empty prefix → the
    most-used entities of that type.
    """
    t = (entity_type or "").strip().lower()
    pfx = (prefix or "").strip().lower()
    if t == "tag":
        return _suggest_tags(pfx, limit)
    return _suggest_assets(t, pfx, limit)


def wipe_all() -> None:
    """Delete every node + relationship. Used by tests for isolation."""
    with _session() as session:
        session.run("MATCH (n) DETACH DELETE n")


def upsert_many(edges: Iterable[EdgeUpsert]) -> int:
    count = 0
    for edge in edges:
        upsert_edges(edge)
        count += 1
    return count
