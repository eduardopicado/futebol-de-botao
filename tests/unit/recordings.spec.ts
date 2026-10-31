/* The recordings in public/audio/ (tools/make-audio.ts, public/audio/README.md):
 * the lists the app reads say exactly what is there, every clip is something
 * the commentator says, and a new one is asked for in the same voice. */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MODEL, VOICES, brazilianProblem, clips, fetchRetrying, ttsRequest } from '../../tools/make-audio';
import { clipId } from '../../src/lib/clip-id';
import { EN_SAVES, PT_SAVES, enGoal, ptGoals } from '../../src/content/commentary';

const AUDIO = 'public/audio';
const mp3s = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();

describe('the commentator\'s recordings', () => {
  it('clips.json lists exactly the files there', () => {
    expect(JSON.parse(readFileSync(`${AUDIO}/clips.json`, 'utf8'))).toEqual(mp3s(AUDIO));
  });

  it('every one is something the commentator says, and no two lines share a file', () => {
    const lines = clips();
    const ids = new Set(lines.map((c) => clipId(c.text)));
    expect(ids.size).toBe(lines.length);
    expect(mp3s(AUDIO).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every goal and save is recorded, for every team, both ways; the champions not yet', () => {
    const have = new Set(mp3s(AUDIO));
    const missing = clips().filter((c) => !have.has(clipId(c.text))).map((c) => c.text);
    expect(missing.filter((line) => !/campeão|champions/i.test(line))).toEqual([]);
    for (const line of [...ptGoals('do Brasil'), ...ptGoals(), enGoal('Brazil'), enGoal(), ...PT_SAVES, ...EN_SAVES]) expect(have.has(clipId(line)), line).toBe(true);
  });

  it('English in English, Portuguese in the commentator\'s Brazilian voice', () => {
    const voices = new Map(clips().map((c) => [c.text, c.voice]));
    expect(voices.get('Goooool do Brasil!')).toBe('pt-commentator');
    expect(voices.get('É campeão!')).toBe('pt-commentator');
    expect(voices.get('Goooal for Brazil!')).toBe('en');
    expect(voices.get('What a save!')).toBe('en');
  });
});

describe('the sound effects\' recordings', () => {
  it('sfx.json lists exactly the files there, each with a volume', () => {
    const list = JSON.parse(readFileSync(`${AUDIO}/sfx/sfx.json`, 'utf8')) as Record<string, number>;
    expect(Object.keys(list).sort()).toEqual(mp3s(`${AUDIO}/sfx`));
    for (const [name, gain] of Object.entries(list)) {
      expect(gain, name).toBeGreaterThan(0);
      expect(gain, name).toBeLessThanOrEqual(1);
      expect(existsSync(`${AUDIO}/sfx/${name}.mp3`)).toBe(true);
    }
  });
});

describe('make:audio', () => {
  it('asks for a line in the voice and model the rest were made with', () => {
    const { url, init } = ttsRequest({ text: 'Na trave!', voice: 'pt-commentator' }, 'key');
    expect(url).toContain(`/text-to-speech/${VOICES['pt-commentator']}?`);
    expect(JSON.parse(String(init.body))).toMatchObject({ text: 'Na trave!', model_id: MODEL, language_code: 'pt' });
    const en = ttsRequest({ text: 'Off the post', voice: 'en' }, 'key');
    expect(en.url).toContain(`/text-to-speech/${VOICES.en}?`);
    /* said as a statement */
    expect(JSON.parse(String(en.init.body)).text).toBe('Off the post.');
  });

  it('records nothing without the key', () => {
    expect(() => ttsRequest({ text: 'Gol!', voice: 'pt-commentator' }, undefined)).toThrow(/ELEVENLABS_API_KEY/);
  });

  it('records Portuguese only in a voice ElevenLabs marks as Brazilian', () => {
    expect(brazilianProblem({ verified_languages: [{ language: 'pt', locale: 'pt-BR' }] })).toBeNull();
    expect(brazilianProblem({ labels: { accent: 'brazilian' } })).toBeNull();
    expect(brazilianProblem({ name: 'Lisboa', verified_languages: [{ language: 'pt', locale: 'pt-PT' }] })).toMatch(/Lisboa is not marked as Brazilian/);
  });

  it('waits and tries again when ElevenLabs is busy, and gives up after five', async () => {
    const answers = [429, 503, 200];
    const fetcher = vi.fn(async () => new Response('', { status: answers.shift() ?? 200 }));
    const waited: number[] = [];
    const res = await fetchRetrying('u', {}, fetcher as unknown as typeof fetch, async (ms) => { waited.push(ms); });
    expect(res.status).toBe(200);
    expect(waited).toEqual([2000, 4000]);
    const busy = vi.fn(async () => new Response('', { status: 429 }));
    expect((await fetchRetrying('u', {}, busy as unknown as typeof fetch, async () => undefined)).status).toBe(429);
    expect(busy).toHaveBeenCalledTimes(5);
  });
});
