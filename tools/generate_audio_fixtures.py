"""Generate small, deterministic PCM fixtures for audio-path testing."""

from __future__ import annotations

import hashlib
import io
import json
import math
import random
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "assets" / "resource-library" / "audio-test-signals"
MANIFEST = FIXTURES / "manifest.json"
RATE = 48_000
DURATION = 1.0
FRAME_COUNT = int(RATE * DURATION)


def sine(hz: float, rate: int, index: int, amplitude: float) -> float:
    return amplitude * math.sin(2 * math.pi * hz * index / rate)


def signal_specs() -> list[dict]:
    def spec(filename, signal, *, rate=RATE, bits=16, channels=1, **metadata):
        return {
            "filename": filename,
            "signal": signal,
            "sample_rate_hz": rate,
            "duration_seconds": DURATION,
            "bit_depth": bits,
            "channels": channels,
            **metadata,
        }

    rows = [
        spec("sine-1000hz-minus6dbfs.wav", "sine", frequency_hz=1000, peak_amplitude=0.5),
        spec("two-tone-440-880hz.wav", "sum-of-sines", frequency_hz=[440, 880], component_amplitude=0.25),
        spec("impulse.wav", "impulse-at-start", peak_amplitude=0.5),
        spec("silence_1s_mono_48000_16bit.wav", "silence"),
        spec("dc_offset_025_mono_48000_16bit.wav", "dc-offset", dc_offset=0.25),
        spec("impulse_center_stereo_left_48000_16bit.wav", "center-impulse-left", channels=2, peak_amplitude=0.5),
        spec("sine_440hz_mono_48000_16bit.wav", "sine", frequency_hz=440, peak_amplitude=0.5),
        spec("sine_1000hz_mono_22050_16bit.wav", "sine", rate=22_050, frequency_hz=1000, peak_amplitude=0.5),
        spec("sine_1000hz_mono_96000_24bit.wav", "sine", rate=96_000, bits=24, frequency_hz=1000, peak_amplitude=0.5),
        spec("sine_1000hz_mono_48000_24bit.wav", "sine", bits=24, frequency_hz=1000, peak_amplitude=0.5),
        spec("square_440hz_mono_48000_16bit.wav", "square", frequency_hz=440, peak_amplitude=0.5),
        spec("triangle_440hz_mono_48000_16bit.wav", "triangle", frequency_hz=440, peak_amplitude=0.5),
        spec("sawtooth_440hz_mono_48000_16bit.wav", "sawtooth", frequency_hz=440, peak_amplitude=0.5),
        spec("sweep_linear_20_20000hz_mono_48000_16bit.wav", "linear-sweep", start_hz=20, end_hz=20_000, peak_amplitude=0.5),
        spec("sweep_log_20_20000hz_mono_48000_16bit.wav", "log-sweep", start_hz=20, end_hz=20_000, peak_amplitude=0.5),
        spec("white_noise_seed-20261127_mono_48000_16bit.wav", "white-noise", seed=20261127, peak_amplitude=0.25),
        spec("sine_1000hz_stereo_left_only_48000_16bit.wav", "left-only-sine", channels=2, frequency_hz=1000, peak_amplitude=0.5),
        spec("sine_1000hz_stereo_right_only_48000_16bit.wav", "right-only-sine", channels=2, frequency_hz=1000, peak_amplitude=0.5),
        spec("sine_440hz_stereo_in_phase_48000_16bit.wav", "in-phase-stereo-sine", channels=2, frequency_hz=440, peak_amplitude=0.5),
        spec("sine_440hz_stereo_anti_phase_48000_16bit.wav", "anti-phase-stereo-sine", channels=2, frequency_hz=440, peak_amplitude=0.5),
        spec("sine_1000hz_minus48dbfs_mono_48000_16bit.wav", "sine", frequency_hz=1000, peak_amplitude=10 ** (-48 / 20), level_dbfs=-48),
        spec("clipped_sine_440hz_mono_48000_16bit.wav", "clipped-sine", frequency_hz=440, input_amplitude=1.2, output_peak_amplitude=1.0),
        spec("fade_sine_440hz_mono_48000_16bit.wav", "sine-with-linear-fades", frequency_hz=440, peak_amplitude=0.5, fade_seconds=0.1),
    ]
    return rows


