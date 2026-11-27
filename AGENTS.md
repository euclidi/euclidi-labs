# Euclidi Labs — repository development rules

These rules apply to all current and future projects in this repository and every contributing agent or harness. Follow narrower project instructions and explicit user decisions first; never infer approval of a changed scope.

## Mandatory project records

Every project directory with an entry index.html, including separately listed release directories, MUST have a substantive README.md, SPEC.md, ROADMAP.md and STATUS.md before first publication. Read them before editing. Create them at project inception, keep them current in the same change as relevant implementation, and link them from the root documentation index and published catalog. Use [templates](docs/templates/) and the [documentation standard](docs/PROJECT_DOCUMENTATION.md). Do not let a roadmap masquerade as implemented functionality. Preserve prior approved specifications and version history.

## Project workflow

- Establish requirements, visual direction, scope and strongest feasible project-specific stack. Evaluate mature reusable engines/assets first. Obtain approval for consequential architectural choices; do not silently substitute low-fidelity fallbacks.
- Once scope and stack are agreed, implement the complete agreed experience to the maximum feasible extent, then iterate through interactive testing. Internal milestones are not approval gates unless explicitly requested (e.g. a specifically approved stage). Honor those gates.
- Use authentic, original or properly licensed assets; record provenance, inspect visual alignment, texture quality, contact and animation. Do not publish new cover art without owner approval.
- Maintain real functionality, controls, audio, saves and performance checks as relevant; don't replace a project with a reduced demo. Do not touch unrelated projects, erase archives, or restore delisted projects without approval.
- Run project tests and catalog checks; report actual tested, static-inspected, and unverified features separately. Save failures and corrective evidence. Add project-specific browser smoke coverage for each new launch path; do not claim all projects were tested when a check omits one.
- After interactive testing, use the intended GitHub Pages catalog at https://euclidi.github.io/euclidi-labs/ unless explicitly instructed otherwise. Keep launch routes, public documentation links, version labels and source records consistent; verify deployed version separately from Git commit. Never allow one project workflow to replace the whole site.
- Do not claim future work was completed or a deployment is live until evidence exists. Record blockers and decisions in STATUS.md.

Register new Labs projects with `project.json` and `python3 tools/catalog.py`. Do not alter the Games repository. Publish only intentionally reviewed project folders, never secrets. See [catalog operations](docs/CATALOG.md). Keep the repository public for the existing Pages deployment unless explicitly asked to change visibility. Labs uses a single catalog view. Present any new site icon or brand identity for explicit owner approval before committing or publishing it. The approved identity is the minimal bold monochrome EL terminal tile, explicitly approved by the owner on 2026-11-27, with a blinking underscore. Preserve the exact approved letterforms, dark tile and prompt; no textures, glow, bevels or unrelated stylization. Motion settings and document visibility control header cursor blinking. Keep browser favicon URLs static, including a multi-resolution ICO, for reliable bookmark identity; do not animate the tab favicon unless explicitly requested again. Keep this mark until a replacement is explicitly approved. Do not restore the mechanical library unless explicitly requested.
