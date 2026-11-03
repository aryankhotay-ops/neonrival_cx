# Neon Rival QA report

Date: 3 November 2026 (Asia/Kolkata). Scope: the TypeScript/Phaser client,
shared combat simulation, Node room server, public Vercel site and Render server.

## Release verdict

**Qualified result; not a complete gameplay sign-off.** The final local automated
suite passed 43/43 tests, the menu/scene harness passed, and the production build
passed. Six reproduced combat defects and a connection cancellation race were
fixed. Throws and touchscreen fight controls are absent. Live browser-console,
visual, rendered-performance and physical-device checks remain blocked because
the browser tool reports `Local browser use is disabled in Work settings`.

Do not interpret a passing source-availability audit as a passing gameplay test
for an absent feature. The report distinguishes local corrected code from the
currently deployed backend. Deployment status is recorded at the end. Both public hosts were verified on corrected runtime revision `59db278`.

## Tests actually executed

| Area | Executed check / evidence | Result |
| --- | --- | --- |
| Automated regression | `node --import tsx --test packages/simulation/test/*.test.ts apps/server/test/*.test.ts`: 43 tests, 43 pass, 0 fail; final run 5,279.21 ms | PASS |
| Movement | All five fighters moving forward/backward with either facing; jump/crouch input; deterministic replay; movement animation state clocks | PASS, simulation/data tests |
| Arena collision | Both player orders at both walls, plus airborne crossover; wall regression previously produced x=9525 outside the 9250 limit | FAIL before fix; PASS after fix |
| Hitboxes | All five standing punches at configured reach and one unit outside; vertical separation; one hit per move; held attack does not repeat | PASS, simplified distance/height collision model |
| Standing/crouching attacks | All five fighters' punch/kick variants selected at press time; stance locked during the move; down alone crouches; airborne down does not create a grounded sweep | PASS, simulation/data tests |
| Blocking | Standing high guard, low attacks against standing/crouching guard, two successive impacts in block stun, chip-damage KO | PASS after block-stun fix |
| Parrying | Timed high parry, timed low parry and a late high-parry attempt after impact | PASS, automated timing cases |
| Combos | Landed normal cancels into special; recovered opponent's later hit resets combo count | FAIL on separated hits before fix; PASS after fix |
| Throws | Source/configuration audit executed: no throw move or throw input exists | FAIL / FEATURE ABSENT; no throw gameplay test could run |
| Specials | All five selected specials start and connect; Ryu projectile travel; Ken strike special; Gill knee drop; Elena and Dudley advancing specials | PASS, simulation tests |
| Super arts | All five meter gates; all damaging supers connect; Gill Resurrection heals to the expected capped amount | PASS, simulation tests |
| Rounds | KO and knockdown completion, normal-punch KO, chip KO, timer expiration, draw, fresh health, first-to-two result; countdown freezes attacks/movement/timer | PASS after fixes |
| Character select | Actual menu router exercised through all 25 local fighter pairings; both training paths select both fighters | PASS, Node DOM adapter; visual layout NOT tested |
| Pause / restart | P/Escape pause, frozen simulation, resume, restart, separate fight options, online input suppression | PASS, scene harness with Phaser adapter |
| Cancelled connection | Leave while connection is pending, then deliver its late open callback; no create message may be sent | PASS after client fix |
| Room create/join | Local WebSocket integration plus two public WSS clients using the production website Origin | PASS |
| Online synchronization | Matching initial and same-frame state; sequence acknowledgements; stale and nonnumeric input sequence handling | PASS |
| Rematches | Local full match finishes; one vote waits; both votes restart identical state at frame zero | PASS locally; public full match/rematch passed on corrected revision 59db278 |
| Disconnect handling | Local pause, valid token recovery, invalid token, replaced session close code 4000, expiry and expired token rejection; public disconnect/recover/leave | PASS |
| Invalid messages | Local malformed JSON, null/array/number/string roots → 1007; binary → 1003; payload >2 KiB → 1009; >120 messages/sec → 1008 | PASS; intentionally hostile probes were limited to local servers |
| Origin / capacity | Wrong browser origin → HTTP 403; full room rejected; configured two-connection cap rejects third with HTTP 503 | PASS locally |
| Authoritative input | Client-supplied state cannot overwrite health; nonboolean attack values do not start attacks | PASS locally |
| Production build | `pnpm build`: TypeScript, client Vite bundle and server esbuild complete; Vite emits a large-chunk warning | PASS WITH WARNING |
| Console errors | Node tests and harness completed without unhandled exceptions after fixture correction; real browser console capture unavailable | BLOCKED for browser console; no zero-console-error claim |
| Mobile controls | Source audit of client entry/input/scene: keyboard only, no touch/pointer fight controls | FAIL / FEATURE ABSENT |
| Mobile browser/device | Touch interaction, viewport layout, scrolling and physical device play | BLOCKED / NOT EXECUTED |
| Rendered performance | Browser FPS, frame timing, GPU behavior and low-end device profiling | BLOCKED / NOT EXECUTED |

## Measured performance and network evidence

- Local Node v24.22.1 deterministic workload: **100,000 simulation ticks in
  85.59 ms**, **0.00086 ms/tick**, in the final regression run. This measures
  simulation CPU only; it is not a render-FPS, browser, load-capacity or
  end-to-end-input-latency measurement.
- Public two-client WSS sample: ping RTT **126.9, 157.3, 102.8, 103.2,
  118.2 ms**. One client's sample received **122 snapshots over 1,964.8 ms**,
  advancing **121 simulation frames**. This is a short single-room observation,
  not a sustained load or packet-loss benchmark.
