/* Sound effects: leaving a game silences what it was still playing, and a
 * recorded sound plays where one was made, with the made one everywhere else.
 *
 *   npm run test:unit */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** a scheduled sound, remembering whether it was cut off early */
class FakeSource {
  static made: FakeSource[] = [];
  kind: string;
  cut = false;
  loop = false;
  /** when it was planned to end, if it was */
  endsAt: number | null = null;
  onended: (() => void) | null = null;
  frequency = { value: 0 };
  type = '';
  buffer: unknown = null;
  constructor(kind: string) { this.kind = kind; FakeSource.made.push(this); }
  connect<T>(next: T): T { return next; }
  start(): void { /* scheduled */ }
  /** with no time it is a stop now; with one, the planned end */
  stop(at?: number): void { if (at === undefined) this.cut = true; else this.endsAt = at; }
}

const param = () => ({ value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });

class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = {};
  createOscillator() { return new FakeSource('tone'); }
  createBufferSource() { return new FakeSource('noise'); }
  createGain() { return { gain: param(), connect: <T>(n: T) => n }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: <T>(n: T) => n }; }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { return Promise.resolve(); }
  /** a file is a note of how long it lasts, or 'broken' for one that will not decode */
  decodeAudioData(data: unknown, done: (b: unknown) => void, fail: (e: Error) => void): void {
    if (data === 'broken') fail(new Error('EncodingError'));
    else done({ duration: (data as { seconds: number }).seconds });
  }
}

/** what the build ships under audio/sfx/: sfx.json and the files it lists */
function serve(files: Record<string, unknown>): string[] {
  const asked: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const name = url.split('/').pop()!;
    asked.push(name);
    const ok = name in files;
    return { ok, json: async () => files[name], arrayBuffer: async () => files[name] };
  });
  return asked;
}

describe('leaving a game', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeSource.made = [];
    vi.stubGlobal('window', { AudioContext: FakeContext, localStorage: { getItem: () => null, setItem: () => undefined } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('stops a crowd and a fanfare that are still playing', async () => {
    const { sfx, hushSfx } = await import('../../src/lib/sfx');
    sfx.cheer();
    sfx.win();
    hushSfx();
    expect(FakeSource.made.length).toBeGreaterThan(4);
    expect(FakeSource.made.every((s) => s.cut)).toBe(true);
  });

  it('lets the click of the tap that left it finish', async () => {
    const { sfx, hushSfx } = await import('../../src/lib/sfx');
    sfx.tap();
    hushSfx();
    expect(FakeSource.made).toHaveLength(1);
    expect(FakeSource.made[0].cut).toBe(false);
  });

  it('forgets a sound once it has ended', async () => {
    const { sfx, hushSfx } = await import('../../src/lib/sfx');
    sfx.wrong();
    for (const s of FakeSource.made) s.onended?.();
    hushSfx();
    expect(FakeSource.made.some((s) => s.cut)).toBe(false);
  });
});

describe('recorded sounds', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeSource.made = [];
    vi.stubGlobal('window', { AudioContext: FakeContext, localStorage: { getItem: () => null, setItem: () => undefined } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('plays the recording where one was made, and the made sound where not', async () => {
    serve({ 'sfx.json': { cheer: 0.5 }, 'cheer.mp3': { seconds: 1.5 } });
    const { sfx, loadSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    sfx.cheer();
    expect(FakeSource.made).toHaveLength(1);
    expect(FakeSource.made[0].buffer).toEqual({ duration: 1.5 });
    /* nothing was recorded for the kick, so it is the two made tones */
    FakeSource.made = [];
    sfx.kick();
    expect(FakeSource.made.map((s) => s.kind)).toEqual(['tone', 'tone']);
  });

  it('loops the crowd for as long as asked, and leaving the game stops it', async () => {
    serve({ 'sfx.json': { crowd: 0.25 }, 'crowd.mp3': { seconds: 8 } });
    const { sfx, loadSfx, hushSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    sfx.crowd(5);
    const [crowd] = FakeSource.made;
    expect(crowd.loop).toBe(true);
    expect(crowd.endsAt).toBeCloseTo(5.02);
    hushSfx();
    expect(crowd.cut).toBe(true);
  });

  it('makes every sound itself when the build has no recordings', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline and never cached'); });
    const { sfx, loadSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    sfx.cheer();
    /* the crowd's noise and the rising third */
    expect(FakeSource.made.map((s) => s.kind)).toEqual(['noise', 'tone', 'tone']);
    expect(FakeSource.made[0].buffer).not.toEqual({ duration: expect.any(Number) });
  });

  it('keeps a sound made when its file will not load or decode', async () => {
    serve({ 'sfx.json': { kick: 0.8, roll: 0.7, whistle: 0.3 }, 'kick.mp3': 'broken', 'roll.mp3': { seconds: 1 } });
    const { sfx, loadSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    sfx.kick();
    sfx.whistle();
    expect(FakeSource.made.every((s) => s.kind === 'tone')).toBe(true);
    FakeSource.made = [];
    sfx.roll();
    expect(FakeSource.made.map((s) => s.buffer)).toEqual([{ duration: 1 }]);
  });

  it('fetches only names it knows the shape of, and is quiet when sound effects are off', async () => {
    const asked = serve({ 'sfx.json': { '../../secret': 1, cheer: 'loud', win: 0.5 }, 'win.mp3': { seconds: 2 } });
    const { sfx, loadSfx, setSfxEnabled } = await import('../../src/lib/sfx');
    await loadSfx();
    expect(asked).toEqual(['sfx.json', 'win.mp3']);
    setSfxEnabled(false);
    sfx.win();
    sfx.cheer();
    expect(FakeSource.made).toEqual([]);
  });
});
