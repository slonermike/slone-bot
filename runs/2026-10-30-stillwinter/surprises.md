# Surprises (Follow the fun), Stillwinter

Logged before fixing, as the protocol asks.

1. **Time is a currency, and the first economy was a cliff.** With thaw at 1.5 s per shatter the greedy bot built a spike and immediately shattered it for fuel, so it never defended (kills 4, dawn 34% after ten minutes). Doubling the time per shatter to 3 s fixed it, but then passive ice (0.3 to 0.15 per second) flipped outcomes bimodal: win with 0 hearts lost, or collapse with 5. Fix: a lost heart melts into +4 ice, so a failure is also a rebuild. That single reprieve turned the cliff into a slope (greedy now loses 3 or 4 hearts and still wins). Kept: failure pays for the recovery.
2. **Place-then-shatter spam beat the real strategy.** The degenerate probe (place a spike, shatter it, repeat on one cell by the beacon) reached 81% of the greedy score because the blast damage was 2 at every shatter. Lowering the blast of ordinary spires to 1 and making Crystals the bombs (2 damage, widest radius) made shatter positioning matter: a Crystal beside the path is a mine, a Lantern is a clock-winder, a Spike is a turret. This is the best thing the night found: three spires that are the same object (a thing you can break) with three different reasons to break it.
3. **A frozen world makes speed of hand irrelevant.** Every decision is made with perfect information and no time pressure, so difficulty can only come from resources and the shape of the waves, not from execution. That is exactly the "no skill wall" Slone wants, but it means a competent bot wins easily at first tuning (0 hearts lost). Pressure had to be rebuilt from scarcity (ice) and from telegraphed, flow-driven threats (warm fronts).
4. **The tool-in-hand rule was nearly a soft lock.** Cold Snap could fill with no spires on the board (the meter fed from shatters), and the greedy bot sat frozen forever on "snap ready, nothing to snap". Fixed in the bot and by gating the plan; also added a beacon "lends you ice" gift so an empty board with no ice can never trap a player.
5. **Idle bot: time really does stop.** The idle bot's world never moves (600 s of nothing). That is the theme working as intended, but it means the checklist item "idle bot proves back pressure acts without input" is false by design for this game.

Pivots: none. Everything above reinforced the target feeling (held breath, then release).

## Second pass (imagined hates and loves)
Hates fixed: (1) fiddly cursor travel and a stingy first minute: B hops to the next spire, RT hops to a building cell near the lead enemy, the first tenth of dawn refunds a shatter in full, start ice 12. (2) guessing the cost of releasing time: orange ETA markers show where each walker will be after one more shatter, so planning is not a gamble.
Loves doubled: (1) chains and Cold Snap: a CHAIN x N counter, rising whole-tone pings per link, hit-stop and a punch on Cold Snap. (2) the held breath: ticks speed up and rise in pitch as the time bank drains.
