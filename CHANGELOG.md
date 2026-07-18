# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-18

### Added

- Hub-authoritative Arena statistics for kills, deaths, damage dealt, damage taken, and collected pickups.
- A synchronized Arena event feed for round starts, item pickups, eliminations, zombie defeats, wave milestones, and player departures.
- Seed-driven Arena randomness for item placement, zombie archetypes and statistics, spawn edges, reward drops, and entity identifiers.
- Final-round personal statistics on the Arena result screen.
- A dependency-free `pnpm check` command that syntax-checks source, scripts, and test files.
- Regression coverage for deterministic simulation, damage accounting, state snapshots, duplicate user collection, event-feed accessibility, listener cleanup, and safe Pong labels.

### Changed

- Extracted deterministic random generation and Arena state serialization/reconciliation into dedicated modules.
- Centralized player damage, armor absorption, elimination, death counting, and damage-taken accounting in one simulation primitive.
- Zombie bites now use the same armor-aware damage pipeline as player projectiles and publish immediate authoritative hit feedback.
- Arena scoreboards rank by kills, survival, and damage, and expose damage and pickup totals in row details.
- Arena HUD and scoreboard DOM updates now avoid rewriting unchanged content every animation frame.
- Arena startup now resets all transient round state and deduplicates the participant list before generating spawn points.
- The local example and Playwright suite now load Reveal.js from the pinned development dependency instead of an external CDN.
- Upgraded Vite to 8.1.5 and moved production minification to Vite's current default pipeline, removing the vulnerable legacy esbuild toolchain.
- Removed the redundant npm lockfile; the enforced pnpm workflow now has one authoritative dependency lock.
- Removed the redundant direct Playwright dependency; `@playwright/test` remains the single test-runner dependency.

### Fixed

- Removed the phantom extra spawn slot caused by counting the local user twice during map generation.
- Removed stale end-screen key listeners after a click closed the result screen, preventing interference with later rounds.
- Prevented duplicate Hub-local hit flashes when authoritative hit events were echoed locally.
- Prevented repeated zombie bites after the first bite had already ended a survival run.
- Rendered Pong usernames with DOM text nodes rather than HTML, closing the remaining username markup-injection path.
- Removed dead imports, an unused username generator, no-op event handling, and verbose production initialization logs.
- Removed intermittent toolbar-test failures caused by transient jsDelivr availability.

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
