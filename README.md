# Futebol de Botão

The Brazilian table-football game, for the iPad. Put a finger on one of your
buttons, pull back, let go: three touches to score, and before the third the
ball has to go to another button (the regra carioca).

No accounts, no tracking, no network requests. It works offline once added
to the home screen.

## Play

Open the site in Safari on the iPad, tap Share, then **Add to Home Screen**.

The iPad keeps running the old version of an app added this way until it is
closed and opened again, sometimes twice. When a new version is ready the app
shows a **New version! Tap to update** button.

## What is here so far

- **Treino:** practice against three defenders and a goleiro. Every set-up
  comes with a way to score, and **Show me** plays it.
- **Grown-ups:** hold the button on the start screen for three seconds to
  choose his team, the opponent, the commentator (Português, English or none),
  the sound effects, and a crest for each team from the iPad's own photos.

The full match is next; the open questions are at the end of
[`docs/HANDOVER.md`](docs/HANDOVER.md).

## Develop

```
npm install
npm run dev
npm test
```

See [`CLAUDE.md`](CLAUDE.md) for the rules and the layout.
