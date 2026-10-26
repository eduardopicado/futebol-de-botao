# Futebol de Botão

The Brazilian table-football game, for the iPad and phones, for all ages. Put
a finger on one of your buttons, pull back, let go: three touches a turn, and
call "A gol!" before you shoot.

No accounts, no tracking, no network requests. It works offline once added
to the home screen.

## Play

Open the site in Safari on the iPad, tap Share, then **Add to Home Screen**.

The iPad keeps running the old version of an app added this way until it is
closed and opened again, sometimes twice. When a new version is ready the app
shows a **New version! Tap to update** button.

## What is here so far

- **1 player:** a match against the computer, which thinks, shows its arrow
  for a moment and flicks, calls "A gol!" for you to place your goleiro, and
  places its own when you call. Easy, medium or hard.
- **2 players:** a match on one iPad, five buttons and a goleiro a side,
  first to 3 goals. A coin toss picks who kicks off. Each turn is up to three
  flicks with any of your buttons; to shoot, call **A gol!** (in a turn that
  started in the other half), and the other player slides their goleiro along
  the line and taps **Pronto**. Fouls give free kicks, or a penalty in the
  area. The note above the table turns to face whoever has to act.
- **Treino:** practice against three defenders and a goleiro, shooting
  freely. Every set-up comes with a way to score, and **Show me** plays it.
  **🧤 Goleiro** turns it round: ten shots by the computer at your goal, to
  save; your best is kept.
- **Grown-ups:** hold the button on the start screen for three seconds to
  choose your team, the opponent, the commentator (Português, English or
  none), the sound effects, and a crest for each team from your own photos.
  (This becomes a plain settings menu soon.)

The rules are a simple version of the CBFM's 3 Toques (the regra carioca);
[`src/content/match.ts`](src/content/match.ts) lists them.

## Develop

```
npm install
npm run dev
npm test
```

See [`CLAUDE.md`](CLAUDE.md) for the rules and the layout.
