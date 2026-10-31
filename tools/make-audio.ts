/* Records what the commentator shouts, once, ahead of time, with ElevenLabs,
 * into public/audio/: a goal for every team, a save, the champions, in
 * Portuguese and in English. The app plays a recording where there is one
 * and the device voice everywhere else (src/lib/audio.ts).
 *
 * Ported from eduardopicado/sounds-of-reading, where the voices were chosen
 * by ear and the first recordings made; the files came over as they were. A
 * line added later has to be made with the same voice and model, or the
 * commentator would sound like two people, so both are fixed here.
 *
 * This runs on a laptop or in a Claude session, never in the app. The key
 * lives in the environment and is never built into the site: the app only
 * ever loads finished .mp3 files from its own origin, so nothing leaves the
 * device.
 *
 *   ELEVENLABS_API_KEY   the key, as an environment secret (the only thing needed)
 *
 *   npm run make:audio -- --dry               what is missing, and how many characters
 *   npm run make:audio -- --list clips.txt    every line, one a line, to read through
 *   npm run make:audio -- --only "Na trave!"  one line, to hear it before the rest
 *   npm run make:audio                        everything missing
 *
 * (Run by node itself, with tools/ts-imports.ts for the imports from src/.)
 *
 * Existing files are left alone, so a run costs only what is new. To try a
 * line again, delete its file (--dry names it) and run it again.
 *
 * Portuguese is always Brazilian. Before a Portuguese line is recorded its
 * voice is looked up, and the run stops unless ElevenLabs says it speaks
 * Portuguese with a Brazilian accent (brazilianProblem below). */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipId, speakable } from '../src/lib/clip-id.ts';
import { EN_SAVES, PT_CHAMPIONS, PT_SAVES, enChampion, enGoal, ptGoals } from '../src/content/commentary.ts';
import { TEAMS, real } from '../src/game/teams.ts';

const OUT = join(process.cwd(), 'public', 'audio');
const API = 'https://api.elevenlabs.io/v1';

/** who says it: the commentator in English, or in Portuguese */
export type Voice = 'en' | 'pt-commentator';

/** the voices, chosen by ear in October 2026 (sounds-of-reading's
    public/audio/README.md): Stuart, energetic and Australian, and Nassif,
    Brazilian sports commentary */
export const VOICES: Record<Voice, string> = { en: 'HDA9tsk27wYi3uq0fPcK', 'pt-commentator': 'Fjiik8aKXNDjmxd1Q2jF' };
export const MODEL = 'eleven_v4';
const FORMAT = 'mp3_44100_64';

/** one clip: the words as written, and who says them */
export interface Clip { text: string; voice: Voice }

/** everything the commentator can say (src/game/narration.ts), once each */
export function clips(): Clip[] {
  const out = new Map<string, Clip>();
  const add = (text: string, voice: Voice): void => {
    const key = speakable(text);
    if (key && !out.has(key)) out.set(key, { text: text.trim(), voice });
  };
  /* in English a real team is named, a made-up side is not */
  for (const line of [...EN_SAVES, enGoal(), enChampion()]) add(line, 'en');
  for (const t of TEAMS.filter(real)) for (const line of [enGoal(t.name), enChampion(t.name)]) add(line, 'en');
  /* in Portuguese a team with its article ("do Brasil"), or none */
  for (const line of [...PT_SAVES, ...ptGoals(), ...PT_CHAMPIONS]) add(line, 'pt-commentator');
  for (const t of TEAMS) if (t.pt) for (const line of ptGoals(t.pt)) add(line, 'pt-commentator');
  return [...out.values()].sort((a, b) => speakable(a.text).localeCompare(speakable(b.text)));
}

/* ── ElevenLabs ─────────────────────────────────────────────────────────── */

/** the request for one clip, said as a statement, not a question */
export function ttsRequest(clip: Clip, key: string | undefined): { url: string; init: RequestInit } {
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set: see public/audio/README.md');
  const text = /[.!?…]$/.test(clip.text) ? clip.text : `${clip.text}.`;
  return {
    url: `${API}/text-to-speech/${VOICES[clip.voice]}?output_format=${FORMAT}`,
    init: {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        /* a short line gives the model little to tell the language by */
        language_code: clip.voice === 'en' ? 'en' : 'pt',
        voice_settings: { stability: 0.6, similarity_boost: 0.8 },
      }),
    },
  };
}

/** what ElevenLabs says about a voice (GET /v1/voices/{id}), the parts that matter here */
export interface VoiceInfo {
  voice_id?: string;
  name?: string;
  labels?: Record<string, string | undefined>;
  verified_languages?: { language?: string; accent?: string; locale?: string }[];
}

