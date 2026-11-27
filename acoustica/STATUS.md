# Development status — 0.1.0 — 2026-11-27

**Incomplete reference development build; not a verified public release.** Full approved scope is in SPEC.md. The local runtime cannot resolve github.com for git clone, lacks Emscripten and approved third-party source libraries, and Chromium navigation returned ERR_BLOCKED_BY_ADMINISTRATOR for localhost and synthetic test origin. No real browser playtest or device calibration completed. The GitHub connector is used for review branch transfer; deployment is gated by interactive validation. No cover art added.

## Implemented in source / compiled locally

- C++20 freestanding WASM radix-2 FFT (five windows), RMS/peak/DC/near-full-scale sample counts, YIN pitch and staggered pressure/particle velocity FDTD. Float64 authoritative core; actual wasm compiled with clang 17/wasm-ld. Custom FFT is temporary deviation from KissFFT; no Emscripten or Eigen validation.
- AudioWorklet capture, DSP and physics workers, reference oscillators, local mic/loopback input, permission-based display audio, file decode and manual direct WebRTC phone link. Stereo mixed analysis and separate correlation/Lissajous; recording first channel. All capture API paths are code-only until browser tests pass.
- Waveform/trigger, spectrum/PSD, spectrogram, levels, weighted window levels, pitch/note, harmonic peaks, experimental autocorrelation LPC envelope peaks, single-point calibration estimates; filter/gain/delay chain; freeze, peak hold, PNG/WAV/CSV. Calibration not valid on remote/system sources. Not the full modular graph or complete instrumentation.
- Six lab launch modes: rectangular plate modes and approximate grain migration, ideal tube modes, compiled 2D staggered FDTD with adjustable aperture/media/boundaries, lossless segmented tract response, gravity-capillary modal ripple tank, two-tone synthesis. Physics source is recent-window replay, not full synchronized continuous broadband simulation. FDTD grid fixed at 160×100; absorbing sponge is unvalidated. Plate uses simulated displacement, tube/ripple relative model amplitude. Vocal tract response is not actual synthesized sound. No 3D apparatus or WebGPU; current Canvas 2D/JS presentation is a temporary partial build.
- Responsive stylesheet and mobile tabs/settings; not visually playtested. No persistence or offline cache. Recording cap 10 min; 30 min reliability untested. No third-party runtime dependencies or network audio relay. No claims of physical SPL accuracy.

## Executed tests

- `node test-core.mjs`: 18 checks passed (see JSON); coherent tones, window amplitude, Parseval, frequency, RMS/peak, 50–2000 Hz pitch, silence and clipping.
- `node test-worker.mjs`: 8 checks passed: 1 kHz DSP worker frequency/pitch, RMS, A/C weighting at 1 kHz, integrated PSD, stereo correlation, zero injected gaps. This is Node worker emulation, not browser capture.
- `node test-physics.mjs`: 9 checks passed: CFL 0.85, plane packet speed 340.178 m/s vs 343 (0.823% low), short lossless energy drift 0.0000749%, finite heterogeneous field, five physics worker modes finite. These are narrow fixtures, not full convergence or validation.
- `node --check` for application and worker scripts. Browser test was attempted twice and blocked before application load. No UI, microphone hardware, system audio, real phone, cross-browser, browser export, latency, performance, privacy network audit, physical calibration, or publication verification.

All unfinished acceptance requirements are in ROADMAP.md and SPEC.md; the project should remain a development review until browser smoke and actual interactive testing succeed.
