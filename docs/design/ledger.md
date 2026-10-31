# Ledger

One line per night. Visible to nightly agents as a constraint (avoid repeating atom pairings; write the "different from the last five nights" line from this file only). Slone updates verdicts after assessment.

Format: `YYYY-MM-DD | slug | mode | atoms: a, b | theme: <short> | wildcard: <short or none> | genre: <rolled genre> | look: palette/shapes/rendering | music: band/meter/mode/texture | verdict: pending`

The `genre:` tag lets the genre roll skip genres used in the last three nights. The `music:` tag records the tempo band, meter, mode and texture the music chose, so the next game's "different from the last five nights" line can include its sound (a record, not a constraint). The `look:` tag lets the look roll (`node scripts/night-state.mjs look`) avoid repeating a palette, shape language or rendering style from the last three nights.

## Nights
2026-10-29 | 2026-10-29-demo-ball | systemic | atoms: f-juice-forward, p-rising-tide | theme: scaffold smoke test (the original demo, now its own branch) | wildcard: none | genre: arcade survival | look: ember/circles and blobs/glow on dark | verdict: assessed (Slone: it was fun)
2026-10-29 | 2026-10-29-unjam | systemic | atoms: p-speed-ramp, d-curator-mode | theme: things get stuck, unsticking is the fun | wildcard: none | look: sunset/hard polygons/flat fills | verdict: pending
2026-10-30 | 2026-10-30-stillwinter | content | atoms: v-place-build, l-recoverable-setback | theme: Time only moves when something breaks | wildcard: none | genre: tower defense | look: arctic/stars and spikes/dithered | verdict: pending
2026-10-30 | 2026-10-30-blotbeat | content | atoms: f-juice-forward, l-roguelite-run | theme: Every mistake leaves a mark that later becomes a tool (self-authored: roll guard) | wildcard: none | genre: rhythm action | look: mono-plus-one/thin lines/thick outlines | verdict: pending
2026-10-31 | 2026-10-31-tiny-inside | content | atoms: v-bounce, l-scale-up | theme: Being very small in a very large thing | wildcard: none | genre: exploration platformer | look: paper/ribbons and curves/soft gradients | music: slow/3-4 and 7-8/lydian and phrygian/beatless music box with pulse | verdict: pending
