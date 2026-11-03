# NEON RIVAL — development plan

## First release: small and finishable

Build a browser-based, original two-player arcade fighter inspired by the pace and defensive choices of classic 2D fighters. The first release has **two original fighters, one stage, local versus play, and online private rooms**. Both fighters may share a base move set with different appearance and tuning. Each has a punch, kick, one special, one super, block, and a short-window parry. A match is best of three rounds.

The existing canvas prototype is a reference for presentation and controls, not the foundation for online combat. Replace its combat loop incrementally with a shared deterministic simulation and Phaser 3 presentation. Preserve the prototype until the new slice is playable.

**Out of scope for v1:** accounts, ranked matchmaking, databases, public matchmaking, spectators, replays UI, tournament systems, additional stages, and a large roster. Online rooms are ephemeral and created by an invite code; a server restart ends active rooms. No persistent player data is required. Expand scope only when a concrete need emerges.

## Technical baseline

- TypeScript monorepo: Phaser 3 browser client, pure shared combat simulation, shared protocol, Node.js match server.
- Combat advances at a fixed 60 ticks per second. The simulation owns all match-affecting state, including move frames, collision boxes, input history, meter, and round state. Phaser renders state and never decides hits.
- Online play uses frame-numbered inputs and bounded rollback with a small configurable input delay. Start with WebSocket relay; measure latency and loss before considering WebRTC. The server verifies confirmed inputs by running the shared simulation and owns official match results.
- Fixed-point or integer simulation values, explicit state snapshots, seeded randomness if needed, and stable collision ordering support deterministic replay. Version the simulation, content, and protocol together.
- Static client hosting and a separate long-running Node WebSocket service are required. The current static Site alone cannot run the match server. Deployment provider and operating costs remain to be selected when the online prototype is proven.

Expected paths below are a proposed structure. Files may be split as implementation clarifies responsibilities; each milestone lists the main expected changes rather than an exhaustive inventory.

## 1. Project setup

**Features**

- Initialize a TypeScript workspace with client, server, simulation, and protocol packages; configure a Phaser 3 client and a minimal Node service.
- Add local development, build, type-check, and test commands. Keep prototype files intact during migration.
- Establish a shared fixed-step simulation API, initially with a minimal state, and a Phaser scene that renders it.

**Expected files**

- `package.json`, workspace configuration, `tsconfig.base.json`, `.gitignore`, `README.md`
- `apps/client/package.json`, `apps/client/src/main.ts`, `apps/client/src/scenes/FightScene.ts`
- `apps/server/package.json`, `apps/server/src/index.ts`
- `packages/simulation/src/index.ts`, `packages/protocol/src/index.ts`

**Dependencies**

- None. Tooling: Node.js, a workspace-capable package manager, TypeScript, Phaser 3, and a test runner.

**Acceptance criteria**

- A fresh checkout can install dependencies and run the documented client and server commands.
- Type checking, tests, and production builds complete successfully with one documented command each.
- The browser displays a placeholder arena driven by the shared simulation; the Node process starts and shuts down cleanly.
- The existing prototype remains available until the replacement is playable.

## 2. Core combat

**Features**

- Two fighter states, movement, facing, jump, crouch, stage boundaries, and character pushboxes.
- Data-driven startup, active, and recovery frames; punch, kick, special, and super; hitboxes and hurtboxes; hit and block stun; health and meter.
- Directional blocking, a configurable parry window, hitstop, round timer, and best-of-three match result.
- Input buffering and snapshot/restore of all match-affecting state. Add a developer overlay for hitboxes and frame numbers.

**Expected files**

- `packages/simulation/src/{state,step,input,collision,combat,match}.ts`
- `packages/simulation/src/content/{fighters,moves}.ts`
- `packages/simulation/test/{combat,determinism}.test.ts`
- `apps/client/src/{input/controls,scenes/FightScene,debug/CombatOverlay}.ts`

**Dependencies**

- Milestone 1. No networking required.

**Acceptance criteria**

- Two players can move and complete a local best-of-three match; health, meter, timer, and round wins update correctly.
- Automated tests cover attack startup/active/recovery, hit versus block, parry timing boundaries, meter costs, and round completion.
- Given the same initial state and input sequence, browser and Node produce identical state hashes across a recorded match; restoring a snapshot and replaying inputs yields the same result.
- Hitboxes and frame numbers can be toggled for inspection and do not affect simulation state.

## 3. Fighter animations and stage

**Features**

- Add original placeholder or finished art for two fighters and one stage; animate idle, movement, jump, attack, block, parry, hit, and defeat.
- Map simulation action and action frame to sprite frames. Add basic hit sparks and screen feedback that do not influence gameplay.

**Expected files**

