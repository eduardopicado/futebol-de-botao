# Recorded lines and sounds

## What is here

- **The commentator** (`*.mp3`, listed in `clips.json`): everything he
  shouts, in Portuguese and in English. That is every goal, for every team;
  the saves; "Na trave!" off the post; "Quase!" just wide; "Gol contra!";
  "Bola do goleiro!" when the ball stops on the goal line, not in;
  "É campeão!"; the kick-off, half time, extra time and penalties; a foul,
  a penalty, a goal that does not count and a chip; and the classic radio
  cries ("Tem peixe na rede!", "Olho no lance!", "Gol de placa!").
- **The sound effects** (`sfx/*.mp3`, listed in `sfx/sfx.json` with how loud
  each one plays): cheer, win, whistle, crowd, kick, clack, post, move, take
  and roll; and the stadium's roar for a goal and its groan ("uuuh") for a
  near miss. The crowd's murmur swells under a flick as the ball nears a
  goal. The torcida is the supporters singing all match long, by choice in
  the settings: they have three songs (`torcida`, `torcida2`, `torcida3`),
  one picked for each match.

The first lines and the first ten sound effects were made with ElevenLabs
for `eduardopicado/sounds-of-reading` and copied here as they were; the rest
were made here, with the same tools. They are never edited by hand.

## The voices

Both voices are on Eleven v4 and were chosen by ear in October 2026:

| Says | Voice |
|---|---|
| The commentator in Portuguese | Nassif – Sports Commentary & Hype (Brazilian), `Fjiik8aKXNDjmxd1Q2jF` |
| The commentator in English | Stuart – Energetic and enthusiastic (Australian), `HDA9tsk27wYi3uq0fPcK` |

A line added later has to use the same voice and model, or the commentator
sounds like two people. `tools/make-audio.ts` fixes both.

## How the app plays them

- **Lines:** each file is named `clipId()` of its words
  (`src/lib/clip-id.ts`). The app plays a recording only for a line listed in
  `clips.json`. Everything else is said by the device voice, including the
  scorer's name after "Goooool do Brasil!", since a player can rename
  anyone on the device.
- **Sound effects:** fetched as the app starts and made ready on the first
  tap. Until a sound is ready, and for any sound without a recording, it is
  made from tones (`src/lib/sfx.ts`).

The offline worker caches every `.mp3` and both lists, so they play with no
signal.

## Recording more

1. Put the key in the environment as `ELEVENLABS_API_KEY`. In a Claude
   session, that is the environment's settings (never paste it into the
   chat); on a laptop, the shell. It is never built into the app: the app
   only plays finished files from its own origin.
2. Allow `api.elevenlabs.io` in the environment's network access.
3. Run `npm run make:audio -- --dry` to see what is missing.
4. Run `npm run make:audio` to record it. Existing files are left alone, so
   a run only pays for what is new. To try a line again, delete its file
   (`--dry` names it) and run again.

A line the commentator says comes from `src/content/commentary.ts`. Add it
there first, then record it. `tests/unit/recordings.spec.ts` checks that
both lists match their files and that every file is a line he says.

The sound effects are made by `tools/make-sfx.ts` (ported from
sounds-of-reading, its prompts with it). A sound comes out differently each
time, so `npm run make:sfx -- --takes 3` makes takes into `audition/sfx/` to
listen to, and `npm run make:sfx -- --keep <sound> <take>` keeps one and
writes `sfx.json`. `tests/unit/recordings.spec.ts` checks the list matches
its files and the volumes in the tool.
