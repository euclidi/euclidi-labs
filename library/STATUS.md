# Status — 2026-11-27

Mechanical library code ported from Euclidi Games with independent branding, category naming and empty inventory handling. No real experiments exist in Labs at initialization. Runtime and visual fidelity are not yet verified; no retrieval with real inventory has been performed. GitHub Pages configuration is outside the connector's supported administration operations. Browser and deployment results must be recorded separately before certifying the release.

2026-11-27: catalog generation, JavaScript syntax and static staging passed in GitHub Actions. The first browser job failed before running tests because Playwright 1.51.1 does not support the ubuntu-latest runner's Ubuntu 26.04 image. Pin CI to Ubuntu 24.04; the new browser result remains pending. Pages deployment remains unverified.
