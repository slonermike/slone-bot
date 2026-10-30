# Surprises (follow the fun): Blot Beat

Logged as they happened, before fixing.

1. **Fever chained itself into a free pass.** The first economy let a stamp make misses free, so a bot that never touched a lane (it only pressed the stamp) survived all four sets. Mash bots stamped 50 times a run. Fix: ink needs about six beats to dry after a fever (stamp lock), strays are rate limited, and fever halves ink instead of erasing it. After that the stamper bot loses in about 75 s and idle in 29 s.
2. **Spill cleared the whole chart, not just the board.** A spill marked every future note as cleared, so the idle bot sat in set 1 forever. Only notes already on the board are cleared now.
3. **Mashing every lane scores like a sloppy player, not like a skilled one.** It hits everything (and the stamp auto-hits what it misses) but strays break combo, so its multiplier stays at x1: 28k against 70k for the greedy bot and 38k for a 79% player. The combo multiplier is what keeps mashing from being a strategy.
4. **Opposite lanes share an axis**, so a link line between the two notes of a double is hidden by the lane line. Doubles got their own double-outlined note shape instead.
5. **A delayed tween silently killed the fade-in.** The juice tween manager replaces a tween on the same property, so `tween(h, {alpha: 1})` followed by `tween(h, {alpha: 0}, {delay})` meant the prompt plate never appeared. Same for the banner's scale. Found only by opening screenshots. Fix: a `later(ms, fn)` helper on a dummy target.
6. **Headless fps was 5, and it was fill rate.** JS cost is 0.3 ms a step. One full-screen layer costs about 90 ms in software GL. Using the desk colour as the clear colour and hiding idle overlays doubled the rate. Real-hardware fps is not measured.
7. **A hit-stop would have broken the game.** Freezing the sim on a big hit slides every note off the music, so the stamp uses shake, rings and confetti instead and no hit-stop is used anywhere.
8. **The most interesting decision is the one nobody asked for.** Because a stamp spends all the ink, holding more makes a longer fever but risks a spill, and from set 3 the well leaks while half full. "Hold or cash in" showed up as the real game once the drips existed. The Ink Siphon sticker (clean play charges the stamp) was added so skilled players have a way into that decision too.
