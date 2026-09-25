"""Interpret embedded PNG metadata into the typed ExtractResult payload.

Ported from ``interpretMetadata`` + ``extractImageMetadata`` in
``lib/library/services/metadata-service.ts`` — minus all pixel-derived work
(sha256/phash/dims/thumbnail), which is the ingest service's job (#6 scope note).

The ``references{}`` field resolves the full asset-reference graph (#7):
checkpoints/loras/embeddings/vae/controlnets/upscalers are resolved by
``metadata_parsing.resolve_references`` from the ComfyUI api-prompt node graph
(the same parsed ``api_prompt_json`` used for prompt/param extraction — the PNG
is never re-parsed). A1111 images carry no node graph, so their references are
the all-empty skeleton (``EMPTY_REFERENCES``).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from metadata_parsing import (
    REFERENCE_CATEGORIES,
    References,
    extract_from_comfy_prompt_graph,
    find_first_value_by_keys,
    get_searchable_metadata,
    is_record,
    maybe_parse_json_string,
    parse_automatic1111_parameters,
    resolve_references,
    to_display_value,
)
from prompt_tags import normalize_prompt_tags
from pydantic import BaseModel, JsonValue

__all__ = [
    "interpret_metadata",
    "EMPTY_REFERENCES",
    "REFERENCE_CATEGORIES",
    "ExtractResult",
    "GenerationParams",
]

EMPTY_REFERENCES = References()

_SIZE_RE = re.compile(r"(\d+)\s*[x×]\s*(\d+)")


def _to_number(value: JsonValue) -> float | None:
    """Port of ``toNumber``: tolerant float parse (commas -> dots)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        n = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return n


def _to_int(value: JsonValue) -> int | None:
    """Coerce a tolerant number to int for integer-typed params (seed/steps/...).

    The contract types seed/steps/width/height/clipskip as integers; the TS
    ``toNumber`` produced floats. We narrow integral floats to int and drop the
    fractional part otherwise (matching how these fields are always integers in
    practice for A1111/ComfyUI output).
    """
    n = _to_number(value)
    if n is None:
        return None
    return int(n)


def _parse_size(size: str | None) -> tuple[int | None, int | None]:
    if not size:
        return None, None
    m = _SIZE_RE.search(size)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


class GenerationParams(BaseModel):
    """The ``params{}`` field of the ExtractResult contract."""

    seed: int | None = None
    steps: int | None = None
    cfg: float | None = None
    sampler: str | None = None
    scheduler: str | None = None
    denoise: float | None = None
    clipskip: int | None = None
    width: int | None = None
    height: int | None = None


class ExtractResult(BaseModel):
    """The full ``/extract`` response payload (contract: ``ExtractResult``)."""

    sourceTool: str
    prompt: str | None
    negative: str | None
    tags: list[str]
    params: GenerationParams
    references: References
    workflow_json: JsonValue
    api_prompt_json: JsonValue


@dataclass(frozen=True, slots=True)
class _PromptFields:
    """Internal value object: the prompt/params half of an ExtractResult."""

    source_tool: str | None = None
    prompt: str | None = None
    negative: str | None = None
    params: GenerationParams = field(default_factory=GenerationParams)


def _parse_a1111(searchable: JsonValue) -> _PromptFields | None:
    """Port of the A1111 ``parameters`` half of ``interpretMetadata``."""
    parameters_raw = to_display_value(find_first_value_by_keys(searchable, ["parameters"]))
    if not parameters_raw:
        return None

    a1111 = parse_automatic1111_parameters(parameters_raw, include_first_line_as_positive=True)
    width, height = _parse_size(a1111.get("size"))
    params = GenerationParams(
        seed=_to_int(a1111.get("seed")),
        steps=_to_int(a1111.get("steps")),
        cfg=_to_number(a1111.get("cfgScale")),
        sampler=a1111.get("sampler"),
        scheduler=a1111.get("scheduler"),
        width=width,
        height=height,
    )

    return _PromptFields(
        source_tool="a1111",
        prompt=a1111.get("positivePrompt"),
        negative=a1111.get("negativePrompt"),
        params=params,
    )


