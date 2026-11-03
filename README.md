# Neon Rival

A TypeScript and Phaser 3 fighting-game foundation. The arcade prototype includes local versus, training, character selection, an arcade menu, and private online rooms, using a shared fixed-step combat simulation. The earlier standalone prototype remains in `dist/`.

## Requirements

- Node.js 22.13 or newer
- pnpm 11.25 (enable with `corepack enable`, then `corepack prepare pnpm@11.25.0 --activate`, or install pnpm using its official instructions)

## Install and run locally

From the project root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Replace the placeholders with development values before starting.
pnpm dev
```

Open the URL printed by Vite. In a second terminal, start the multiplayer server:

```sh
pnpm dev:server
```

The server exposes `GET /health` and WebSocket rooms at `/ws`. During development Vite proxies `/ws` to the server using `SERVER_HOST` and `PORT`. The client defaults to this same-origin proxy route, so no local server URL is embedded in the frontend. `ALLOWED_ORIGINS` can restrict development origins; when omitted, the development server accepts any origin. For a same-network test, bind Vite and the game server to reachable interfaces with `VITE_DEV_SERVER_HOST` and `HOST`, and set `SERVER_HOST` to the address Vite should use for the server:

```sh
pnpm dev
```

For remote play, configure `VITE_WS_URL` as the public `wss://` endpoint at build time, or route the frontend's same-origin `/ws` path through a TLS reverse proxy to the Node server. The server can also terminate TLS directly when `TLS_CERT_FILE` and `TLS_KEY_FILE` point to a certificate and private key. Set `ALLOWED_ORIGINS` to the exact public web origins (comma separated); production startup fails if this value is missing. HTTPS browser clients must use secure WebSockets (`wss://`).

## Production build and server start

