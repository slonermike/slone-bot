# Ink: showing it without words

Slone's brief: ink falling on the board, the character in the middle and the pages in the UI are all disconnected. Flow from one place to another must visibly happen and be connected; pressure must read visually; overflow must show an overflow. If it cannot be understood without words, the design is wrong.

## What the player must be able to read with no text
1. A miss turns into ink (cause).
2. That ink goes somewhere and is stored (flow, store).
3. How full the store is, and that it is getting dangerous (pressure).
4. What overflow does and what it costs (overflow, lives).
5. That the stored ink can be spent, when it is worth spending, and what spending does (power move).
6. That holding too much is slowly punished (leak).

## Today (the failures)
- Misses make a splat on the ring; a small drop flies to a small bottle. The splat, the drop and the bottle are three objects with no channel between them.
- The gauge is shown three more times in the HUD: a row of drops, a stamp chip with text, a fever rail.
- Lives are three page icons in the corner: unrelated to anything on the board.
- Overflow is a lime ellipse and a banner that says so.
- The stamp is a key prompt; its effect (fever) is a banner and a rail.

## Options

**A. Plumbing.** The board has pipes; misses spill ink into drains, ink runs along pipes to a central tank with a pressure dial; a release valve is the power move; overflow is a burst pipe.
- Flow: strong. Pressure: dial is a symbol, not physical. Lives: still need an icon. Fits the look: poorly (machinery, not paper and ink). Verdict: reads, but adds a new vocabulary (valves, dials) that itself needs explaining.

**B. Tide on the board.** The board is a tray; ink level rises across it like water; overflow spills over the rim.
- Flow: weak (ink appears from nowhere). Pressure: strong (a level). Readability cost: ink covers the lanes the player must read. Verdict: kills the main verb's clarity.

**C. The character is the tank, the lanes are the channels, the board is the page.** A missed note IS the ink: it turns lime, slips through the target ring and runs along its own lane into the character, who is a glass inkwell with visible ink inside. Pressure is the character swelling, cracking and leaking. Overflow pops his lid and floods every lane outward over the board (the page). Lives are the physical stack of sheets the board sits on: a ruined sheet lifts away and the stack gets thinner. The stamp is the character slamming down, spraying his ink out along the lanes onto the notes; his ink level then drains as the fever timer.
- Flow: strong and continuous (miss, lane, character, and back out on a stamp). Pressure: physical (level, swelling, cracks, drips). Overflow: shown as flooding. Lives: the sheets are the place the ink lands, so cause and cost connect. Stamp: one object, one gesture. Fits the look: yes. Removes: drop row, stamp chip, fever rail, page icons, ink hint plates, banners.

**D. The pen.** The character is a hovering pen that writes the lane colours as you hit; misses are blots on its page; stamp is a flourish.
- Flow: weak, and it turns the player's hits into the pen's work, which muddies who is doing what. Verdict: rejected.

**E. Hybrid of C and a visible leak pen.** C plus a pen hovering above the character that drips into his lid once the well is over half, with the drop growing at the nib before it falls so the leak is seen coming.

## Choice
C with E's leak pen. It is the only option where each thing the ink touches is something the player is already looking at (the note they missed, the lane it travelled, the character they rely on, the page they are playing on), and it removes the separate HUD objects entirely.

## Test (no words)
Storyboard frames with every piece of text hidden. For each: what does a stranger conclude? The design passes when each frame can be described correctly in one plain sentence, in order: a note is missed; it becomes ink; the ink runs to the character; he fills; he strains; he spills and the page is ruined and gone; or he is full enough to glow, is struck, and blasts the ink back out onto the notes while he drains. Anything that needs a caption to be understood gets redesigned.

## Iteration log (what I built, what the storyboard showed, what I changed)
Method: scripted captures (`story.mjs`) of the real build at fixed intervals, cropped to contact sheets, read with all prompts ignored. Sequences filmed: a miss; the fill ladder up to a spill and the peel; the stamp at 50 ms spacing; the fever drain; the loss.

- **v1** (creature as tank, lanes as channels, sheets as lives): the flow read immediately (a missed note becomes a lime streak that runs along its own lane into the creature). Failures: the creature was a dark box among four rings (no visible level), the stack of sheets was thin white lines, hint plates and the HUD drops were gone but nothing yet explained the stamp.
- **v2**: enlarged the middle of the board (ring 140x58 to 185x80), lighter glass so the ink reads inside it, thicker sheets. Still too small.
- **v3**: ring 200x100 (true 2:1) and the creature scaled to fit the gap between the targets. The fill ladder now reads in order: ink arrives, the level climbs past the mark on the glass, bubbles, cracks, ink over the lip, then the cork pops, every lane floods outward, the whole page is stained and the ruined sheet peels away off the stack, which is one sheet thinner. This is the first version where overflow, pressure and lives are one continuous picture.
- **v4**: the "ready" cue was a flat grey disc on the floor (read as a rendering error). Replaced with a lime halo around the bottle itself. The stamp sequence (crouch, leap, slam, ink sprayed along all four lanes, lattice lit) read clearly at 50 ms spacing.
- **v5**: the print he leaves covered him; moved it under the creature. The fever drain reads as a timer with no bar: the bottle empties while the halo and lattice stay lit, then everything switches off.

## What is still weak (honest)
- I am the only reviewer and I know the rules, so "reads without words" is my judgement, not a stranger's. Slone's first play is the real test; the questions are on the feedback sheet.
- The cork-and-bottle strain (bulge, rattle) is animated, so stills undersell it; the cracks and lip drips are the still-visible pressure cues.
- The leak (ink creeping up by itself from the third set) is shown only by bubbles and a crack flash; if it is not understood it should become a more explicit visible source.
- Tidy-set page restore (a sheet sliding back under the board) is implemented but was not captured in a storyboard.

## What was removed
The drop row, the stamp chip with text, the fever bar, the page icons, the danger frame, the PAGE RUINED and FEVER banners, the ink hint plates, the little flying drop and the floor splats.