def _parse_comfy(searchable: JsonValue) -> tuple[_PromptFields | None, JsonValue, References]:
    """Port of the ComfyUI ``prompt`` graph half of ``interpretMetadata``.

    Returns ``(fields, api_prompt_json, references)``. References are resolved
    for any parsed ComfyUI graph, even one that lacks a recognized prompt/model
    node; ``fields``/``api_prompt_json`` stay ``None`` in that case.
    """
    comfy_prompt = find_first_value_by_keys(searchable, ["prompt"])
    references = References()
    if comfy_prompt is None:
        return None, None, references

    parsed_comfy_prompt = maybe_parse_json_string(comfy_prompt)
    if not is_record(parsed_comfy_prompt):
        return None, None, references

    comfy = extract_from_comfy_prompt_graph(comfy_prompt)
    references = resolve_references(parsed_comfy_prompt)
    if not (comfy.get("positivePrompt") or comfy.get("model")):
        return None, None, references

    params = GenerationParams(
        seed=_to_int(comfy.get("seed")),
        steps=_to_int(comfy.get("steps")),
        cfg=_to_number(comfy.get("cfgScale")),
        sampler=comfy.get("sampler"),
        scheduler=comfy.get("scheduler"),
    )

    fields = _PromptFields(
        source_tool="comfyui",
        prompt=comfy.get("positivePrompt"),
        negative=comfy.get("negativePrompt"),
        params=params,
    )
    return fields, parsed_comfy_prompt, references


def _merge_generation_params(base: GenerationParams, extra: GenerationParams) -> GenerationParams:
    """Fill any ``None`` field of ``base`` from ``extra`` (``base`` wins ties)."""
    return GenerationParams(
        seed=base.seed if base.seed is not None else extra.seed,
        steps=base.steps if base.steps is not None else extra.steps,
        cfg=base.cfg if base.cfg is not None else extra.cfg,
        sampler=base.sampler if base.sampler is not None else extra.sampler,
        scheduler=base.scheduler if base.scheduler is not None else extra.scheduler,
        denoise=base.denoise if base.denoise is not None else extra.denoise,
        clipskip=base.clipskip if base.clipskip is not None else extra.clipskip,
        width=base.width if base.width is not None else extra.width,
        height=base.height if base.height is not None else extra.height,
    )


def _merge_prompt_fields(base: _PromptFields | None, extra: _PromptFields | None) -> _PromptFields:
    """Merge A1111 (``base``) and ComfyUI (``extra``) fields; ``base`` wins ties."""
    if base is None:
        return extra if extra is not None else _PromptFields()
    if extra is None:
        return base

    return _PromptFields(
        source_tool=base.source_tool or extra.source_tool,
        prompt=base.prompt if base.prompt is not None else extra.prompt,
        negative=base.negative if base.negative is not None else extra.negative,
        params=_merge_generation_params(base.params, extra.params),
    )


def interpret_metadata(metadata: JsonValue) -> ExtractResult:
    """Produce the typed ExtractResult from embedded PNG metadata.

    ``sourceTool`` is one of ``a1111`` / ``comfyui`` / ``unknown`` (contract
    enum). ``prompt``/``negative`` are ``None`` and ``params`` fields stay
    ``None`` when nothing recognizable is present.
    """
    searchable = get_searchable_metadata(metadata)

    a1111_fields = _parse_a1111(searchable)
    comfy_fields, api_prompt_json, references = _parse_comfy(searchable)
    fields = _merge_prompt_fields(a1111_fields, comfy_fields)

    workflow = find_first_value_by_keys(searchable, ["workflow"])
    workflow_json = maybe_parse_json_string(workflow) if workflow is not None else None

    tags = normalize_prompt_tags(fields.prompt)

    return ExtractResult(
        sourceTool=fields.source_tool or "unknown",
        prompt=fields.prompt,
        negative=fields.negative,
        tags=tags,
        params=fields.params,
        references=references,
        workflow_json=workflow_json,
        api_prompt_json=api_prompt_json,
    )
