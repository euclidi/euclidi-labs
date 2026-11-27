# Reusable lab resources

- [glTF render fixtures](gltf-render-fixtures/README.md): 14 standards samples with source hashes, feature metadata, and a repeatable validator entry point.

Assets for experiments and validation; they are not loaded by ACOUSTICA or the catalog.

- [Humanoid motion reference](humanoid-reference/README.md): skinned mannequin with 46 named clips for visual or animation experiments.
- [Audio test signals](audio-test-signals/README.md): 23 deterministic, synthetic PCM fixtures plus a machine-readable manifest, generator, and validator. These test digital audio code paths; they are not acoustic calibration recordings.
- `tech/kissfft/`: C FFT and real-transform source, headers, upstream README, and BSD-3-Clause license at commit `de93ec32a1bed6360d6c37a71bea4d984394bb42`, [mborgerding/kissfft](https://github.com/mborgerding/kissfft). This is a source subset, not a configured library or WASM build; compile and validate numerical conventions, precision, and performance before integration.
- `kenney-prototype-textures/`: selected light/dark grid textures from [Prototype Textures](https://kenney.nl/assets/prototype-textures), CC0; source archive license included.
- `kenney-icons/`: selected 64-pixel icons plus the complete [Board Game Icons](https://kenney.nl/assets/board-game-icons) CC0 source archive at `kenney-icons-full/`. These are candidates for future tools, not approved Labs branding.

Every source archive keeps its own license. Check style, provenance, and file format before integration.