- `apps/client/src/{scenes/FightScene,render/FighterView,render/Effects}.ts`
- `apps/client/public/assets/{fighters,stage,effects}/`
- `packages/simulation/src/content/fighters.ts` if animation identifiers need to be declared

**Dependencies**

- Milestone 2. Original or appropriately licensed assets.

**Acceptance criteria**

- Every implemented combat action has a visible animation and correct facing; both fighters remain distinguishable.
- Animation or browser render-rate changes do not alter attack timing or hit detection.
- During simulated rollback, a repeated frame does not produce duplicate persistent effects; the visual state follows the corrected simulation.
- The stage and fighters fit the supported desktop and mobile viewport sizes without hiding the health bars.

## 4. Local playtesting and tuning

**Features**

- Add keyboard mappings for two players, configurable controls, pause, restart, and a short on-screen controls reference.
- Tune movement, damage, hitboxes, parry window, and super meter against a small set of documented playtest scenarios.
- Add deterministic input-recording fixtures for automated regression tests; these are development tools, not a public replay feature.

**Expected files**

- `apps/client/src/{input/controls,ui/PauseMenu,ui/ControlsHelp}.ts`
- `packages/simulation/src/content/{fighters,moves}.ts`
- `packages/simulation/test/fixtures/`, `docs/playtest-notes.md`

**Dependencies**

- Milestones 2 and 3. Two local testers or an equivalent scripted test pass.

**Acceptance criteria**

- Two players can complete and restart a match on one keyboard with no conflicting default bindings.
- Pause stops simulation time; resume continues from the same state. Remapped controls survive a page reload using browser-local storage.
- Test fixtures reproduce the same outcomes after tuning, and reported blocking, parry, collision, or stuck-state defects have a recorded resolution.
- A short playtest confirms that each fighter can move, defend, attack, build meter, and win a round.

## 5. Online private matches

**Features**

- Create and join an ephemeral two-player room with an invite code; negotiate game/content versions and a shared start frame.
- Implement client-side prediction, snapshot history, rollback and resimulation, configurable input delay, frame-numbered input messages, and confirmed-frame tracking.
- Node server validates room membership, message size, input values and frame ranges; relays inputs, runs the shared simulation on confirmed inputs, and determines the match result.
- Display connection state, latency and rollback count. Define timeouts, disconnect/forfeit behavior, maximum prediction window, and desync handling. No account or database.

**Expected files**

- `apps/client/src/network/{OnlineSession,RollbackController,InputBuffer}.ts`
- `apps/server/src/{rooms,match,connection,validation}.ts`
- `packages/protocol/src/{messages,codec,version}.ts`
- `packages/simulation/src/{snapshot,hash}.ts`
- `apps/server/test/`, `apps/client/test/network/`, `docs/networking.md`

**Dependencies**

- Milestones 1, 2, and 4; a WebSocket implementation and a reachable Node server. Animation work from milestone 3 should be integrated before visual rollback testing.

**Acceptance criteria**

- Two separate browsers can create/join a private room, finish a best-of-three match, and see the same winner and final confirmed state.
- Automated rollback tests inject delayed, corrected, duplicate, and out-of-order inputs and verify that confirmed states converge with a no-delay baseline.
- A network test with 100 ms round-trip latency, 30 ms jitter, and 1% packet loss completes a match without a permanent desync; record rollback frequency and visible corrections rather than promising identical feel on every connection.
- A missing input beyond the configured prediction window follows a documented pause, recovery, or termination policy. A disconnect or backgrounded/stalled client produces a clear status and a deterministic timeout outcome.
- Invalid room codes, incompatible versions, invalid messages, and confirmed-frame hash mismatches produce clear errors; mismatches are logged and cause a controlled resync or match termination.
- Server tests verify that a client cannot choose its opponent's inputs or directly submit a health value or winner.

## 6. Menus and match flow

**Features**

- Add title screen, local/online mode choice, create/join room flow, controls/help, pause and results screens, and rematch or return to menu.
- Use accessible labels and keyboard navigation; show online connection and error states.

**Expected files**

- `apps/client/src/scenes/{TitleScene,RoomScene,ResultsScene}.ts`
- `apps/client/src/ui/{Menu,ControlsHelp,ConnectionStatus}.ts`
- `apps/client/src/main.ts`, `apps/client/public/index.html`

**Dependencies**

- Milestones 4 and 5. Menu layout can begin earlier, but online actions require milestone 5.

**Acceptance criteria**

- A player can navigate from title to a local match and back, and from title through room creation/joining to an online match and back.
- Rematch resets health, meter, timer, round wins, input buffers, and online session state for both players.
- All menu actions work with keyboard and pointer, have visible focus, and show actionable connection errors.

## 7. Character selection

**Features**

