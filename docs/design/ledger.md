# Ledger

One line per night. Visible to nightly agents as a constraint (avoid repeating atom pairings; write the "different from the last five nights" line from this file only). Slone updates verdicts after assessment.

Format: `YYYY-MM-DD | slug | mode | atoms: a, b | theme: <short> | wildcard: <short or none> | genre: <rolled genre> | look: palette/shapes/rendering | music: band/meter/mode/texture | verdict: pending`

The `genre:` tag lets the genre roll skip genres used in the last three nights. The `music:` tag (from `night-state.mjs sound`) lets the sound roll avoid repeating a tempo band, meter, mode or texture from the last three nights. The `look:` tag lets the look roll (`node scripts/night-state.mjs look`) avoid repeating a palette, shape language or rendering style from the last three nights.

## Nights
2026-10-29 | 2026-10-29-demo-ball | systemic | atoms: f-juice-forward, p-rising-tide | theme: scaffold smoke test (the original demo, now its own branch) | wildcard: none | genre: arcade survival | look: ember/circles and blobs/glow on dark | verdict: assessed (Slone: it was fun)
2026-10-30 | 2026-10-30-stillwinter | content | atoms: v-place-build, l-recoverable-setback | theme: Time only moves when something breaks | wildcard: none | genre: tower defense | look: arctic/stars and spikes/dithered | verdict: pending
