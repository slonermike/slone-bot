# Ledger

One line per night. Visible to nightly agents as a constraint (avoid repeating atom pairings; write the "different from the last five nights" line from this file only). Slone updates verdicts after assessment.

Format: `YYYY-MM-DD | slug | mode | atoms: a, b | theme: <short> | wildcard: <short or none> | look: palette/shapes/rendering | verdict: pending`

The `look:` tag lets the look roll (`node scripts/night-state.mjs look`) avoid repeating a palette, shape language or rendering style from the last three nights.

## Nights
(none yet; the `_demo` smoke-test prototype is not logged)