/** why a voice may not read Portuguese, or null when it is Brazilian. It has
    to say so itself: a verified language of pt with a pt-BR locale or a
    Brazilian accent, or labels that say Brazilian */
export function brazilianProblem(v: VoiceInfo): string | null {
  const brazilian = (s?: string): boolean => !!s && /brazil|pt[-_]br/i.test(s);
  const verified = (v.verified_languages ?? []).filter((l) => /^pt/i.test(l.language ?? '') || /^pt/i.test(l.locale ?? ''));
  if (verified.some((l) => brazilian(l.locale) || brazilian(l.accent))) return null;
  const labels = v.labels ?? {};
  if (brazilian(labels.accent) || brazilian(labels.locale) || brazilian(labels.language)) return null;
  const found = [
    ...verified.map((l) => [l.language, l.accent, l.locale].filter(Boolean).join(' ')),
    ...Object.entries(labels).filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`),
  ];
  return `${v.name ?? v.voice_id ?? 'this voice'} is not marked as Brazilian Portuguese (found ${found.length ? found.join('; ') : 'nothing about its language'})`;
}

/** fetch, waiting and trying again when the service is busy (429) or failing (5xx) */
export async function fetchRetrying(
  url: string, init: RequestInit, fetcher: typeof fetch = fetch, wait = (ms: number) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetcher(url, init);
    if ((res.status !== 429 && res.status < 500) || attempt >= 4) return res;
    await wait(2000 * 2 ** attempt);
  }
}

async function mustBeBrazilian(key: string): Promise<void> {
  const res = await fetchRetrying(`${API}/voices/${VOICES['pt-commentator']}`, { headers: { 'xi-api-key': key } });
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status} for the commentator's voice: ${(await res.text()).slice(0, 300)}`);
  const problem = brazilianProblem(await res.json() as VoiceInfo);
  if (problem) throw new Error(`refusing to record Portuguese: ${problem}`);
}

async function speak(clip: Clip, key: string | undefined): Promise<Uint8Array> {
  const { url, init } = ttsRequest(clip, key);
  const res = await fetchRetrying(url, init);
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status} for "${clip.text}": ${(await res.text()).slice(0, 300)}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): string | null => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] ?? '' : null;
  };

  let list = clips();
  /* a collision would mean one line playing another line's recording */
  const byId = new Map<string, string>();
  for (const c of list) {
    const id = clipId(c.text);
    const clash = byId.get(id);
    if (clash) throw new Error(`"${c.text}" and "${clash}" both hash to ${id}: change clipId`);
    byId.set(id, c.text);
  }

  const listTo = flag('--list');
  if (listTo) {
    writeFileSync(resolve(listTo), list.map((c) => `${c.voice}\t${c.text}`).join('\n') + '\n');
    console.log(`${list.length} clips written to ${listTo}`);
    return;
  }
  const only = flag('--only');
  if (only) list = list.filter((c) => speakable(c.text) === speakable(only));
  if (only && !list.length) throw new Error(`the commentator never says "${only}": add it to src/content/commentary.ts first`);

  mkdirSync(OUT, { recursive: true });
  const already = new Set(readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
  const todo = list.filter((c) => !already.has(clipId(c.text)));
  console.log(`${list.length} clips wanted, ${list.length - todo.length} already recorded, ${todo.length} to do`);
  console.log(`about ${todo.reduce((n, c) => n + c.text.length + 1, 0)} characters to record, on ${MODEL}\n`);

  if (args.includes('--dry')) {
    for (const c of todo) console.log(' ', `${clipId(c.text)}.mp3`, c.voice, c.text);
    return;
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set: see public/audio/README.md');
  if (todo.some((c) => c.voice === 'pt-commentator')) await mustBeBrazilian(key);
  for (const c of todo) {
    writeFileSync(join(OUT, `${clipId(c.text)}.mp3`), await speak(c, key));
    console.log(`  ${clipId(c.text)}.mp3  ${c.text}`);
  }

  /* the manifest is what the app reads: it plays a clip only for a line
     listed here, and says everything else in the device voice */
  const shipped = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
  writeFileSync(join(OUT, 'clips.json'), JSON.stringify(shipped.sort()));
  console.log(`\nrecorded ${todo.length}, manifest lists ${shipped.length}`);
}

/* only when run as a command: the tests import clips() from here, and an
   import must not start recording anything */
const runDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  main().catch((err) => { console.error(String(err instanceof Error ? err.message : err)); process.exit(1); });
}
