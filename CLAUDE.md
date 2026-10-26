# CLAUDE.md

Futebol de botão, the Brazilian table-football game, for a 6-year-old in
Australia whose family is Brazilian. He plays on an iPad from the home screen
(Safari, added as an app), and sometimes on a phone. It grew out of the
Futebol de Botão angles game in `eduardopicado/sounds-of-reading`, which stays
there as a lesson; the brief for this one is `docs/HANDOVER.md`.

## Rules

- No accounts, analytics, ads, or network requests. Fonts are self-hosted.
  Nothing leaves the device. The built page carries a Content-Security-Policy
  (`vite.config.ts`) that makes the browser refuse any other origin; a new
  kind of resource has to be allowed there.
- Static site, offline-capable PWA on GitHub Pages. State in `localStorage`
  only, through `src/lib/storage.ts`, which guards every call and returns the
  fallback for a saved value of the wrong kind.
- The physics (`src/content/botao.ts`) uses only + − × ÷ and square roots, at
  240 steps a second, so a flick does exactly the same thing on every device
  and in the tests. Keep it that way: replays, the computer opponent and the
  tests depend on it. No `Math.sin`, `atan2` or randomness inside `simulate`.
- The pull counts from where the finger lands, not from the middle of the
  button; under 1.5 units of movement is no flick. A `pointercancel` drops the
  drag, and a finger still down when a shot starts is no flick.
- Nothing guide-like stays on the table when no button is held. Say what
  happened in words, above the table, or animate it and then clear it.
- The game screen fits the screen with no scrolling: the table has
  `touch-action: none`, so on a phone a swipe that starts on a button is a
  flick, not a scroll.
- No filters in the SVG: shading is gradients only, so it stays at 60 fps on
  an iPad. Motion stops under Reduce Motion.
- The app never ships a club's crest (a trademark). Clubs come as kit colours,
  countries with their flag; a grown-up can add a crest from the device's own
  photos (`src/lib/crests.ts`).
- Keep single-storey a/g letterforms (Andika) for anything he reads.
- Speech: every call wrapped in try/catch; unlocked on the first tap for iOS.
  The commentator is Portuguese by default, English or off by choice.
- A screen schedules its timers through `lifetime()` (`src/lib/life.ts`) and
  ends it on unmount, so nothing it planned happens after he has left. The
  router also cancels speech and stops sound effects on the way out.
- Test at iPad Safari sizes (820×1180 both ways) and 375px wide. Zero console
  errors.

## Commands

```
npm run dev        # local dev server
npm run build      # typecheck, then build to dist/
npm run test:unit  # physics, planner, set-ups, and the shared code
npm test           # unit tests, then the Playwright suite
```

CI runs all of these on every pull request and push, the browser tests as one
job per device (WebKit too). GitHub Pages deploys only after CI has passed on
a push to `main` (`.github/workflows/deploy.yml`).

In a cloud session whose Playwright browser does not match the installed
`@playwright/test`, point it at the pre-installed one:
`PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`.

## Layout

```
src/content/botao.ts      the table, the physics of a flick, the three-touch rule,
                          the goleiro, and the planner (aimAt, oneTouch, passPlan,
                          robust) that finds a way to score
src/content/treino.ts     Treino's set-ups, each with a way to score from it
src/content/commentary.ts what the commentator shouts, both languages
src/game/table.ts         the table drawn: tray, felt, lines, goals, buttons
src/game/treino.ts        Treino: the finger, the flick, three touches, Show me
src/game/home.ts          the start screen
src/game/grown-ups.ts     settings: his team, the opponent, commentator, sounds,
                          crests (held for three seconds on the start screen)
src/game/teams.ts         the teams, their flags and kits; rivalFor picks the opponent
src/game/narration.ts     the commentator ("Goooool do Brasil!")
src/lib/                  speech, sfx, audio (recorded lines; none ship yet),
                          storage, crests, life, router, dom, update (the
                          "new version, tap to update" button)
src/assets/tray.webp      the wooden tray, cut from the design handoff
tests/unit/               physics, planner, set-ups, storage, sfx, speech, crests
tests/e2e/                Playwright, real finger drags through the table's viewBox
.claude/skills/           grill-me and grilling (mattpocock/skills, MIT)
```
