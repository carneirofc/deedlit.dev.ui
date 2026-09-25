"""Tests for PNG text-chunk reading, ported from lib/png-metadata.ts."""
import io
from typing import cast

from PIL import Image
from png_metadata import read_embedded_metadata_from_png
from pydantic import JsonValue


def _fields(result: JsonValue) -> dict[str, JsonValue]:
    """Narrow ``result["metadata"]["fields"]`` (a fixed, known-shape record)."""
    metadata = cast(dict[str, JsonValue], result)["metadata"]
    return cast(dict[str, JsonValue], cast(dict[str, JsonValue], metadata)["fields"])


def test_non_png_returns_empty():
    assert read_embedded_metadata_from_png(b"not a png") == {}


def test_no_text_chunks_returns_empty():
    img = Image.new("RGB", (2, 2))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    assert read_embedded_metadata_from_png(buf.getvalue()) == {}


def test_text_chunk_string_value(make_png_bytes):
    png = make_png_bytes({"parameters": "hello world"})
    result = read_embedded_metadata_from_png(png)
    metadata = cast(dict[str, JsonValue], result)["metadata"]
    assert cast(dict[str, JsonValue], metadata)["source"] == "embedded-png"
    assert _fields(result)["parameters"] == "hello world"


def test_text_chunk_json_value_parsed(make_png_bytes):
    png = make_png_bytes({"prompt": '{"1": {"class_type": "X"}}'})
    fields = _fields(read_embedded_metadata_from_png(png))
    assert fields["prompt"] == {"1": {"class_type": "X"}}


def test_ztxt_compressed_chunk(make_png_bytes):
    png = make_png_bytes({}, ztxt={"workflow": '{"nodes": []}'})
    fields = _fields(read_embedded_metadata_from_png(png))
    assert fields["workflow"] == {"nodes": []}


def test_itxt_chunk(make_png_bytes):
    png = make_png_bytes({}, itxt={"parameters": "a, b, c"})
    fields = _fields(read_embedded_metadata_from_png(png))
    assert fields["parameters"] == "a, b, c"
