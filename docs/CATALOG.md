# Catalog operations

Add a top-level slug directory containing `index.html`, `README.md`, `SPEC.md`, `ROADMAP.md`, `STATUS.md`, and `project.json`. The manifest requires `id` (unique positive integer), `title`, `category`, `version`, `description`. Optional `cover` points to approved artwork inside the project directory, `color` and `ink` are hex colors, `archived` hides the card. Run `python3 tools/catalog.py` to regenerate both the root HTML and README. Never manually change generated card regions. The catalog reads the generated card list. No invented entries or cover art. Use categories Simulation, Physics, Tools, Research or additional domain-specific labels.

Pages: the existing public repository uses GitHub Pages branch deployment. Keep the main branch suitable for publishing. The optional manual Actions deployment uses a staged catalog and should only be used if Pages is deliberately switched to GitHub Actions. Never commit secrets to this public repository.

Local preview: run `python3 tools/catalog.py --check` then `python3 -m http.server 8000`. Open `/`. Use reduced motion, search, category, icon and mobile viewport tests before release.