- Choose either of the two original fighters before a local or online match; allow mirror matches.
- Choose one available super per fighter for v1; keep the selection data model extensible without implementing a larger move roster.
- Lock and exchange selections before the online start handshake.

**Expected files**

- `apps/client/src/scenes/CharacterSelectScene.ts`
- `packages/simulation/src/content/{fighters,moves}.ts`
- `packages/protocol/src/messages.ts`, `apps/server/src/match.ts`
- `apps/client/public/assets/portraits/`

**Dependencies**

- Milestones 3, 5, and 6.

**Acceptance criteria**

- Both players can select either fighter in local and online modes, including the same fighter, with clearly distinguishable colors or markers.
- The match starts with both selections reflected in the simulation, HUD, and visuals on both clients.
- Invalid or unavailable selections are rejected by the server; incompatible content versions cannot start a match.

## 8. Sound

**Features**

- Add original or properly licensed menu, attack, hit, block, parry, round, and victory sounds, plus one optional stage music loop.
- Add separate music and effects volume controls and mute; initialize audio after a user gesture.
- Deduplicate rollback-triggered sounds using simulation event identifiers or a confirmed-event policy.

**Expected files**

- `apps/client/src/audio/AudioManager.ts`, `apps/client/src/ui/SettingsMenu.ts`
- `apps/client/public/assets/audio/`, `docs/asset-credits.md`
- `packages/simulation/src/events.ts` if stable event identifiers are needed

**Dependencies**

- Milestones 3 and 6; milestone 5 for rollback sound verification. Licensed or original audio assets.

**Acceptance criteria**

- Sound starts after a user gesture, and music and effects can be muted or adjusted independently; settings persist locally.
- Normal attack, hit, block, parry, and round-end events produce the intended cues.
- A forced rollback does not repeatedly play the same confirmed sound event, and muting never changes game state.
- Asset sources and licenses are recorded.

## 9. Deployment

**Features**

- Publish the built client to static hosting and deploy the Node WebSocket service to a suitable persistent host in one initial region.
- Configure HTTPS/WSS, environment-based service URL, health checks, basic structured logs, and a documented release/rollback procedure.
- Set room expiration, message limits, origin checks, and rate limits appropriate for a small private-room launch.

**Expected files**

- `apps/client/src/config.ts`, `apps/server/src/{index,health,config}.ts`
- Deployment configuration selected for the chosen hosts, `.env.example`, `docs/deployment.md`
- `.openai/hosting.json` only if the current Sites client deployment remains the selected static host

**Dependencies**

- Milestones 5–8, a public HTTPS client host, a reachable persistent Node host supporting WSS, and any required hosting credentials or budget. Select providers only after measuring the online prototype.

**Acceptance criteria**

- A clean production build is deployed over HTTPS; two browsers on separate networks can create/join a room over WSS and finish a match.
- Health checks detect an unavailable service, and logs identify room creation, disconnects, and desyncs without recording sensitive data.
- The documented release and rollback steps are exercised once in a test environment; secrets are supplied through host configuration, not committed.
- Room expiry and rate/message limits are verified, and hosting costs and operational ownership are documented.

## 10. Final QA and release

**Features**

- Run a release-candidate pass across combat, controls, menus, character selection, sound, local play, online play, and deployment.
- Test supported desktop browsers and at least one mobile browser; document supported devices and limitations. Touch controls are required for mobile local play only if included in the release UI; do not promise two-player touch play on one device without testing it.
- Resolve release-blocking issues and write a short player guide and known-issues list.

**Expected files**

- `docs/{qa-checklist,known-issues,player-guide}.md`
- Relevant client, server, simulation, and test files for fixes
- `README.md`

**Dependencies**

- Milestones 1–9. Two testers and access to separate networks and supported browsers.

**Acceptance criteria**

- The documented supported browsers complete a local match; two supported browsers on separate networks complete an online match and rematch.
- Keyboard navigation, remapping, pause, sound settings, character selection, and error messages pass the checklist; any mobile controls shown are usable on the tested device.
- Combat regression, determinism, rollback, server validation, type-check, and production-build checks pass on the release candidate.
- No open release-blocking crashes, permanent desyncs, stuck matches, or incorrect winners remain. Known non-blocking issues and supported platforms are documented.
- A fresh user can start a match using the player guide without developer assistance.

## Milestone order and first implementation step

Work in the order above, keeping each milestone independently reviewable. After milestone 1, build only enough combat and presentation to prove the local vertical slice. Introduce rollback and online play after deterministic local behavior is verified. Menus and selection can be sketched earlier but should not expand the first release.

**Next implementation step:** milestone 1 only—set up the workspace, a minimal shared fixed-step simulation, a Phaser placeholder scene, and a Node service. No implementation is included in this plan.
