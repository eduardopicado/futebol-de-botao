# Recorded lines and sounds

## What is here

- **The commentator** (`*.mp3`, listed in `clips.json`): every goal and save
  he shouts, for every team, in Portuguese and in English. "É campeão!" and
  "… are the champions!" are not recorded yet.
- **The sound effects** (`sfx/*.mp3`, listed in `sfx/sfx.json` with how loud
  each one plays): cheer, win, whistle, crowd, kick, clack, post, move, take
  and roll.

Both were made with ElevenLabs for `eduardopicado/sounds-of-reading` and
copied here as they were. They are never edited by hand.

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

The sound effects were made by `tools/make-sfx.ts` in sounds-of-reading;
make new ones there and copy them over.
