# ROADMAP (deferred; do not build yet)

Deliberately postponed. Revisit only when the current pipeline is proven.

## Feedback
- In-launcher feedback form on the Deck, with dictation via the Steam on-screen keyboard (test a text box first).
- Commit-to-repo feedback endpoint (serverless function, single-writer token held only in host env vars, rate limit, payload cap).
- Voice notes with later transcription.
- Event-driven feedback hook: a webhook that fires the processing task when feedback lands. Today feedback is processed in Slone's chat.
- **External feedback API:** since the project is open source and shareable, other people may eventually play and respond. Needs an API, storage, abuse handling, and a clear privacy stance. Keep a `source` field in feedback JSON so adding other testers does not need a migration. Feedback stays in chat until then.

## Platform
- **3D track:** Three.js with Rapier 3D. Add after the 2D scaffold is stable. Taste favors 3D traversal (Tony Hawk, OoT, GTA-style).
- **Local Steam Deck sync app:** pulls built artifacts (not toolchains) from CI, caches the last good build, presents the launcher offline. Optional wrapper over the hosted site.
- Iframe embedding in the launcher (test gamepad focus quirks on the Deck first). Default is navigation with a reserved return combo.
- Archive old prototype folders to cheap object storage with the manifest pointing at them.

## Safety and tooling
- **Encrypted theme tool:** compiled binary from a separate repo, rejection reasons encrypted to a public key so only Slone can decrypt, no read path for hidden data in the CLI. Replace `scripts/themes.mjs` with a drop-in binary with the same commands. Triggered if logs show runs peeking or rejection reasons visibly bias nights. Pin the binary SHA-256; log every call.
- Novelty gate as a separate agent that sees briefs and the ledger. Start with ledger-only checks in the brief.
- Ideation agent that is separate from the build agent (greenfield ideator, builder gets only the approved brief).
- Quota monitoring: no tool for reading usage was found. Revisit if one appears.

## Content
- Music library or procedural music engine.
- Slone's SFX library if he supplies one.
- Automated similarity metric across briefs (compare embeddings or tag overlap) to measure homogenization.

## Metrics and analytics (agent-readable)
Goal: the agent can see how builds are actually played and learn from it, beyond bots and Slone's chat replies.
- **Privacy-friendly analytics**, opt-in and documented: for example a lightweight self-hostable or privacy-focused service (Plausible, Umami, GoatCounter, PostHog, or similar; verify current options and licenses at decision time). Avoid anything that needs personal data or consent banners the Deck cannot handle.
- **Event tracking from the scaffold:** a `track(event, props)` hook (a no-op stub exists from day one) fed by sim events and session lifecycle: session start/end, play time, restarts, quit moment, deaths, pressure peaks, which juice layers were toggled, which cards were launched.
- **Agent access:** a read-only export or API the nightly run can query at start (aggregates only, no raw personal data), summarized into the run log and used in the brief ("last night, sessions ended at the first tide spike").
- **Replace local play history** with, or mirror it to, the analytics store. Return behavior is a stronger signal than stated opinion.
- **Constraints:** prototypes are currently offline with no outbound calls. Adding analytics changes that; it must be opt-in, off by default in the repo, and documented in `README.md`. Never send device identifiers or IPs to the agent.
- **Open source note:** analytics keys and endpoints stay out of the repo (host env vars only).

## Adjacent assets repo
Optional shared repo for CC0 and CC-BY packs, with its own `ATTRIBUTION.md`. Create only when Slone asks. See `docs/tech/08-open-source-and-assets.md`.

## Graduating a prototype
A prototype Slone wants to turn into a full game gets copied into its own repo (not built here). Keep prototypes self-contained to make this easy: assets and attribution travel with the folder.

## Contribution policy
Outside PRs are not accepted for now. Revisit after seeing what people try (the `external-pr` label tally). Possible later paths: accept docs fixes and asset corrections, accept scaffold bug fixes with human review, or open a "community prototypes" lane. Any path needs a human-reviewed process; unattended agents never merge outside code.
