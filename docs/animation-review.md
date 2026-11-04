# Character animation correction — 4 November 2026

The renderer now selects startup, contact and recovery clips using the actual
move timing. Standing punch/kick and crouching punch/sweep have separate clips.
The existing combat state, hit rules, inputs and authoritative room protocol
are preserved. Elena's standing hand normal is labelled Standing Palm.

## Corrections

- Dudley: removed the extra procedural leg overlay. Each standing kick/sweep
  is a complete sprite with the original planted front leg removed and the
  replacement leg articulated from his sprite parts. His rapid-punch special
  and rotating-glove super use different reviewed sheet sequences.
- Elena: replaced the standing kick on the punch button and the extra crouching
  arm overlay with complete palm-strike frames. Standing kicks, sweeps,
  advancing horn kick and super combination have separate sequences.
- Gill: special uses knee-drop poses instead of normal-kick poses. Resurrection
  uses a crouch-to-rise and raised-arm sequence. Standing and crouching normals
  use their respective reviewed clips.
- Ken: uppercut special/super now use uppercut poses instead of fireball poses.
  The source is recolored supplied Ryu artwork; it is not original Ken artwork.
- Ryu: retained the reviewed normal/fireball art and aligned contact frames with
  simulation startup/active/recovery timing.
- Walking: pelvis offsets reduce bounding-box centering jitter in Elena, Gill
  and Dudley. Elena's short transitional gait returns smoothly rather than
  jumping directly from the last upright pose to the first lowered pose.
- Nearest-neighbour rendering and rounded pixel positions reduce sprite shimmer.
  Versioned atlas URLs keep metadata and PNG exports on the same release.

## Source limitations

Dudley's supplied boxing sheet contains no leg-kick normals. Elena's original
hand-button normals use kicks. Their replacement leg/hand clips are game-specific
adaptations, not recovered original SFIII animations. Specials and supers retain
the existing simplified gameplay; these changes do not recreate the original
multi-hit move system or change hitboxes. No new external artwork was downloaded.

## Rebuild and verify

Requires Pillow and NumPy, plus the original unscaled user-supplied sheets:

```sh
python scripts/review-fighter-animations.py /path/to/supplied/sheets
python scripts/check-animation-pixels.py
node --import tsx --test packages/simulation/test/*.test.ts apps/server/test/*.test.ts
node scripts/check-menu-flow.mjs
pnpm build
```

Executed: 54/54 automated tests passed, including all five fighters' standing and
crouching button-to-contact mappings on both sides, all six attack timelines,
existing movement, combat and local WebSocket tests. Pixel checks passed for
nonempty clips, no visible magenta, adapted-foot baseline bounds and removal of
Dudley's old planted foot. Menu/scene harness and production build passed. The
existing Vite large-bundle warning remains.

Visual review: source-sheet contact sheets and 30 attack contact states plus 10
walk/back states were captured with the actual Phaser renderer in a local review
harness, showing both facings. Initial rapid captures were one render frame late;
these were recaptured after waiting for painting before inspection. A separate
attempt to capture a transient playback frame timed out; full-speed gait playback
is not claimed as a passing browser test. An initial module-resolution error was
in the temporary review harness and was fixed; it was not a game runtime error.

The local review harness is kept under ignored `work/animation-review/` and is
not included in the production game. The committed screenshots document the
corrected contact poses. Prior broader QA limitations remain in QA_report.md.


## Published verification

Runtime commit `d312227` is live on `https://neonrival-cx.vercel.app/` through
Vercel deployment `dpl_EruaprBYHS1ezSJxycT65ZaJYT9d` (READY). Anonymous HTTP
checks confirmed all ten PNG/JSON atlas files match the tested local exports,
and the browser bundle includes the sprite revision and existing public WSS URL.

In a fresh production browser tab, Training → VS Player → Dudley vs Elena →
Fight loaded successfully. Actual G and F key presses showed Dudley's new leg
kick and standing jab respectively. Browser warning/error logs were empty during
that production check. `docs/qa/animations-live-dudley-kick.png` records the live
kick. The first F press was during kick recovery and correctly did not cancel
it; the jab was verified with a later press after recovery. No claim is made that
all 30 attacks were manually performed in the production browser; those contact
combinations were covered by the renderer fixture and timing tests.

This release changes presentation and Elena's displayed normal name. It requires
no Render server redeploy; combat behavior and the network protocol are unchanged.