def samples_for(s: dict) -> list[tuple[float, ...]]:
    rate = s["sample_rate_hz"]
    frames = round(rate * s["duration_seconds"])
    channels = s["channels"]
    kind = s["signal"]
    values = []
    rng = random.Random(s.get("seed"))
    for i in range(frames):
        t = i / rate
        if kind == "silence":
            frame = (0.0,)
        elif kind == "dc-offset":
            frame = (s["dc_offset"],)
        elif kind == "impulse-at-start":
            frame = (s["peak_amplitude"] if i == 0 else 0.0,)
        elif kind == "center-impulse-left":
            frame = (s["peak_amplitude"] if i == frames // 2 else 0.0, 0.0)
        elif kind == "sine":
            frame = (sine(s["frequency_hz"], rate, i, s["peak_amplitude"]),)
        elif kind == "sum-of-sines":
            frame = (sum(sine(f, rate, i, s["component_amplitude"]) for f in s["frequency_hz"]),)
        elif kind == "square":
            value = math.sin(2 * math.pi * s["frequency_hz"] * t)
            frame = (s["peak_amplitude"] * (1.0 if value >= 0 else -1.0),)
        elif kind == "triangle":
            frame = (s["peak_amplitude"] * (2 / math.pi) * math.asin(math.sin(2 * math.pi * s["frequency_hz"] * t)),)
        elif kind == "sawtooth":
            phase = (s["frequency_hz"] * t) % 1.0
            frame = (s["peak_amplitude"] * (2.0 * phase - 1.0),)
        elif kind == "linear-sweep":
            f0, f1 = s["start_hz"], s["end_hz"]
            phase = 2 * math.pi * (f0 * t + (f1 - f0) * t * t / (2 * s["duration_seconds"]))
            frame = (s["peak_amplitude"] * math.sin(phase),)
        elif kind == "log-sweep":
            f0, f1 = s["start_hz"], s["end_hz"]
            ratio = f1 / f0
            phase = 2 * math.pi * f0 * s["duration_seconds"] / math.log(ratio) * (ratio ** (t / s["duration_seconds"]) - 1)
            frame = (s["peak_amplitude"] * math.sin(phase),)
        elif kind == "white-noise":
            frame = (rng.uniform(-s["peak_amplitude"], s["peak_amplitude"]),)
        elif kind in ("left-only-sine", "right-only-sine"):
            tone = sine(s["frequency_hz"], rate, i, s["peak_amplitude"])
            frame = (tone, 0.0) if kind == "left-only-sine" else (0.0, tone)
        elif kind in ("in-phase-stereo-sine", "anti-phase-stereo-sine"):
            tone = sine(s["frequency_hz"], rate, i, s["peak_amplitude"])
            frame = (tone, tone if kind == "in-phase-stereo-sine" else -tone)
        elif kind == "clipped-sine":
            tone = sine(s["frequency_hz"], rate, i, s["input_amplitude"])
            frame = (max(-1.0, min(1.0, tone)),)
        elif kind == "sine-with-linear-fades":
            fade_frames = round(s["fade_seconds"] * rate)
            envelope = min(1.0, i / fade_frames, (frames - 1 - i) / fade_frames)
            frame = (sine(s["frequency_hz"], rate, i, s["peak_amplitude"] * max(0.0, envelope)),)
        else:
            raise ValueError(f"unknown signal type: {kind}")
        if len(frame) != channels:
            raise ValueError(f"{s['filename']}: expected {channels} channels, got {len(frame)}")
        values.append(frame)
    return values


def encode_wav(s: dict) -> bytes:
    samples = samples_for(s)
    bits = s["bit_depth"]
    if bits not in (16, 24):
        raise ValueError(f"unsupported PCM bit depth: {bits}")
    max_positive = (1 << (bits - 1)) - 1
    min_negative = -(1 << (bits - 1))
    packed = bytearray()
    for frame in samples:
        for value in frame:
            integer = max(min_negative, min(max_positive, round(value * max_positive)))
            packed.extend(integer.to_bytes(bits // 8, byteorder="little", signed=True))
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(s["channels"])
        wav.setsampwidth(bits // 8)
        wav.setframerate(s["sample_rate_hz"])
        wav.writeframes(packed)
    return output.getvalue()


def metadata_for(s: dict, data: bytes) -> dict:
    result = dict(s)
    result["frames"] = round(s["sample_rate_hz"] * s["duration_seconds"])
    result["sha256"] = hashlib.sha256(data).hexdigest()
    result["bytes"] = len(data)
    return result


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    rows = []
    for s in signal_specs():
        data = encode_wav(s)
        (FIXTURES / s["filename"]).write_bytes(data)
        rows.append(metadata_for(s, data))
    document = {
        "schema_version": 1,
        "description": "Deterministic synthetic PCM fixtures. They test digital audio pipelines and are not acoustic calibration recordings.",
        "license": "CC0-1.0",
        "generator": "tools/generate_audio_fixtures.py",
        "fixtures": rows,
    }
    MANIFEST.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} deterministic WAV fixtures to {FIXTURES}")


if __name__ == "__main__":
    main()
