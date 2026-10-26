# Handover: Futebol de Botão, from the angles game to a full game

A full futebol de botão game for 1 or 2 players, in its own repository. It grows out of the Futebol de Botão maths game in `eduardopicado/sounds-of-reading`. That game stays there as a lesson about angles. This note lists what is worth carrying over and what playing it taught us.

Source: `eduardopicado/sounds-of-reading` on `main` at `9f2218c` (after PR #105). Add that repository to the new session so its files can be read and copied. Copy what you need. Don't import across repositories.

## Who it's for

The player is a 6-year-old in Australia whose family is Brazilian. He plays on an iPad from the home screen (Safari, added as an app), and sometimes on a phone. The other app's rules are worth keeping unless you decide otherwise:
- **Privacy:** no accounts, analytics, ads or network requests. Fonts are self-hosted, everything else lives in `localStorage`, and nothing leaves the device.
- **Offline:** a static, offline PWA on GitHub Pages, with a Content-Security-Policy that blocks every other origin.
- **Sizes:** test at 820×1180 both ways and at 375 px wide, with zero console errors.

## The physics: copy `src/content/botao.ts` almost as it is

This is the most valuable part: a small, deterministic table-football simulator with tests.
- **Deterministic:** it uses only + − × ÷ and square roots, at 240 steps a second (4 per drawn frame), so a flick does exactly the same thing on every device and in the tests. Keep this property. It is what makes replays, a computer opponent and tests possible.
- **The table:** `W = 64` by `L = 98` units, about the proportions of a real 1.86 × 1.21 m table. The goal mouth runs from x 21 to x 43, the net is 5 deep, the posts are 0.8. A button's radius is `R = 5` and the ball's is `BALL = 1.6`. The markings are in `MARKS`. The goal is narrower than the small area, as on a real table.
- **Movement:**
  - **Masses:** a button weighs 1, the ball 0.3.
  - **Slowing:** felt drag is a steady part plus a part that grows with speed.
  - **Bounce:** the ball comes off the rim with restitution 1, so the angle in equals the angle out. Buttons thud off the rim (0.5), and a net stops things (0.1).
  - **Speed:** `MAX_SPEED = 130`, and a pull of one unit gives speed 5 (`PULL`).
- **Collisions** between every pair of discs, with the posts' round feet, and with the goleiro block.
- **The goal mouths are open at both ends.** A button can go in and stop against the net, and a ball in his own net is an own goal (`own`).
- **What `simulate(table, flick)` returns:** the frames, the end position, and `goal` and `own`. It also gives `bumps` (what the ball hit and when, including whose button touched it), `bounces` (the wall, the way in and the way out) and `touched` (whether the flicked button reached the ball).
- **A ready-made computer opponent.** The planner was written for "Show me a way":
  - `aimAt` finds where a button must hit the ball to send it towards a point.
  - `oneTouch` finds a one-flick goal, straight, cut or off a wall. It only accepts shots that still score when turned 1.5° either way or hit 6% softer or harder (`robust`).
  - `passPlan` finds a pass to a team-mate and then a shot.
  - For a 1-player mode, add noise to these and you have levels of difficulty. For attacking the other way, flip the table.
- **Rules already coded:** the regra carioca's three touches, where before the third the ball must go to another button (`mayFlick`, `TOUCHES`). A goleiro block, positioned by `keeperFor`, is the `side` or `middle` play.

Its tests are in `tests/unit/botao.spec.ts` (physics and planner) and `tests/e2e/botao.spec.ts` (Playwright, real finger drags through the table's viewBox). Carry them over with the code.

## The drawing and the finger: `src/games/futebol-de-botao.ts`

It is SVG in table units. `VIEW` is the viewBox, and `toTable()` turns a pointer into table units through `getBoundingClientRect()`.
- **The look:**
  - **Light and shadows:** the light comes from the top left. Shadows fall down and right, with buttons showing their side below the top (`DEPTH`).
  - **No filters:** shading is only gradients (`shading()`), so it stays at 60 fps on an iPad.
  - **The goal:** a box seen from in front, with its crossbar drawn over the ball and a net that shakes on a goal. It is still when Reduce Motion is on.
- **The tray:** `src/assets/botao/tray.webp` (16 KB) is the wooden tray, cut from the design handoff's `design-reference.png`. The felt inside it lines up exactly with the 64 × 98 pitch through `TRAY` and `VIEW` in `botao.ts`.
- **The design handoff:** `futebol_botao_claude_handoff.zip`, which Eduardo has. It contains the reference picture, `pitch.svg`, button and ball SVGs, a demo and Codex's instructions. It is the visual target, and closer to it than the app is now.
- **Crests:** in `src/lib/crests.ts` and `src/games/teams.ts`, a grown-up adds a team's crest from the iPad's own photos. It is cut to a square, kept small in `localStorage`, and shown cut to a circle on the buttons. The app never ships a club's crest, since that is the club's trademark. Clubs come as kit colours, and countries come with their flag.
- **Sides:** "You" and "the Rivals" are the family's own sides. `rivalFor` picks the opponent the same way in every game.
- **The commentator:** `src/games/narration.ts` and `src/content/commentary.ts` shout "Goooool do Brasil!" and "Defendeu o goleiro!" in a Portuguese voice, or in English, or not at all. There are sound effects for a touch, the post, the wall and the cheer (`src/lib/sfx.ts`).

## Learned from playing it: keep these

1. **The pull counts from where the finger lands, not from the middle of the button.** Measured from the middle, a finger resting off-centre, a tap or a palm became a flick. That flick is the "angles appearing before I tried to play" report. Below 1.5 units of movement nothing happens. A finger within `R + 3` of a button picks it up.
2. **Nothing guide-like stays on the table when no button is held.** The last shot's path and angles were left behind in the aiming guide's dashes, and they read as "the guide came on by itself" (#105). Say what happened in words instead, or animate it and then clear it.
3. **Only show angles for a bounce his own button sent straight to the wall** (`shownBounce`). A ball that glances off another button first has a corner he can't see the reason for.
4. **Put the words above the table.** Below it, they and "Show me a way" fell under the bottom of the screen on every size.
5. **The table has `touch-action: none`, so a swipe on it can't scroll the page.** On a phone, a swipe meant to scroll that starts on a button is a flick. Make the whole game fit the screen with no scrolling.
6. **A `pointercancel` must drop the drag.** It's worth also guarding against a drag still held when a shot or demo starts: `onUp` doesn't check `busy`, which could matter with two fingers.
7. **The iPad keeps the old version** of a PWA until it is reopened, sometimes twice. Tell the tester, and consider an in-app "new version, tap to reload".

## What not to carry over

The maths frame (`src/games/maths-kit.ts`) doesn't belong in a game: its rounds of eight attacks, its ladder of steps and its Start screen. The same goes for the set pieces built for lessons (`layout`, `BOTAO_STEPS`), the angle wedges in degrees, and the right-angle mark. They are the angles game's point, not a match's.

## Questions for the new game (not settled here)

- **The match:** full teams (a real side has 10 buttons and a goleiro), a time limit or first to N, and kick-off after a goal.
- **Two players on one iPad:** take turns, with the table turned or each attacking an end. Touches pass to the other side after three, or when the ball touches their button.
- **Rules beyond the three touches:** fouls (a button hitting an opponent's button before the ball), shots only from the attacking half, and the goleiro moved by the defender before a shot. The regra carioca has more. Check a real rulebook rather than guessing.
- **Against the computer:** use the planner above with less accuracy at easier levels.
- **Real goleiro control:** a block he slides along the line.
