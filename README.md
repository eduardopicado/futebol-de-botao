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

While it starts, the iPad shows the start screen until the buttons appear.
An iPad that had the app before shows it once the app is removed and added
to the Home Screen again: iOS keeps the picture it was given then.

## What is here so far

- **1 player:** a match against the computer, which thinks, shows its arrow
  for a moment and flicks, calls "A gol!" for you to place your goleiro, and
  places its own when you call. Easy, medium or hard.
- **2 players:** a match on one iPad, four buttons and a goleiro a side (or
  five), first to 3 goals. A coin toss picks who kicks off. Each turn is up to
  three flicks with any of your buttons; to shoot, call **A gol!** (in a turn
  that started in the other half), and the other player slides their goleiro
  along the line and taps **Pronto**. Fouls give free kicks, or a penalty in
  the area. The note above the table (beside it, with the iPad held sideways)
  turns to face whoever has to act. After a goal, **↺ Replay** plays the move
  that scored again, at half speed.
- **🏆 Copa:** a cup against the computer. Pick your team and three
  opponents are drawn: a quarter-final on easy, a semi-final on medium and
  the final on hard. Win to go through, lose and you are out; the cup is kept
  on the iPad to finish another day, and so is the number of cups won.
- **Pênaltis:** a penalty shootout, against the computer or two on one iPad.
  Five kicks each, then a kick each until one side scores and the other does
  not: the defender places their goleiro and taps **Pronto**, and the taker
  has one flick.
- **Treino:** practice against three defenders and a goleiro, shooting
  freely. Every set-up comes with a way to score, and **Show me** plays it.
  **🧤 Goleiro** turns it round: ten shots by the computer at your goal, to
  save; your best is kept.
- **📖 How to play:** a short guide, offered the first time the app is
  opened and below the ways to play after that. Each step is a few words and
  a little match played on the table to show them: the flick, the touches,
  **A gol!**, the goleiro, fouls, no parking at 1 Toque, and the kick-off.
- **Picking teams:** every match starts by picking each side's team, from
  the World Cup winners, the big clubs and two made-up sides; the side at the
  top may be "Anyone". The picks are kept for next time, and **📷 Add a
  crest** under each side puts a picture from your photos on that team's
  shirt and buttons.
- **Settings (⚙):** goals to win (3, 5 or 10), the rule (3 toques or
  1 toque), four or five buttons a side, how well the computer plays, the
  commentator (Português, English or none), sound effects, reading the words
  aloud, and for any team a crest from your own photos and its players'
  numbers and names.
- **Players:** every real team comes with six of its men's squad as of
  October 2026, the goleiro and five on the buttons, each with his number.
  The number is on the button's rim; hold a button and its name shows above
  it, and a goal says who scored, the commentator too.

The rules are a simple version of the CBFM's 3 Toques (the regra carioca),
or of its 1 Toque (once the regra baiana): one flick a turn, the goleiro free
to move anywhere in its small area, and no parking the ball between your own
buttons.
[`src/content/match.ts`](src/content/match.ts) lists them.

## Develop

```
npm install
npm run dev
npm test
```

See [`CLAUDE.md`](CLAUDE.md) for the rules and the layout.
