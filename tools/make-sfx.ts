/* Records the sound effects that the app otherwise makes from tones
 * (src/lib/sfx.ts), with ElevenLabs' sound effects.
 *
 * Ported from eduardopicado/sounds-of-reading, where the first ten were made
 * (their prompts are kept here, as they were); the stadium's roar and groan
 * were made here.
 *
 * Like tools/make-audio.ts, this runs on a laptop or in a Claude session,
 * never in the app. The key stays in the environment (ELEVENLABS_API_KEY),
 * and the app plays the finished files from its own origin.
 *
 * A sound effect comes out differently every time, so each one is made a few
 * times to listen to, and the best take is kept:
 *
 *   npm run make:sfx -- --dry                     what would be made, and how many seconds
 *   npm run make:sfx -- --takes 3                 three takes of each missing one, into audition/sfx/
 *   npm run make:sfx -- --takes 3 --only cheer    three more of the cheer
 *   npm run make:sfx -- --keep cheer 2            take 2 of the cheer is the one the app plays
 *   npm run make:sfx -- --drop cheer              the app makes the cheer from tones again
 *   npm run make:sfx -- --manifest                sfx.json again, after a change of gain below
 *
 * How loud each one plays is its gain here, written into sfx.json beside
 * the list of files, so a sound that is too loud is a number changed and
 * --manifest, not a new recording. */

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Recordable } from '../src/lib/sfx.ts';
import { fetchRetrying } from './make-audio.ts';

const OUT = join(process.cwd(), 'public', 'audio', 'sfx');
const TAKES = join(process.cwd(), 'audition', 'sfx');

export interface Effect {
  /** what to ask for: one sound, with what makes it, and nothing else in it */
  prompt: string;
  /** how long, from 0.5 to 30 */
  seconds: number;
  /** how loud it plays in the app, from 0 to 1 */
  gain: number;
  /** played for longer than it lasts, so it has to loop without a seam */
  loop?: boolean;
}

/* Every sound that can be recorded, and nothing else: the type makes this
   list and src/lib/sfx.ts agree. The cheer follows every right answer in
   most games, so it is short and friendly, not a stadium going wild. */
export const EFFECTS: Record<Recordable, Effect> = {
  cheer: { prompt: 'A small happy crowd of children cheering and clapping, short and joyful, like a school sports day', seconds: 1.5, gain: 0.5 },
  win: { prompt: 'A short cheerful brass fanfare, then a football crowd cheering', seconds: 2.5, gain: 0.55 },
  whistle: { prompt: "A football referee's whistle: two short sharp blasts", seconds: 1.2, gain: 0.3 },
  crowd: { prompt: 'The steady murmur of a big football crowd in a stadium, a low hum of voices, no cheering, no clear words', seconds: 8, gain: 0.25, loop: true },
  kick: { prompt: 'A football kicked hard on grass: one solid thump of a boot on a leather ball', seconds: 0.5, gain: 0.8 },
  clack: { prompt: 'A small plastic table football player striking a hard plastic ball: one sharp clack', seconds: 0.5, gain: 0.7 },
  post: { prompt: 'A football hitting a metal goal post: one ringing clang', seconds: 1, gain: 0.5 },
  move: { prompt: 'A wooden chess piece set down on a wooden chessboard: one soft knock', seconds: 0.5, gain: 0.8 },
  take: { prompt: 'A wooden chess piece knocking another off a wooden chessboard: a knock and a little clatter', seconds: 0.8, gain: 0.7 },
  roll: { prompt: 'A wooden die rolled on a wooden table: it tumbles and stops', seconds: 1.2, gain: 0.7 },
  /* a match's goal: the stadium itself, not the friendly cheer */
  roar: { prompt: 'A huge football stadium crowd erupting into a roar for a goal: cheering, shouting and clapping that swells and then settles, no music, no clear words', seconds: 3.5, gain: 0.5 },
  /* a shot just wide, off the post or saved */
  groan: { prompt: "A big football stadium crowd groaning together at a shot that just missed: one long disappointed 'ooooh' that rises and falls, no cheering, no music, no clear words", seconds: 2, gain: 0.45 },
};

type Env = Record<string, string | undefined>;