- Local production client bundle: **1,525.70 kB** JavaScript, **355.48 kB gzip**;
  CSS **12.81 kB**. The Phaser bundle warning remains open.

## Defects fixed and regression coverage

1. **Arena bounds / reversed order:** collision resolution only clamped one end
   of each player's coordinates. The corrected pushbox resolves left/right
   fighters independently and redistributes overlap at either wall.
2. **Round-intro attack exploit:** countdown previously decremented while combat
   and the timer continued. Countdown ticks now freeze combat and record held
   inputs so they do not become phantom attack presses at the end.
3. **Normal and chip KOs:** non-knockdown attacks could leave a KO standing. KOs
   now enter knockdown physics even for ordinary punches or blocked chip damage.
4. **Airborne crossover:** ground pushbox separation previously prevented a jump
   over an opponent. Vertically separated fighters no longer use that pushbox.
5. **False combos:** hits separated by the defender recovering were counted as a
   combo for 90 ticks. Incrementing now requires the defender to remain in hitstun.
6. **Sustained guard:** a second impact in block stun bypassed guard. Block stun
   is now distinguished from hitstun; holding the correct guard remains effective.
7. **Late WebSocket open:** leaving before a connection opened could send a create
   request from an obsolete socket. The open handler now checks socket ownership.

Regression files: `packages/simulation/test/qa-combat.test.ts`,
`apps/server/test/qa-network.test.ts`, existing combat/movement/stance/animation
suites, and `scripts/check-menu-flow.mjs`. `/health` now also exposes the public
Render commit prefix for release verification; no credentials are exposed.

The initial targeted combat run had four failures. The separated-hit combo and
successive-block regressions also failed when first executed. Each subsequently
passed after its fix. A menu-harness failure caused by the test adapter omitting
input `value` was corrected in the adapter; it was not treated as a product bug.

## Known limitations and outstanding issues

- **P1: Throws are unimplemented.** Needs a designed input, break/tech rules,
  range, animations, simulation events and network-compatible move definitions.
- **P1: No touchscreen gameplay controls.** A phone can load menus but cannot
  fight using touch alone. A paired keyboard may work; that was not tested.
- **P1 validation gap:** Browser-console checks, visual animation quality, mobile
  layout and rendered FPS remain unverified until browser access is enabled.
- **Release requirement resolved:** Render health confirmed corrected shared
  simulation revision `59db278b92e7`; the corrected frontend is also deployed.
- **P2:** Collision uses configured distance and height thresholds, not individual
  per-frame polygon/rectangle hitboxes and hurtboxes.
- **P2:** Server-authoritative input has interpolation but no rollback/client
  prediction. Internet latency remains visible; no adverse-network emulation or
  sustained multi-room load test was executed.
- **P2:** One in-memory server instance owns rooms. Server restarts/redeployments
  lose room state; Free Render can sleep while idle. Recovery handles connection
  loss to the same still-running process, not a server restart.
- **P2:** Some artwork remains temporary (recolored Ken stance clips, Dudley kicks,
  Elena crouching hand extension). Audio is synthesized placeholder sound/music.
- Cross-browser Safari/Firefox, accessibility, exhaustive matchup balance, gamepad
  support, physical-keyboard rollover and real two-person device testing were
  not executed and are not represented as passes.

## Deployment record — verified

- GitHub runtime/source revision **59db278b92e7290886e946c740f37efa31d54b1b**
  pushed to `aryankhotay-ops/neonrival_cx`, branch `main`. The subsequent report
  commit changes documentation/evidence only and does not require another server
  restart.
- Vercel production deployment **dpl_H6tMVjMfGZmv39Au32tbs9P6o2p1** reported
  **READY**, serving `https://neonrival-cx.vercel.app/` from that runtime revision.
- Render `/health` reported **HTTP 200**, status `ok`, and version
  **59db278b92e7** after the user manually deployed the new commit.
- Public homepage, JavaScript and stylesheet returned HTTP 200 without login.
  The deployed JavaScript contains the Render WSS endpoint and the new guarding
  state. All ten character atlas/animation files (PNG + JSON for five fighters)
  returned HTTP 200 and matched the repository bytes.
- Corrected backend public rerun: room create/join, identical snapshots, input
  acknowledgements, disconnect pause, valid-token recovery and leave **PASS**.
- Corrected backend public full-match/rematch rerun: both clients reached identical
  match results; one rematch vote waited; two votes restarted identical frame-zero
  states; leave notified the peer **PASS**.
- Post-release short network sample: ping RTT **107.0, 128.6, 107.5, 101.0,
  100.3 ms**; **124 snapshots in 1,978.9 ms**, **123 frames advanced**.
- Browser access was retried after the user's settings response, including a tool
  session refresh. The latest inventory still reported `Local browser use is
  disabled in Work settings`; no live browser-console, screenshot, touch-emulation
  or rendered-FPS result is claimed.
- `render.yaml` retains `autoDeployTrigger: off`. Future backend code changes
  still require a manual deploy; this QA release was verified after that step.

Evidence files in `docs/qa/`: `regression.txt`, `menu-harness.txt`, `build.txt`,
`public-network.txt` (baseline), `public-network-release.txt`,
`public-match-release.txt`, and `public-release.json`. These contain executed
results, not simulated pass labels. The two public checks use real Node WebSocket
clients with the website's Origin header; they do not substitute for a browser UI
playthrough.
