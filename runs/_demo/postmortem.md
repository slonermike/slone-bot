# Post mortem: Demo Ball
This is the scaffold's smoke-test prototype, not a nightly build. It exists to prove input, sim, render, audio, telemetry, bots, manifest, and launcher work end to end, and it has been revised once from Slone's first play.
What shipped: push a ball with the stick, dash with a button, collect sparks. Pressure comes in layers over a run (heat timer, then drifters at 25s, fading sparks at 55s, closing walls at 90s). Three failures end the run, with a result screen and instant restart. Each failure restarts the heat ramp.
Measured (bots, sim only): a greedy bot reaches all four layers and loses its last life at about 3.5 minutes; idle, random, and corner-camping bots end within about 40 to 50 seconds.
Believed (labeled, I cannot play or hear it): the failure crunch and the layer stings should read clearly; the pacing of the layers is a guess to check against your play.
