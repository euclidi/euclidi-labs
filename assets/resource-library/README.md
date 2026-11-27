# Reusable lab resources

These assets are available for experiments and are not loaded by ACOUSTICA or the catalog.

- `tech/kissfft/`: C FFT and real-transform source, headers, upstream README and BSD-3-Clause license at commit `de93ec32a1bed6360d6c37a71bea4d984394bb42`, https://github.com/mborgerding/kissfft . This is a source subset, not a configured library or WASM build; compile and validate numerical conventions, precision and performance before integration.
- `audio-test-signals/`: three mono 48 kHz, 16-bit, one-second PCM WAVs: 1 kHz sine at 0.5 peak (approximately -6.02 dBFS), 440+880 Hz tones at 0.25 peak each, and an impulse at sample zero with 0.5 peak. These are synthetic digital fixtures, not acoustic calibration references.
- `kenney-prototype-textures/`: selected light/dark grid textures from [Prototype Textures](https://kenney.nl/assets/prototype-textures), CC0; source archive license included. Useful for scale and geometry checks.
- `kenney-icons/`: selected 64-pixel icons from [Board Game Icons](https://kenney.nl/assets/board-game-icons), CC0; source archive license included. These are candidates for future tools, not approved Labs branding.

Kenney files are unchanged subsets from the shared `D:/Assets` archives. Test and evaluate style and licensing before use in a project.
