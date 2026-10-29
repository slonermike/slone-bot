# 09 Branches and Deploys: keeping nights independent

Added by the scaffold build (the numbered docs 01-08 are unchanged). It records how the repo stays out of its own way as hundreds of `proto/*` branches pile up.

## The rule
**A change to main must never require touching, re-testing, or re-deploying any existing prototype.** Nights and main are decoupled on purpose.

## How that works
1. **Every prototype is a frozen snapshot.** When a `proto/*` branch is pushed, CI builds that branch with the scaffold code *that branch carries* and writes the result once to `p/<slug>/` on the `site` branch. Nothing rebuilds it later. It does not matter whether the branch is far behind main.
2. **Main's CI only builds main.** A push to main runs the checks, then rebuilds the launcher and the `_demo` prototype. It never checks out, builds, or tests other branches.
3. **Branches never need to merge main back in.** A night starts from the `scaffold-stable` tag (the last commit of main whose checks passed, moved by CI), so a broken main does not block a night. A night merges reusable tech to main only when the smoke test passes; that is the only coupling and it points one way, from nights into main.
4. **Failures are isolated.** If a night's checks fail, CI records a `broken` card for it (launcher skips it) and every other prototype keeps working.

## The frozen contract
The launcher and the frozen prototypes meet at a small surface. It may grow, but existing parts keep their meaning forever:
- Site layout: `/`, `/index.json`, `/p/<slug>/` (the return-to-launcher URL is derived from this layout and baked into each frozen build).
- `index.json`: `{ schemaVersion: 1, prototypes: [...] }`; each entry is the prototype's `prototype.json`. New optional fields are fine; the launcher must tolerate missing ones.
- Per-prototype files the launcher reads: `prototype.json`, `thumb.png`, `postmortem.md`, `feedback-sheet.md`.
- Browser storage keys: `mgb.history.v1` (written by prototypes, read by the launcher), `mgb.audio.v1`, `mgb.juice.v1`. A new format gets a new key (`v2`); the launcher keeps reading `v1`.

If a change would break this contract, it needs a new `schemaVersion` and the launcher must keep supporting the old one.

## Hosting
The `site` branch is a plain static folder. Any host can serve it: GitHub Pages (set Source to branch `site`, folder `/`), or Vercel/Cloudflare Pages pointed at `site` with no build command. Because the build already ran, the host does not need Node.
