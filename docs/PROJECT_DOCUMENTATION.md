# Project documentation standard

Effective 2026-11-26. Required for each project and separately listed version. Files are Markdown tracked with the code, not a chat-only promise.

| File | Required content |
|---|---|
| README.md | Premise, release/lifecycle, launch link, controls, local run/dependencies, doc links and limitations. |
| SPEC.md | Approved objectives, functional requirements, engine/physics/rendering/asset choices, target scope, delivery and acceptance; explicitly mark proposed/unrecovered decisions. |
| ROADMAP.md | Prioritized outstanding work, explicit acceptance gates, known dependencies and release criteria. |
| STATUS.md | Dated implemented vs missing features, version/commit, evidence links, actual test coverage, known failures and next priority. |

New project checklist:
1. Establish scope and technology choices, record approval or unresolved items in SPEC.md.
2. Copy the templates into the project, replace all placeholder fields, create project entry and project tests.
3. Add root README and catalog documentation links. Register or extend browser tests for every public launch path.
4. Update roadmap and status as implementation progresses; preserve earlier versions and scope records. Do not advertise an archived project as active.
5. Run the documentation audit (`python3 tools/catalog.py --check`) and project tests. Review Pages deployment and actual project functionality before certifying a release.

CI checks registered projects for required documents, valid metadata and a current generated catalog. The generator validates presence and nonempty content; reviewers must assess substance. This is a reporting check, not a configured GitHub branch-protection or Pages publication gate; administrators may make it required in repository settings. Content accuracy remains a human/agent review responsibility.
