# 00 The Bible (READ-ONLY during nightly runs)

Design principles for making prototypes Slone will like. Nightly runs read and follow this file but never edit it. It changes only when Slone runs an assessment and promotes lessons from `pending-lessons.md`.

Version: 0 (seeded from six GMTK sources and Slone's taste; no feedback incorporated yet).

## 1. What a prototype is for
A prototype answers one question quickly. The big three questions: Is it fun? Is it viable? Will people like it? Our nightly prototypes mostly ask "is it fun and what does it feel like?" Slone is the only playtester, so every build must make his feedback easy and specific.

## 2. Before building: write these down
1. **The one question** this build tests.
2. **The target feeling** (a specific emotion or fantasy, e.g. "thrilling escape, then curious"). "Fun" is not a feeling. Use words like powerful, tense, crafty, sneaky, flustered, cozy, relieved.
3. **The mode:** content-driven (5 to 10 minutes with a beginning, ramp, and end) or systemic (endless loop; polish the 1 to 2 most valuable mechanics).
4. **The loop in four lines:** win state or reward, obstacle or pressure, fail state (and how it recovers), player actions. (Crazy Taxi style.)
5. **One fixed anchor:** the target feeling is the one thing that cannot change while exploring (Journey's theme of love is the model).

## 3. Core before polish, then feel
- Foundations first: if the core loop is flawed, art and polish cannot save it. Build a bare, ugly, playable core and check it is interesting.
- **Then the feel pass.** Juice and sound are part of the fun, especially for visceral games, but they amplify a working core and cannot create one. If you are adding effects to rescue a boring core, stop and fix the core.
- Do not spend time on story, names, icons, or menus before the core works.

## 4. Follow the fun, with edges
- Build, play (via bots and telemetry), and notice which part is most interesting. Ask: what happens if I cut everything else?
- Log accidents, bugs, and surprises before fixing them; some become the game (Rocket League's mid-air boost, Devil May Cry's juggle, Into the Breach's telegraphed attacks).
- The signal that a discovery is a keeper: it pulls the design toward it repeatedly, and it makes other design decisions easier.
- Edges: the target feeling is the anchor, the night is time-boxed, and the MVP is small. Exploring in every direction at once is analysis paralysis, not following the fun.
- Prefer subtraction. Ape Out and Into the Breach got better by removing what was not the point.

## 5. MDA: mechanics, dynamics, aesthetics
- Mechanics are rules and numbers. Dynamics are what players do and what the systems do in response. Aesthetics are the feelings that result.
- You can only edit mechanics. Predict the dynamics and the feelings, then check them against the target feeling.
- Name the feeling in specific words. Compare to the vision: keep what reinforces it, cut what clashes.
- **Borrowed mechanics import their dynamics and feelings.** Default mechanics (checkpoints, health bars, level-ups) quietly set tone. Before borrowing, ask why it works in its original game.
- Everything should pull the same direction: mechanics, visuals, sound, camera, UI. If one layer pulls against the target feeling, change it.
- Watch for mechanics that undermine each other (scarce ammo plus a power-move), for degenerate strategies, and for subjective responses (a score can motivate one player and feel judgmental to another).

## 6. Taste constraints (Slone)
- **Back pressure:** open-ended play with a force pushing back (rising tide, heat, a ticking clock, escalating pursuit). Without it, a sandbox goes slack.
- **Soft failure:** setbacks are recoverable and story-generating. No mastery walls, no punishment loops.
- **Discovery of new play patterns:** surprises arrive as new verbs, tools, or vehicles, not just new content.
- **Verb first, theme second:** the base verb should feel good before there is anything to do with it (Mario, Tony Hawk, GTA driving).
- **Readable systems that accumulate consequences:** the player can see the system and watch it grow or collapse (RollerCoaster Tycoon, Timberborn, The Sims).
- **Single player, self-paced, offline, controller-first.**
- Avoid gritty or violent theming. Remove the skin and judge the loop.

## 7. Game feel essentials
See `01-feel-checklist.md`. The headline rules: respond to every input within one frame, stack small effects, scale effects with impact, make sound a first-class part of the loop, and give the main verb personality.

## 8. Scope and time
- A small prototype is a feature, not a bad version of the whole game. Keep it to one core verb, one pressure source, one recovery loop.
- Prototype build effort predicts production effort. If the bare core takes most of the night, the idea is expensive.
- Introduce abilities gradually (Portal style); too many abilities at once makes constraints impossible and learning hard.
- Unforeseen interactions between systems force micro-decisions. Decide them deliberately and log them.
- Know when to stop. Prototyping is addictive. A night ends at pencils-down with an honest post mortem.

## 9. Appeal check (cheap marketing test)
Could a one-sentence headline and a 10-second clip make someone want to try it? Name the appeal type: fantasy ("I want to be this"), exploration ("I want to explore this"), toy ("I want to touch this"), challenge, comedy, nostalgia. A hook (something interesting to say about the game) plus an anchor (something familiar) helps a game land. Because Slone is the player, weigh toy appeal and discovery appeal heavily.

## 10. The agent is honest about what it cannot know
Bots can show the build works and find exploits. They cannot say whether it is fun or whether it sounds good. State this in every post mortem and ask Slone specific questions about feel.
