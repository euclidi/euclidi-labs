# ACOUSTICA — Euclidi Labs

Development build 0.2.0 (2026-11-27). This is an incomplete implementation of approved Revision 2.1, not a validated public release. The complete scope is preserved in [SPEC.md](SPEC.md); see [STATUS.md](STATUS.md) and [ROADMAP.md](ROADMAP.md).

## Launch

Serve this directory over HTTPS or localhost; opening `index.html` from a file URL is not supported. No package install is needed for the compiled development build. From the extracted directory run `python -m http.server 8000`, then visit http://localhost:8000/. `start-windows.bat` does this using the Python launcher if present. Microphone permissions are requested only when Start input or Send phone mic is selected. Stop releases capture tracks; phone pairing explicitly sends audio to the paired peer. The build has no telemetry, relay or external assets.

## Controls

- Reference generator: Start input, set waveform/frequency/amplitude, optionally enable monitored output at reduced gain. The second oscillator is an independent sine source.
- Local microphone / loopback: Select an available device, start capture, inspect Input info. Refresh after granting permission. Phone browsers can use their own local microphone.
- PC / tab audio: In a compatible browser, select the tab or screen and enable audio in the browser chooser. If no audio track is offered, use a supported OS loopback input. The app does not store or display screen frames. No microphone monitoring is enabled.
- Remote phone microphone: Open ACOUSTICA on both devices via HTTPS. Select Remote phone microphone on both. Create receive offer on desktop, transfer offer text to phone, select Send phone mic, transfer answer text back and Apply answer on desktop. Same-network direct WebRTC only, no STUN/TURN service. Compressed/resampled audio may affect measurements. Real phone pairing remains unverified. Stop on both devices.
- Audio file: select a file and Start input; supported formats depend on the browser. Imported audio loops until stopped; monitor is optional.
- Measurements: FFT window, axis, PSD, trigger, peak hold, freeze, calibration. Stereo inputs are mixed for analysis, while correlation and Lissajous use separate channels. WAV export captures raw first channel (mono); CSV captures derived measurements. PNG export captures plot canvas. Recording capped at ten minutes. The display only shows absolute SPL estimates after explicit single-point calibration; no certification.
- Experiments: switch among cymatics, tube, 2D propagation, vocal tract, ripple tank and synthesis. The initial numerical experiments replay recent signal blocks; their model clock is separate from audio time. Model units and approximations are shown. The field uses a fixed 160×100 grid and adjustable domain, aperture, wall boundary, sponge and water region. Precision/offline mode and 3D apparatus not yet implemented.

## Development

`sh build-core.sh` rebuilds the freestanding C++20 WASM using clang/wasm-ld. No external runtime libraries. `node test-core.mjs`, `node test-worker.mjs`, `node test-physics.mjs` execute numerical and worker tests. `test-browser.py` is the attempted local Playwright harness (blocked by browser policy); the repository Playwright test is `tests/acoustica-smoke.mjs`.

### Patch bay and saved setup
Open Patch bay from Signal Route; add a module, choose source taps or earlier module outputs, set parameters, and apply. The final output replaces the standard signal route for analysis and experiments; the raw input remains the recording/monitor source. Save/Restore setup stores controls and patch nodes locally in IndexedDB. WAV preserves one or two input channels. For phase, use a stereo source with a coherent dominant tone. The fixed field scale is available for simulated fields; voice transfer response is normalized separately.

### Three-dimensional apparatus
Use 3D apparatus in a physics lab to view the calculated model from an orbitable camera. Drag to orbit, scroll to zoom, switch back to the 2D field for quantitative plots. Three.js r170 is bundled locally with its MIT license. Deformation height is exaggerated; the renderer is not a 3D propagation solver.

### Model time and input
Live and buffered modes consume the routed samples in timestamp order. If the simulation falls behind the bounded buffer, it resets and reports skipped frames. Offline file mode consumes the first 60 seconds of a decoded file without repeating samples (raw channel mix, not the patch route). Pause, single-step and reset expose numerical time. Source/probe coordinates are normalized model coordinates. Fidelity currently adapts batch size, not spatial grid resolution.

