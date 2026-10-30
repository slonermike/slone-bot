# 07 Themes Script

A script on main that controls access to the theme pool. Day-one version: plain JSON, a Node script in the scaffold, and `CLAUDE.md` rules. A stronger encrypted-binary version is on the roadmap with the same commands.

## Where the state lives
The pool, graveyard and state files live on main. A run works on a proto branch, so `node scripts/sync-main.mjs pull` (start of a run) takes `themes/` from the latest main, and `node scripts/sync-main.mjs push` (right after `resolve`, and after `add`) commits only `themes/` to main and pushes it, retrying if main moved. Without the push, a theme used on a proto branch would come back on the next run. Two runs resolving at the same moment can still overwrite each other (last push wins); `sync-main.mjs notes` does the same for the ledger and pending lessons, appending only the lines a run added; runs are started by hand or on a schedule, so that is unlikely.

## Why a script
Nightly agents must not see other nights' rejection reasons or strike counts (they would bias the choice), and must not edit the pool by hand. The script is the only sanctioned access. This is a convention, not a lock: the constitution forbids opening `themes/*.json` and every run logs the files it opens.

## Files
- `themes/pool.json`: array of themes
- `themes/graveyard.json`: removed themes with their reasons
- `themes/state.json`: per-night guard (last roll date, last resolve date) and roll history (to avoid re-offering the same trio)

## Theme entry
```json
{ "id": "t001", "text": "Limited space", "type": "constraint|feeling|system|world",
  "source": "seed|postmortem|human", "strikes": 0, "reasons": [], "used": null }
```
Themes are design prompts, not skins. "Limited space" is a mechanical spark; "pirates" is a costume. Write themes so they generate mechanics.

## Commands
- `node scripts/themes.mjs roll [--n 3]`
  Prints only `id`, `text`, and `type` for n options drawn without replacement. No strike counts, no reasons. Rolls are seeded by the run's start stamp (from `night-state.mjs start`), so several runs on one day each get their own roll. A theme is not re-offered in a trio identical to a previous roll. One roll per run; a second roll in the same run fails.
- `node scripts/themes.mjs resolve --pick <id> --reject <id>:"reason" --reject <id>:"reason"`
  Consumes the picked theme (sets `used` to tonight's date and removes it from the pool). For each rejected theme: `strikes += 1` and the reason is appended. At 3 strikes a theme moves to the graveyard, but only if at least one of its reasons cites the theme itself rather than the alternatives. One resolve per run.
  Validation: every rejected option needs a non-empty reason; a reason that is only "too hard to build" (or equivalent) is refused with the message "reinterpret it smaller instead"; the picked id must be one of tonight's rolled ids.
- `node scripts/themes.mjs remove <id|exact text> --reason "why"`
  Human only (refused under `NIGHT_RUN=1`). Moves a theme to the graveyard with the reason; it is not offered again, and `add` will refuse near-duplicates of it.
- `node scripts/themes.mjs restore <id|exact text>`
  Human only. Brings a retired theme back into the pool with its strikes cleared (refused for a theme a run already used).
- `node scripts/themes.mjs add "<text>" --type <type> --source postmortem`
  Adds a new theme (1 to 3 per night). Detects near-duplicates (normalized text overlap) and refuses them. Sources must be `postmortem` for nightly runs.
- `node scripts/themes.mjs report`
  **Human use only.** Prints pool size, strike counts, graveyard, and the most common phrases in rejection reasons (to surface agent bias). A nightly run must not call this. The script refuses when `NIGHT_RUN=1` is set in the environment (the scheduled task sets it).

## Guardrails in code
- Minimum pool size 15. If a roll would draw from fewer than n themes, print a loud warning, fall back to `themes/fallback-pool.json` (copy of the original seed list), and log the event.
- Once-per-night guards for `roll` and `resolve`.
- All output is plain text and short.
- Tests: roll without replacement, no leaked fields, strike math, graveyard rule, duplicate detection, refusal of "too hard" reasons, `report` refusal under `NIGHT_RUN=1`, minimum pool fallback.

## Agent rules
- Never open `themes/*.json`.
- Never read rejection reasons or strike counts.
- Add 1 to 3 new themes at pencils-down, sourced from the night's own surprises or open questions, not from generic ideas.
- Log in the post mortem which theme was picked and one line on why (the reasons for rejected options live only in the script's store).

## Upgrade path (roadmap)
Compiled binary built from a separate repo; rejection reasons encrypted to a public key so only the human can decrypt; no command returns hidden data to a nightly run; binary hash pinned in the constitution and checked at preflight. Same commands, so the swap is drop-in.
