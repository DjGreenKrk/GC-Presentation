# GC-Presentation — agent quick reference

GreenCrew's Electron + React + TypeScript presentation output application, forked from Presentation Commander Client. Shared standards: [GreenCrew_Tools_Docs](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs). Product-specific rules: [AGENTS.md](AGENTS.md).

## Before work

- Confirm repo/branch and clean tree: `git remote -v && git branch --show-current && git status --short`.
- Read [ROADMAP](docs/ROADMAP.md) and [ARCHITECTURE](docs/ARCHITECTURE.md); honor MASTER #3 and related stage issue.
- Keep inherited MIT license and attribution.
- Do not alter production code while a task requests planning only.

## Commands

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run build:win
```

NDI SDK is a native build-time dependency. Windows hardware behavior, screen routing and HID must be validated on real equipment. Use existing diagnostics (`say`/`log`) in Electron main; keep logs safe. Packaging relies on `scripts/clean-native-sdk-links.js`.

## Product rules

- Offline-first, never clear Program on an unrelated failure.
- Distinct Program / Next / Presenter views and independent routes (physical display, NDI, later WWW).
- `#00C853` is the current approved UI accent; desktop-first console is an explicit exception.
- Code changes use feature branches and Draft PR. PRs close stage issues, not MASTER.
- PPTX Static must eventually work without installed PowerPoint. PowerPoint Live is a separate capability; PNG export is static.
- HID in background does not imply keyboard input is swallowed in other applications.

Detailed requirements and tests belong in [ROADMAP](docs/ROADMAP.md) and the issue of the active stage.
