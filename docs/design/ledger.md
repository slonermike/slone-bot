# Ledger

One line per night. Visible to nightly agents as a constraint (avoid repeating atom pairings; write the "different from the last five nights" line from this file only). Slone updates verdicts after assessment.

Format: `YYYY-MM-DD | slug | mode | atoms: a, b | theme: <short> | wildcard: <short or none> | look: palette/shapes/rendering | verdict: pending`

The `look:` tag lets the look roll (`node scripts/night-state.mjs look`) avoid repeating a palette, shape language or rendering style from the last three nights.

## Nights
2026-10-29 | 2026-10-29-demo-ball | systemic | atoms: f-juice-forward, p-rising-tide | theme: scaffold smoke test (the original demo, now its own branch) | wildcard: none | look: ember/circles and blobs/glow on dark | verdict: assessed (Slone: it was fun)
2026-10-29 | 2026-10-29-unjam | systemic | atoms: p-speed-ramp, d-curator-mode | theme: things get stuck, unsticking is the fun | wildcard: none | look: lagoon/circles and blobs/thick outlines | verdict: pending