### Expanded model controls
Cymatics supports a simply supported rectangle or circular plate/membrane; circular diameter is the domain height. Resonance includes ideal/end-corrected tubes and lumped single/paired Helmholtz cavities. The vocal lab's Analyze modeled voice button synthesizes a normalized glottal signal through the configured oral/nasal waveguide and sends it to the instruments; monitoring remains opt-in. These are linear reduced-order models with explicitly limited geometries.

### Additional measurements and offline use
Use oscilloscope cursor/trigger/range/persistence controls, select the spectrogram time span, or enable a controlled single-tone THD/THD+N test. Enable stereo transfer with a known left reference and right response; Welch estimates are meaningful only with suitable excitation and coherence. Fast/slow and percentile levels are approximate digital block statistics. Local service worker caches the application after an online visit; offline use does not grant microphone permission automatically.

**Current development release:** 0.2.0-dev. [Open ACOUSTICA](https://euclidi.github.io/euclidi-labs/acoustica/) when Pages publishes this revision. The expanded build passed [CI 45984501443](https://github.com/euclidi/euclidi-labs/actions/runs/45984501443), including controlled references, synthetic browser audio, 3D mode, mobile layout and offline cache. This is not a certified measuring instrument or complete implementation of every approved engineering requirement. See STATUS and ROADMAP for actual outstanding work.

### Direct Windows output capture
Browser screen-sharing does not guarantee system audio, particularly in Firefox. The Windows helper is a self-contained .NET 8/NAudio WASAPI loopback app serving the same laboratory on 127.0.0.1:8769. [Windows package CI](https://github.com/euclidi/euclidi-labs/actions/workflows/acoustica-windows.yml). Download the successful run's `ACOUSTICA-Windows-x64` artifact, extract everything and run ACOUSTICA.exe. Choose Windows output (native) and Start input. It uses the default multimedia render endpoint, not microphone. No audio leaves localhost. Real device verification is outstanding.

**Compiled Windows package:** [Download the verified build artifact](https://github.com/euclidi/euclidi-labs/actions/runs/45993179670/artifacts/15194776699) (the [build run](https://github.com/euclidi/euclidi-labs/actions/runs/45993179670) passed compilation and local HTTP startup tests, not physical playback tests). Extract all files. The local version is the PC-output route, not the hosted website. The hosted Windows page defaults to native capture instructions; Firefox browser sharing is hidden. The raw input indicator distinguishes arriving PCM, silence and stalled/no input independently of spectrum processing. Artifacts expire; use the latest successful Windows helper workflow if the link expires.

## Instrument-first revision 0.3
Overview shows spectrum, waveform and spectrogram together. Individual views fill the workspace; Settings opens advanced controls. Experiment parameters are grouped into primary controls and expandable model parameters. Export/setup is collapsed by default. Default stereo power combines squared channel amplitudes (mean energy), not the mono sum; waveform and pitch use left channel in unprocessed stereo-power mode. Choose left, right or mono sum explicitly. Active routing uses the selected channel or patch output; the basis label changes accordingly. General audio mode hides unreliable single-note claims. Levels are digital dBFS, not SPL. The updated regression fixtures include opposite-phase and one-sided stereo. Physical hardware accuracy and visual manual QA remain unverified.

## Listening workspace 0.4
Listen is the default view. It displays seven defined bands using integrated, window-normalized PSD (band RMS dBFS), fixed −80..0 dBFS scale, raw-channel stereo balance and an eight-second frequency history. Select a band to see its frequency range and typical audible characteristics; it does not identify stems, instruments, or tempo. The displayed analysis is on the selected route (default stereo mean power); frequency bands have finite FFT resolution and may share energy at their boundaries. Instrument mode preserves all scientific displays. Experiments are accessible from the experiment selector. New band reference fixtures and listening UI smoke tests are registered. Physical/subjective listening validation remains outstanding.
