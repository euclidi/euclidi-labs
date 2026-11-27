"""Validate PCM fixture headers, hashes, and deterministic regeneration."""

from __future__ import annotations

import hashlib
import json
import sys
import wave
from pathlib import Path

from generate_audio_fixtures import FIXTURES, MANIFEST, encode_wav, signal_specs


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    specs = {s["filename"]: s for s in signal_specs()}
    entries = {row["filename"]: row for row in manifest["fixtures"]}
    assert manifest["schema_version"] == 1
    assert set(entries) == set(specs), "manifest entries differ from generator"
    for filename, spec in specs.items():
        path = FIXTURES / filename
        data = path.read_bytes()
        row = entries[filename]
        assert hashlib.sha256(data).hexdigest() == row["sha256"], f"hash mismatch: {filename}"
        assert data == encode_wav(spec), f"not reproducible: {filename}"
        with wave.open(str(path), "rb") as wav:
            expected = (spec["channels"], spec["bit_depth"] // 8, spec["sample_rate_hz"], round(spec["sample_rate_hz"] * spec["duration_seconds"]))
            actual = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes())
            assert actual == expected, f"header mismatch for {filename}: {actual} != {expected}"
            assert wav.getcomptype() == "NONE", f"not uncompressed PCM: {filename}"
        print(f"PASS {filename} ({row['channels']} ch, {row['sample_rate_hz']} Hz, {row['bit_depth']}-bit)")
    print(f"Validated {len(specs)} WAV fixtures")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, ValueError, wave.Error, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise
