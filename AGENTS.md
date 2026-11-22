# AGENTS.md — GC-Presentation

## 1. Identity and sources of truth

GC-Presentation is GreenCrew's fork of [Presentation Commander Client](https://github.com/stoatworks-labs/presentation-commander-client), currently Electron + React + TypeScript, with pdf.js, NDI, OSC and platform-specific PowerPoint/Keynote adapters.

**Read before changes:**
1. [GreenCrew Tools Docs / AGENTS.md](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/AGENTS.md).
2. [Shared architecture](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/development/ARCHITECTURE.md) and [coding standards](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/development/CODING_STANDARDS.md).
3. For UI: [Branding](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/GREENCREW_BRANDING.md), [Design System](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/DESIGN_SYSTEM.md), [Iconography](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/ICONOGRAPHY.md), [Writing](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/WRITING_GUIDELINES.md), and [product specification](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/project/BRANDING_GCPRESENTATION.md).
4. Local [BRANDING.md](BRANDING.md), [ROADMAP.md](docs/ROADMAP.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md).

Shared docs are **canonical**. Do not vendor or duplicate them; make product-specific exceptions explicit.

## 2. Architecture rules

- Offline-first, safe event playback. A network outage, failed remote integration, blocked import or crash of a preview renderer must not intentionally clear Program output.
- Prefer incremental changes over rewrites. Keep working PDF/NDI functionality and preserve the established `SlideSource` interface unless a reviewed design requires change.
- Desktop-first operator console is a **product exception**. Presenter and remote web views must remain responsive and tablet/phone-friendly.
- Keep domain/navigation state independent of UI and output transport; gradually decouple from `src/renderer/src/App.tsx`.
- No unconditional dependence on the upstream Presentation Commander Server, GVideo or GreenCrew Event Hub.
- Leave existing app code licensed under MIT, preserve attribution and `LICENSE`/`ATTRIBUTIONS.md`.
- UI default accent `#00C853` until product standard changes; avoid arbitrary palette changes.

## 3. Working tree and branch hygiene

Always verify the repository and branch before edits: `pwd && git remote -v && git status --short && git log -1 --oneline`. Do not assume upstream author's private checkout locations apply to GreenCrew.

One change per branch, Draft PR initially, no direct push to `main`. Plan is [MASTER #3](https://github.com/DjGreenKrk/GC-Presentation/issues/3) and separate stage issues. PRs close a **stage**, never the MASTER. Use official sub-issues where supported. In PR description state scope, regression risk, validation evidence and required real-hardware checks.

## 4. Build and diagnostics

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run build:win
```

Native `native/ndi-send` requires official NDI SDK with appropriate platform setup. Packaging scripts include `scripts/clean-native-sdk-links.js`; do not remove or bypass its purpose. CI without SDK may perform only static/type/build checks; **do not call a renderer build a validated hardware build**.

Logging in Electron main: use existing `say`/`log` from `src/main/diag/`, not random ad-hoc console logging. Investigate existing `diag:collect` and `diag:openLogFolder` IPC; do not claim UI exposure exists until tested.

Important known behavior:
- Native NDI is independent per stream and its binary integration depends on the SDK.
- PDF transitions use offscreen/double-buffered canvas rendering.
- Windows PowerPoint bridge uses COM via PowerShell, exports static PNG and does **not** preserve animations; failure to display PPTX was reported in [#2](https://github.com/DjGreenKrk/GC-Presentation/issues/2).
- macOS PowerPoint/Keynote bridges differ and cannot be indiscriminately unified.
- Chrome/Canva browser extension currently cannot prefetch an arbitrary future slide.
- Raw Input device identification does not exclusively suppress keyboard events delivered to the foreground Windows application.

## 5. Definition of done for event-facing features

- Correct error/empty/offline states. Failed loading cannot silently replace the active Program with a broken or blank deck.
- Test normal, fast repeated navigation, source failure, restart and display unplug where applicable.
- Validate resource use in a real event setup; measure when performance claims are made.
- Run typecheck/build and report truthfully what was not tested on physical hardware.
- Update issue, docs and known limitations. Do not silently merge.

See `docs/DEVELOPING.md` for existing upstream technical details; where it conflicts with GreenCrew rules, the canonical standards and reviewed product decisions take precedence.