/** the request for one take of an effect */
export function sfxRequest(effect: Effect, env: Env): { url: string; init: RequestInit } {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set: see public/audio/README.md');
  const format = env.ELEVENLABS_FORMAT ?? 'mp3_44100_64';
  return {
    url: `https://api.elevenlabs.io/v1/sound-generation?output_format=${encodeURIComponent(format)}`,
    init: {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: effect.prompt,
        duration_seconds: Math.min(30, Math.max(0.5, effect.seconds)),
        /* nearer the prompt than the default 0.3: one plain sound, not a scene */
        prompt_influence: 0.5,
        ...(effect.loop ? { loop: true } : {}),
      }),
    },
  };
}

async function take(effect: Effect): Promise<Uint8Array> {
  const { url, init } = sfxRequest(effect, process.env);
  const res = await fetchRetrying(url, init);
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return new Uint8Array(await res.arrayBuffer());
}

const names = Object.keys(EFFECTS) as Recordable[];
const isName = (s: string | null | undefined): s is Recordable => !!s && s in EFFECTS;

/** what the app reads: each recorded sound, with how loud it plays */
function writeManifest(): void {
  mkdirSync(OUT, { recursive: true });
  const have = new Set(readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
  const list = Object.fromEntries(names.filter((n) => have.has(n)).map((n) => [n, EFFECTS[n].gain]));
  writeFileSync(join(OUT, 'sfx.json'), JSON.stringify(list, null, 2) + '\n');
  console.log(`sfx.json lists ${Object.keys(list).length} of ${names.length}: ${Object.keys(list).join(', ') || 'none yet'}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const after = (flag: string, n = 1): string | null => {
    const at = args.indexOf(flag);
    return at >= 0 ? args[at + n] ?? '' : null;
  };

  const keep = after('--keep');
  if (keep !== null) {
    const n = after('--keep', 2);
    if (!isName(keep) || !n) throw new Error(`--keep needs a sound and a take: one of ${names.join(', ')}, then 1, 2…`);
    const from = join(TAKES, `${keep}-${n}.mp3`);
    if (!existsSync(from)) throw new Error(`there is no ${from}: make takes first with --takes`);
    mkdirSync(OUT, { recursive: true });
    copyFileSync(from, join(OUT, `${keep}.mp3`));
    writeManifest();
    return;
  }

  const drop = after('--drop');
  if (drop !== null) {
    if (!isName(drop)) throw new Error(`--drop needs one of ${names.join(', ')}`);
    rmSync(join(OUT, `${drop}.mp3`), { force: true });
    writeManifest();
    return;
  }

  if (args.includes('--manifest')) { writeManifest(); return; }

  const only = after('--only');
  if (only !== null && !isName(only)) throw new Error(`--only needs one of ${names.join(', ')}`);
  const kept = new Set(existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)) : []);
  const todo = only ? [only] : names.filter((n) => !kept.has(n));
  const takes = Math.max(1, Math.min(5, Number(after('--takes') ?? 1) || 1));
  const seconds = todo.reduce((sum, n) => sum + EFFECTS[n].seconds * takes, 0);
  console.log(`${names.length} sounds, ${kept.size} kept, ${todo.length} to make, ${takes} take${takes === 1 ? '' : 's'} each: ${seconds.toFixed(1)} s of sound`);
  if (args.includes('--dry')) {
    for (const n of todo) console.log(`  ${n.padEnd(8)} ${EFFECTS[n].seconds}s${EFFECTS[n].loop ? ', looped' : ''}  ${EFFECTS[n].prompt}`);
    return;
  }

  mkdirSync(TAKES, { recursive: true });
  for (const n of todo) {
    /* numbered after any takes already there, so asking again adds to them */
    const first = readdirSync(TAKES).filter((f) => f.startsWith(`${n}-`) && f.endsWith('.mp3')).length + 1;
    for (let i = first; i < first + takes; i += 1) {
      writeFileSync(join(TAKES, `${n}-${i}.mp3`), await take(EFFECTS[n]));
      console.log(`  audition/sfx/${n}-${i}.mp3`);
    }
  }
  console.log('\nListen, then keep the best of each: npm run make:sfx -- --keep <sound> <take>');
}

/* only when run as a command; the unit tests import from here */
const runDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  main().catch((err) => { console.error(String(err instanceof Error ? err.message : err)); process.exit(1); });
}
