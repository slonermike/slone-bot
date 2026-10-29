# 05 Launcher, Manifest, Hosting

## Goal
One permanent URL on the Steam Deck: the launcher. It lists every prototype as a card. Pressing A launches one. Select+Start (held) returns.

## Prototype manifest: `prototype.json` (lives in each prototype's folder)
```json
{
  "slug": "2026-10-30-name",
  "title": "Name",
  "date": "2026-10-30",
  "question": "The one thing this build tests",
  "targetFeeling": "thrilling escape, then curious",
  "mode": "content|systemic",
  "tags": ["escalating-pursuit", "toy-traversal"],
  "theme": "text of the theme used",
  "wildcard": "optional constraint text or null",
  "juiceLayers": ["shake", "squashStretch", "particles", "audio"],
  "metrics": ["runLength", "deaths"],
  "assets": [{ "file": "x.wav", "source": "url", "license": "CC0", "date": "2026-10-30" }],
  "buildStatus": "ok|broken",
  "feedbackStatus": "needs-feedback|assessed|favorite",
  "sizeKB": 0,
  "thumbnail": "thumb.png"
}
```

## Site layout
```
/                 launcher (from main)
/index.json       generated list of all prototype manifests
/p/<slug>/        built static files for each prototype (frozen snapshot)
```

## Build and publish flow
1. A nightly run pushes branch `proto/YYYY-MM-DD-name` with source and `prototype.json`.
2. CI (GitHub Actions) runs the smoke test, then builds that branch with Vite `base: './'` into `/p/<slug>/`.
3. CI copies the output into the published site and regenerates `index.json` from all manifests. Only the pushed branch is rebuilt; old prototype folders are never rebuilt against newer scaffold code (they stay frozen).
4. Failed builds set `buildStatus: "broken"`; the launcher skips broken cards. One bad night never takes down the front door.
5. The newest successful prototype is pinned at the top of the launcher.

## Why not per-branch preview URLs
Preview URLs are long, derived from branch names, may sit behind login protection, and may rebuild against newer scaffold code. One site with subfolders gives stable URLs and frozen snapshots.

## Hosting choice
Any static host works. Default: Vercel production deploy from a build-output branch (e.g. `site`), since the human has a Vercel account. Alternatives: GitHub Pages (private repos may need a paid plan; verify), Cloudflare Pages. Because the repo is public, GitHub Pages is free and a strong second choice. Document the choice in `BUILD_REPORT.md`. The repo is public. Ask the human only if blocked (for example, Vercel plan limits).

## Launcher spec
- Controller-first: d-pad or left stick moves focus between cards, A launches, B backs out of sub-screens, Y opens the filter/tag view, X opens the feedback sheet for the focused card.
- Cards show: title, date, one-line question, target feeling, tags, status badge (needs feedback, assessed, favorite, broken), thumbnail.
- Sort: newest first by default, with the newest pinned. Filters by tag (concept-library atoms) and by status.
- Launching navigates to `/p/<slug>/` (full-page navigation). Default is navigation, not iframe, for gamepad robustness.
- Return combo: Select + Start held 0.5s from any prototype goes back to `/`.
- **Feedback sheet view:** displays the prototype's question list and a copyable text block (the template in `docs/design/04`). Chat-only for now; no network write path.
- **Play history:** store locally (`localStorage`, try/catch): last played, play count, rough play time per prototype. Show on cards. Return behavior is a strong signal for assessment.
- Audio: master volume and mute in the launcher menu.
- **About and credits** screen: renders `ATTRIBUTION.md` (or a generated `credits.json`) and the MIT license notice.
- Focus visuals must be readable at arm's length on 1280x800.
- Pointer/touch is ignored.

## Theming of the launcher
Apply the `frontend-design` skill if available: a coherent palette, a distinctive typeface choice (web-safe or bundled), strong focus states, and large hit targets. Keep it fast to load and no heavy dependencies.

## Hard rules
- The launcher is read-only static content. No write endpoints, no tokens, no secrets in the repo.
- Never publish a build that fails the smoke test.
- Keep total site size in check; log per-prototype size.
