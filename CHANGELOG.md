# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-18

### Added

- Five selectable Arena character archetypes: balanced Vanguard, rapid Scout, armored Guardian, precise Ranger, and item-specialist Engineer.
- Per-character starting loadouts, health and armor caps, body sizes, movement, damage, fire-rate, pickup-range, and item-duration traits.
- Six new Arena pickups: MED+, SHIELD, HASTE, AMP, MAGNET, and REGEN, alongside the existing healing, armor, and weapon drops.
- Weighted item spawning, larger concurrent item pools, class-aware pickup ranges, and expanded zombie-wave rewards.
- Distinct character silhouettes, class glyphs in the lobby and Arena, active-effect indicators, and an expandable in-game item legend.
- End-to-end tests for character normalization, class stat construction, timed effects, regeneration, item weighting, profile persistence, and Hub-side class validation.

### Changed

- Arena player construction is now driven by a centralized, extensible character configuration instead of fixed player constants.
- The Hub synchronizes complete character, loadout, health-cap, armor-cap, collision-radius, and timed-effect state to every visitor.
- Movement bounds, wall resolution, projectile origins, hit detection, zombie bites, health rings, and armor rings now respect each character's dimensions and caps.
- Arena HUD and scoreboard now expose character roles, weapons, and active timed effects.
- User profiles now include a persisted Arena character selection and propagate it through the Hub-owned user list.

### Fixed

- Escaped usernames consistently in lobby lists, message-target controls, chat history, and Arena scoreboards.
- Normalized locally stored usernames, colors, and Arena character values before they enter the PeerJS network path.
- Closed a prototype-property edge case in Arena character validation.
- Isolated Playwright from live watch rebuilds so long e2e runs always serve one immutable production bundle.
- Blocked static development-server paths that resolve outside the project root.

### Security

- Arena archetype identifiers are allow-listed by the Hub; unknown or forged class names fall back to Vanguard.
- Character-derived combat values remain Hub-owned and cannot be supplied through movement or shooting commands.

## [1.1.0] - 2026-07-18

### Added

- Versioned Hub-authority envelopes with a Hub ID, per-process epoch, and monotonic sequence number.
- Explicit session IDs and lifecycle validation for polls, Pong matches, and Arena rounds.
- Session-scoped Pong invite, accept, decline, state, movement, score, and terminal routing through the Hub.
- Arena leave and cancellation events so manual exits and disconnects cleanly update the authoritative simulation.
- End-to-end coverage for forged identities, direct-peer injection, stale and out-of-order messages, Hub epoch rollover, wrong-session commands, game termination, and local-state reconciliation.

### Changed

- Visitors now accept authoritative poll and game traffic only from the active Hub connection.
- The Hub derives peer identity from the PeerJS connection instead of trusting caller-supplied IDs, names, colors, or ownership fields.
- Arena visitors reconcile their own predicted position and the complete participant set from Hub snapshots.
- Arena movement and shooting commands are bounded and validated against Hub-owned player and weapon state.
- Pong followers consume ordered challenger snapshots instead of advancing an independent ball simulation.
- Poll aggregation validates allowed answers, removes duplicates, and enforces single-choice semantics.
- The production ES module artifact is now emitted as `dist/reveal-peerjs.es.js`, matching package metadata.

### Fixed

- Prevented non-Hub peers from injecting authoritative state directly into visitors.
- Prevented stale state from an earlier Hub process or game session from overwriting current state.
- Prevented Arena teleport commands, forged weapon statistics, shoot-rate bypasses, and duplicate Hub-local bullet bursts.
- Prevented high-speed Pong balls and Arena projectiles from tunnelling through paddles, players, or zombies.
- Removed departed Arena players and their bullets from the authoritative round state.
- Closed active Pong and Arena sessions when a player, Hub, page, or plugin instance exits.
- Removed the development-server startup race that could serve the example before the plugin bundle existed.
- Replaced deprecated URL parsing and unsafe shell-based child-process invocation in the development server.

### Security

- Bound chat, private-message, profile, poll, Pong, and Arena identities to the active PeerJS connection metadata instead of caller-supplied fields.
- Sanitized user names, colors, and chat payload lengths at the Hub trust boundary.

## [1.0.0] - 2026-06-17

### Added

- Initial Reveal.js collaboration plugin with PeerJS lobby discovery, public and private chat, Hub controls, polls, Pong, Arena, accessibility settings, and Playwright end-to-end tests.
