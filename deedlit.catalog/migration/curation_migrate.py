"""One-time, idempotent curation migration into ``deedlit.catalog`` (#20).

Copies CURATION data — notes, collections, ratings, favorites — from the *old
TS Postgres* into the catalog's Postgres. Re-derivable data (images / tags /
generation_params / vectors / graph) is deliberately NOT migrated: it is
re-ingested by the ingest worker, so the catalog's ``images`` table is left
untouched here.

Re-keying
---------
Every curation row in the source references an image by the TS ``images.id``
(a UUID surrogate key). The cross-service id is the full sha256 hex, so the
migration first loads the source ``images.id -> sha256_hash`` map and re-keys
every reference to its sha256. Rows whose ``image_id`` cannot be resolved (e.g.
the image was hard-deleted while the curation row lived on) are skipped and
logged.

Idempotency
-----------
All writes are ``INSERT ... ON CONFLICT`` upserts keyed on stable identifiers:

* ``notes`` / ``collections``      -> upsert on the source ``id`` (UUID carried
  over verbatim, so re-running updates in place).
* ``note_image_refs`` / ``collection_images`` -> upsert on
  ``(parent_id, sha256)``; the set of refs for each parent is reconciled
  (stale rows pruned) so a re-run converges.
* ratings / favorites -> stored in ``image_references`` under the reserved
  ``kind`` values ``'rating'`` / ``'favorite'``, upserted on the table PK
  ``(sha256, kind, name)``.

Ratings / favorites storage
---------------------------
The catalog keeps rating/favorite as columns on ``images`` (re-derivable, wiped
on re-ingest). To preserve this curation across re-ingestion in a sha256-keyed
way without touching ``images``, the migration writes them as rows in
``image_references`` (``kind='rating'``, ``name=<0-5>``; ``kind='favorite'``,
``name='true'``). After re-ingest a small reconcile step can fold these back
onto the rebuilt ``images`` rows.

Run as a module::

    SOURCE_DATABASE_URL=postgresql://... DATABASE_URL=postgresql://... \\
        uv run --project deedlit.catalog python -m migration.curation_migrate

Add ``--reconcile`` to print a source-vs-dest row-count report instead of (or,
with ``--migrate --reconcile``, after) migrating.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import TypeVar, cast

from pydantic import BaseModel, JsonValue, computed_field
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine, RowMapping

logger = logging.getLogger("catalog.curation_migrate")

# Reserved image_references.kind values used to durably park curation that the
# catalog otherwise stores as columns on the re-derivable images table.
RATING_KIND = "rating"
FAVORITE_KIND = "favorite"


# ---------------------------------------------------------------------------
# row-mapping helpers (mirrors catalog/repository.py's narrowing pattern: keep
# the untyped SQLAlchemy RowMapping boundary confined to these few functions)
# ---------------------------------------------------------------------------

_ColT = TypeVar("_ColT")


def _col(row: RowMapping, key: str, expected: type[_ColT]) -> _ColT | None:
    """Read ``row[key]``, narrowed to ``expected`` or ``None``."""
    value = row[key]  # pyright: ignore[reportAny] -- sqlalchemy.RowMapping.__getitem__ -> Any
    return value if isinstance(value, expected) else None


def _col_req(row: RowMapping, key: str, expected: type[_ColT]) -> _ColT:
    """Like :func:`_col` but raises when the column is missing/NULL."""
    value = _col(row, key, expected)
    if value is None:
        raise TypeError(f"column {key!r}: expected {expected!r}, got NULL/mismatch")
    return value


def _col_id(row: RowMapping, key: str) -> str:
    """Stringify a UUID surrogate-key column (psycopg may hand back a
    ``uuid.UUID`` or a plain ``str`` depending on the column/driver path)."""
    value = row[key]  # pyright: ignore[reportAny] -- sqlalchemy.RowMapping.__getitem__ -> Any
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, str):
        return value
    raise TypeError(f"column {key!r}: expected str/UUID, got {value!r}")


def _col_json(row: RowMapping, key: str) -> object:
    """Read an opaque JSONB column (already decoded by the driver, so its
    Python shape may be dict/list/str/int/float/bool/None)."""
    return row[key]  # pyright: ignore[reportAny] -- sqlalchemy.RowMapping.__getitem__ -> Any


# ---------------------------------------------------------------------------
# Engine helpers
# ---------------------------------------------------------------------------


def _engine(url: str) -> Engine:
    """Build a SQLAlchemy engine, normalising to the psycopg3 driver."""
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url, future=True, pool_pre_ping=True)


# ---------------------------------------------------------------------------
# Re-key map
# ---------------------------------------------------------------------------


def _load_sha_map(src: Connection) -> dict[str, str]:
    """Return ``{image_uuid: sha256_hash}`` from the source images table."""
    rows = src.execute(text("SELECT id, sha256_hash FROM images")).mappings().all()
    result: dict[str, str] = {}
    for row in rows:
        sha = _col(row, "sha256_hash", str)
        if sha:
            result[_col_id(row, "id")] = sha
    return result


def _resolve(sha_map: dict[str, str], image_id: str, *, context: str) -> str | None:
    sha = sha_map.get(image_id)
    if sha is None:
        logger.warning("skip %s: image_id %s has no sha256 in source", context, image_id)
    return sha


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _ImageRef:
    image_id: str
    position: int


def _load_refs(src: Connection, table: str, parent_col: str, parent_id: str) -> list[_ImageRef]:
    rows = src.execute(
        text(f"SELECT image_id, position FROM {table} WHERE {parent_col} = :pid ORDER BY position"),
        {"pid": parent_id},
    ).mappings().all()
    return [_ImageRef(image_id=_col_id(r, "image_id"), position=_col_req(r, "position", int)) for r in rows]


@dataclass(frozen=True, slots=True)
class _RefSyncSpec:
    table: str
    parent_col: str
    parent_id: str
    insert_sql: str
    context: str


def _sync_refs(
    dst: Connection,
    refs: list[_ImageRef],
    sha_map: dict[str, str],
    spec: _RefSyncSpec,
) -> None:
    kept: list[str] = []
    for ref in refs:
        sha = _resolve(sha_map, ref.image_id, context=spec.context)
        if sha is None:
            continue
        kept.append(sha)
        dst.execute(text(spec.insert_sql), {"pid": spec.parent_id, "sha": sha, "pos": ref.position})
    _prune(dst, spec.table, spec.parent_col, spec.parent_id, "sha256", kept)


def _migrate_notes(src: Connection, dst: Connection, sha_map: dict[str, str]) -> None:
    notes = src.execute(
        text(
            "SELECT id, title, positive, negative, blocks, created_at, updated_at "
            "FROM notes"
        )
    ).mappings().all()

    for n in notes:
        note_id = _col_id(n, "id")
        dst.execute(
            text(
                """
                INSERT INTO notes (id, title, positive, negative, blocks,
                                   created_at, updated_at)
                VALUES (:id, :title, :positive, :negative,
                        CAST(:blocks AS JSONB), :created_at, :updated_at)
                ON CONFLICT (id) DO UPDATE SET
                    title      = EXCLUDED.title,
                    positive   = EXCLUDED.positive,
                    negative   = EXCLUDED.negative,
                    blocks     = EXCLUDED.blocks,
                    updated_at = EXCLUDED.updated_at
                """
            ),
            {
                "id": note_id,
                "title": _col(n, "title", str),
                "positive": _col(n, "positive", str),
                "negative": _col(n, "negative", str),
                "blocks": _as_json(_col_json(n, "blocks")),
                "created_at": n["created_at"],  # pyright: ignore[reportAny] -- driver-typed timestamp, passed through as a bind param
                "updated_at": n["updated_at"],  # pyright: ignore[reportAny] -- driver-typed timestamp, passed through as a bind param
            },
        )

        refs = _load_refs(src, "note_images", "note_id", note_id)
        _sync_refs(
            dst,
            refs,
            sha_map,
            _RefSyncSpec(
                table="note_image_refs",
                parent_col="note_id",
                parent_id=note_id,
                context=f"note_image {note_id}",
                insert_sql="""
                    INSERT INTO note_image_refs (note_id, sha256, position)
                    VALUES (:pid, :sha, :pos)
                    ON CONFLICT (note_id, sha256) DO UPDATE SET
                        position = EXCLUDED.position
                """,
            ),
        )


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------


def _migrate_collections(
    src: Connection, dst: Connection, sha_map: dict[str, str]
) -> None:
    cols = src.execute(
        text("SELECT id, name, created_at, updated_at FROM collections")
    ).mappings().all()

    for c in cols:
        cid = _col_id(c, "id")
        dst.execute(
            text(
                """
                INSERT INTO collections (id, name, created_at, updated_at)
                VALUES (:id, :name, :created_at, :updated_at)
                ON CONFLICT (id) DO UPDATE SET
                    name       = EXCLUDED.name,
                    updated_at = EXCLUDED.updated_at
                """
            ),
            {
                "id": cid,
                "name": _col(c, "name", str),
                "created_at": c["created_at"],  # pyright: ignore[reportAny] -- driver-typed timestamp, passed through as a bind param
                "updated_at": c["updated_at"],  # pyright: ignore[reportAny] -- driver-typed timestamp, passed through as a bind param
            },
        )

        refs = _load_refs(src, "collection_images", "collection_id", cid)
        _sync_refs(
            dst,
            refs,
            sha_map,
            _RefSyncSpec(
                table="collection_images",
                parent_col="collection_id",
                parent_id=cid,
                context=f"collection_image {cid}",
                insert_sql="""
                    INSERT INTO collection_images (collection_id, sha256, position)
                    VALUES (:pid, :sha, :pos)
                    ON CONFLICT (collection_id, sha256) DO UPDATE SET
                        position = EXCLUDED.position
                """,
            ),
        )


# ---------------------------------------------------------------------------
# Ratings / favorites
# ---------------------------------------------------------------------------


def _migrate_ratings_favorites(
    src: Connection, dst: Connection, sha_map: dict[str, str]
) -> None:
    rows = src.execute(
        text("SELECT id, rating, favorite FROM images")
    ).mappings().all()

    for r in rows:
        sha = sha_map.get(_col_id(r, "id"))
        if sha is None:
            continue
        rating = _col(r, "rating", int)
        if rating is not None:
            _upsert_ref(dst, sha, RATING_KIND, str(rating))
        if _col(r, "favorite", bool):
            _upsert_ref(dst, sha, FAVORITE_KIND, "true")


def _upsert_ref(dst: Connection, sha: str, kind: str, name: str) -> None:
    dst.execute(
        text(
            """
            INSERT INTO image_references (sha256, kind, name, position)
            VALUES (:sha, :kind, :name, 0)
            ON CONFLICT (sha256, kind, name) DO UPDATE SET
                position = EXCLUDED.position
            """
        ),
        {"sha": sha, "kind": kind, "name": name},
    )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _prune(
    dst: Connection,
    table: str,
    parent_col: str,
    parent_id: str,
    child_col: str,
    keep: list[str],
) -> None:
    """Delete child rows for a parent that are no longer present in the source.

    Keeps the migration convergent (idempotent) even if a ref was removed in the
    source between runs.
    """
    if keep:
        dst.execute(
            text(
                f"DELETE FROM {table} WHERE {parent_col} = :pid "
                f"AND {child_col} <> ALL(:keep)"
            ),
            {"pid": parent_id, "keep": keep},
        )
    else:
        dst.execute(
            text(f"DELETE FROM {table} WHERE {parent_col} = :pid"),
            {"pid": parent_id},
        )


def _as_json(value: object) -> str:
    if value is None:
        return "{}"
    if isinstance(value, bytes):
        return value.decode()
    if isinstance(value, str):
        return value
    return json.dumps(value)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def migrate(source_url: str, dest_url: str) -> None:
    """Run the full curation migration from ``source_url`` into ``dest_url``."""
    src_engine = _engine(source_url)
    dst_engine = _engine(dest_url)
    try:
        with src_engine.connect() as src:
            sha_map = _load_sha_map(src)
            logger.info("loaded %d image id->sha256 mappings", len(sha_map))
            with dst_engine.begin() as dst:
                _migrate_notes(src, dst, sha_map)
                _migrate_collections(src, dst, sha_map)
                _migrate_ratings_favorites(src, dst, sha_map)
        logger.info("curation migration complete")
    finally:
        src_engine.dispose()
        dst_engine.dispose()


class ReconcileCount(BaseModel):
    """Source-vs-dest row count for a 1:1 mirrored table (notes/collections)."""

    source: int
    dest: int

    @computed_field
    @property
    def ok(self) -> bool:
        return self.source == self.dest


class ReconcileRefCount(BaseModel):
    """Source-vs-dest count for a re-keyed ref table (note/collection images)."""

    source: int
    source_resolvable: int
    dest: int

    @computed_field
    @property
    def ok(self) -> bool:
        return self.source_resolvable == self.dest


class ReconcileRatingCount(BaseModel):
    """Source-resolvable-vs-dest count for the rating/favorite park rows."""

    source_resolvable: int
    dest: int

    @computed_field
    @property
    def ok(self) -> bool:
        return self.source_resolvable == self.dest


class ReconcileReport(BaseModel):
    """Source-vs-destination curation row-count report (see ``reconcile``)."""

    notes: ReconcileCount
    collections: ReconcileCount
    note_image_refs: ReconcileRefCount
    collection_images: ReconcileRefCount
    ratings: ReconcileRatingCount
    favorites: ReconcileRatingCount

    @computed_field
    @property
    def all_ok(self) -> bool:
        return (
            self.notes.ok
            and self.collections.ok
            and self.note_image_refs.ok
            and self.collection_images.ok
            and self.ratings.ok
            and self.favorites.ok
        )


def _count(conn: Connection, query: str) -> int:
    # `scalar_one()` on a raw text() query is untyped (Any) at the SQLAlchemy
    # boundary; COUNT(*) always returns an int, so a concrete cast is safe here.
    return cast(int, conn.execute(text(query)).scalar_one())


def _reconcile_ratings_favorites(
    src: Connection, dst: Connection, sha_map: dict[str, str]
) -> tuple[ReconcileRatingCount, ReconcileRatingCount]:
    rated_src = sum(
        1
        for r in src.execute(
            text("SELECT id, rating FROM images WHERE rating IS NOT NULL")
        ).mappings().all()
        if _col_id(r, "id") in sha_map
    )
    fav_src = sum(
        1
        for r in src.execute(
            text("SELECT id FROM images WHERE favorite = true")
        ).mappings().all()
        if _col_id(r, "id") in sha_map
    )
    ratings_dest = _count(dst, f"SELECT count(*) FROM image_references WHERE kind = '{RATING_KIND}'")
    favorites_dest = _count(dst, f"SELECT count(*) FROM image_references WHERE kind = '{FAVORITE_KIND}'")
    ratings = ReconcileRatingCount(source_resolvable=rated_src, dest=ratings_dest)
    favorites = ReconcileRatingCount(source_resolvable=fav_src, dest=favorites_dest)
    return ratings, favorites


def reconcile(source_url: str, dest_url: str) -> dict[str, JsonValue]:
    """Compare source vs destination curation row counts.

    Returns a report dict; for the ref tables it also reports how many source
    rows were *resolvable* (had a sha256), since unresolvable rows are expected
    to be absent in the destination.
    """
    src_engine = _engine(source_url)
    dst_engine = _engine(dest_url)
    try:
        with src_engine.connect() as src, dst_engine.connect() as dst:
            sha_map = _load_sha_map(src)

            notes = ReconcileCount(
                source=_count(src, "SELECT count(*) FROM notes"),
                dest=_count(dst, "SELECT count(*) FROM notes"),
            )
            collections = ReconcileCount(
                source=_count(src, "SELECT count(*) FROM collections"),
                dest=_count(dst, "SELECT count(*) FROM collections"),
            )
            note_refs = _reconcile_refs(src, dst, sha_map, "note_images", "note_image_refs")
            col_refs = _reconcile_refs(src, dst, sha_map, "collection_images", "collection_images")
            ratings, favorites = _reconcile_ratings_favorites(src, dst, sha_map)
    finally:
        src_engine.dispose()
        dst_engine.dispose()

    report = ReconcileReport(
        notes=notes,
        collections=collections,
        note_image_refs=note_refs,
        collection_images=col_refs,
        ratings=ratings,
        favorites=favorites,
    )
    # pydantic's model_dump() return type is a library typing gap (Any-shaped);
    # the model's own field types guarantee this matches dict[str, JsonValue].
    return cast(dict[str, JsonValue], report.model_dump())


def _reconcile_refs(
    src: Connection,
    dst: Connection,
    sha_map: dict[str, str],
    src_table: str,
    dst_table: str,
) -> ReconcileRefCount:
    src_rows = src.execute(text(f"SELECT image_id FROM {src_table}")).mappings().all()
    source = len(src_rows)
    resolvable = sum(1 for row in src_rows if _col_id(row, "image_id") in sha_map)
    dest = _count(dst, f"SELECT count(*) FROM {dst_table}")
    return ReconcileRefCount(source=source, source_resolvable=resolvable, dest=dest)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _CliArgs:
    source_url: str | None
    dest_url: str | None
    migrate: bool
    reconcile: bool


def _parse_args(argv: list[str] | None) -> _CliArgs:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-url",
        default=os.environ.get("SOURCE_DATABASE_URL"),
        help="old TS Postgres URL (default: $SOURCE_DATABASE_URL)",
    )
    parser.add_argument(
        "--dest-url",
        default=os.environ.get("DATABASE_URL"),
        help="catalog Postgres URL (default: $DATABASE_URL)",
    )
    parser.add_argument("--migrate", action="store_true", help="run the migration")
    parser.add_argument(
        "--reconcile", action="store_true", help="print a source-vs-dest count report"
    )
    args = parser.parse_args(argv)
    source_url = cast(str | None, args.source_url)
    dest_url = cast(str | None, args.dest_url)
    migrate_flag = cast(bool, args.migrate)
    reconcile_flag = cast(bool, args.reconcile)

    if not source_url or not dest_url:
        parser.error(
            "both --source-url/$SOURCE_DATABASE_URL and "
            "--dest-url/$DATABASE_URL are required"
        )

    return _CliArgs(
        source_url=source_url,
        dest_url=dest_url,
        migrate=migrate_flag,
        reconcile=reconcile_flag,
    )


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    args = _parse_args(argv)
    assert args.source_url is not None
    assert args.dest_url is not None

    # Default behaviour: migrate then reconcile.
    do_migrate = args.migrate or not args.reconcile
    do_reconcile = args.reconcile or not args.migrate

    if do_migrate:
        migrate(args.source_url, args.dest_url)

    if do_reconcile:
        report = reconcile(args.source_url, args.dest_url)
        print(json.dumps(report, indent=2, default=str))
        if not report["all_ok"]:
            return 1
    return 0


if __name__ == "__main__":  # pragma: no cover - manual entry point
    raise SystemExit(main())