Set production values in `.env`, including `NODE_ENV=production`, `PORT`, `HOST`, and `ALLOWED_ORIGINS`. Set `VITE_WS_URL` to the public secure WebSocket endpoint when it differs from the same-origin `/ws` route. The Vite build reads `VITE_*` values at build time.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start:server
```

`pnpm build` type-checks the workspace, writes static frontend files to `build/client/`, and compiles the multiplayer server to `apps/server/build/index.js`. `pnpm start:server` starts the compiled Node server and reads `.env`; it is the production multiplayer-server command. Serve `build/client/` from a static host or reverse proxy and forward `/ws` upgrades to the server. `pnpm preview` serves the production client build locally using `VITE_PREVIEW_HOST` and `VITE_PREVIEW_PORT`.

The server limits WebSocket payloads to 2 KiB, client messages to 120 per second, concurrent connections to `MAX_CONNECTIONS` (default 200), and rooms to 100. It disables per-message compression, closes unresponsive connections, applies handshake and HTTP timeouts, and logs structured connection, room, origin-rejection, and shutdown events without logging recovery tokens. `GET /health` returns a small no-cache JSON status response. TLS can be terminated by the Node server or by the reverse proxy in front of it.

The room uses a server-authoritative simulation and sequence-numbered inputs. It measures round-trip latency and interpolates rendered positions with a short buffer; this smooths jitter but does not implement rollback or client prediction, so high latency still delays actions. In online play both players use Player 1's **W/A/S/D + F/G/R/T** controls on their own devices. A disconnect pauses the match for up to 30 seconds; the same browser tab can automatically reconnect or recover after a refresh with its private, tab-scoped token. Both players must request a rematch. Rooms and recovery tokens live only in server memory: restarting the server, closing the tab, leaving the room, or expiry loses the session. The host must keep the server running. There are no accounts, database, ranked matchmaking or persistent room storage.

## Verify and build

```sh
pnpm test        # simulation and WebSocket room integration tests
pnpm typecheck   # check client, server, and shared packages
pnpm build       # type-check and build client and server
pnpm build:client # build only the browser client
pnpm build:server # build only the multiplayer server
pnpm preview     # serve the production client build locally
pnpm start:server # start the compiled multiplayer server
```

`build/` is generated and ignored. The previous prototype in `dist/` is deliberately preserved and is not overwritten by these commands.

The simulation in `packages/simulation` is plain TypeScript with no Phaser or browser dependency; Phaser renders its state. Menu framework selection is deferred until menus need it. The planned scope and milestones are in `plan.md`.

## Local versus controls

- Player 1: W/A/S/D move, jump and crouch; F punch, G kick, R special, T super.
- Player 2: arrow keys move, jump and crouch; J punch, K kick, I special, O super. This layout works without a numpad.
- Hold down with punch for a crouching punch or with kick for a sweep; standing kick always uses the standing kick. Holding down alone crouches in place.
- Hold away from the opponent to block; hold down and away against low attacks. Tap toward an incoming high attack or down for a low parry. Double-tap left or right to dash; press down before jump for a high jump.
- Cancel a landed normal into special or super. Super costs a full meter; damaging and receiving hits builds meter. Heavy hits cause a temporary knockdown. First to two rounds wins. P or Escape opens the fight pause menu; resume or restart there. Both fighters can be selected in Training → VS Computer / VS Player.

This is a simplified, original interpretation: fighters use simplified inputs and the training CPU uses a basic approach, defend and attack routine. Damage, timing, and moves are prototype values, not an exact recreation of the original game.

## Mechanics research

The design draws on descriptions of dashing, high jumps, Super Arts, and directional parries in [Street Fighter III: New Generation](https://streetfighter.fandom.com/wiki/Street_Fighter_III:_New_Generation), and on [Street Fighter III gameplay](https://strategywiki.org/wiki/Street_Fighter_III/Gameplay) for blocking and low/high defensive concepts. The project includes character animation frames from third-party and user-supplied Street Fighter sprite sheets.

## Presentation and assets

The arena background is drawn once, while fighters, HUD, and short-lived effects update during play. The simulation emits frame-stamped attack, hit, block, parry, knockdown, round-end, and match-end events; the client uses those events for impact visuals and audio without moving combat logic into Phaser. The effects and simple background loop are synthesized original placeholders, enabled by the sound button. Ryu, Elena, Gill and Dudley use frames extracted from user-supplied sprite sheets; Ken uses red-recolored frames from a Ryu fan character. Original audio and exact character-specific move data are not included. Online rooms use a server-authoritative 60 Hz simulation over WebSockets. This prototype has no rollback, prediction, accounts, ranked matchmaking or database. Latency can make controls feel delayed; it is not production-hardened.

## Arcade menu

Choose Local Versus or Training, then select Elena, Gill, Ryu, Ken, or Dudley. Training gives the second player a stationary, replenishing practice dummy. Online Rooms creates or joins a six-character private room; both clients must reach the same Node server. Settings enables the generated music and effects. Press Escape or click the menu button to leave a match.

## Street Fighter III character preview

Ryu's animation frames come from the user-supplied New Generation sheet. Ken still uses a red recolor of Ryu frames from [a Third Strike MUGEN character](https://github.com/Tatayecorp/demo_mugenJS/tree/master/chars/SF3_Ryu), with separate timing data; they are not Ken's original frames. Both use a simplified Hadoken and full-meter Shinku Hadoken-inspired projectile. Dudley has a boxing style with a jab, body blow, advancing Machinegun Blow and Corkscrew Blow-inspired super; these are simplified single-hit prototype moves, not the original frame data or complete move lists. [Dudley move reference](https://arcade-fighter.com/af/guias/saga-street-fighter-iii/sfiii-dudley.php). `scripts/extract-ryu-dudley.py` can rebuild their atlases from the supplied sheets with Pillow and NumPy. Street Fighter characters and artwork are Capcom properties.

## Elena and Gill

Elena uses capoeira-inspired kicks, a simplified advancing Rhino Horn special and a simplified Brave Dance super. Gill has a Pyrokinesis fireball and a stronger charged projectile as a prototype super. The charged projectile is an invention for this prototype, not Gill's New Generation Super Art; his Resurrection is not implemented. Each move uses one button and simplified damage, timing and hit behavior rather than the original game's command inputs or frame data.

Selected animation frames for Elena and Gill were extracted from the user-supplied Street Fighter III: New Generation sheets. Their sprite artwork and characters are Capcom property; permission for public redistribution has not been verified. `scripts/extract-supplied-sprites.py` documents the selected frames and can rebuild the atlases from those source sheets with Pillow and NumPy. Sources for character details: [Elena's New Generation move list](https://www.arcade-fighter.com/af/guias/saga-street-fighter-iii/sfiii-elena.php), [Gill's New Generation move list](https://thefightinggames.com/street-fighter/street-fighter-3-new-generation/gill) and [Gill's series history](https://streetfighter.fandom.com/wiki/Gill).

Fighter traits, movement, damage, frame timings and move behavior are declared in `packages/simulation/src/content/fighters.ts`, shared by the browser and room server. The internal `kai` and `vex` identifiers remain for compatibility with existing room messages. Animation atlases and timing maps live under `apps/client/public/assets/sf3/` and are separate from combat logic.

## Character portraits and versus screen

Selection and pre-fight screens use the four portraits supplied through the user's image links and [Dudley artwork](https://www.fightersgeneration.com/nf8/char6/dudley-streetfighterIII-newgeneration-artwork.jpg) from The Fighters Generation. Gill and Elena portraits are from [The Fighters Generation](https://www.fightersgeneration.com/); Ryu and Ken are from the supplied Google image thumbnails. Street Fighter characters and associated art belong to their respective rights holders; permission for redistribution has not been verified. The two players' character names, portraits and styles appear before a local match, and the online room server holds the simulation for a short synchronized introduction.

Stance animation clips are extracted with `scripts/extend-stance-animations.py /path/to/supplied/sheets`. The reviewed clips replace mixed standing/sweep sequences; crouching does not squash the sprite. Ken uses recolored Ryu stance clips as temporary artwork. Dudley’s leg kicks remain a procedural placeholder because his supplied boxing sheet has no leg-kick animation. Elena’s standing punch-button normal retains her capoeira style; her crouching hand extension is temporary procedural artwork over the supplied guard pose.

## Public online rooms

The multiplayer server must be deployed separately from the Vercel frontend.
See [the prepared deployment and connection steps](docs/online-hosting.md).
The repository includes a one-instance Free Render Blueprint (`render.yaml`).
