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
  /** the context it plays in, for one from a buffer */
  on: unknown = null;
  constructor(kind: string) { this.kind = kind; FakeSource.made.push(this); }
  connect<T>(next: T): T { return next; }
  start(): void { /* scheduled */ }
  /** with no time it is a stop now; with one, the planned end */
  stop(at?: number): void { if (at === undefined) this.cut = true; else this.endsAt = at; }
}

const param = () => ({ value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });

class FakeContext {
  static made: FakeContext[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = {};
  resumed = 0;
  closed = false;
  constructor() { FakeContext.made.push(this); }
  createOscillator() { return new FakeSource('tone'); }
  createBufferSource() { const s = new FakeSource('noise'); s.on = this; return s; }
  createGain() { return { gain: param(), connect: <T>(n: T) => n }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: <T>(n: T) => n }; }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.resumed += 1; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
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
    const { sfx, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
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
    const { sfx, loadSfx, hushSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    sfx.crowd(5);
    const [crowd] = FakeSource.made;
    expect(crowd.loop).toBe(true);
    expect(crowd.endsAt).toBeCloseTo(5.02);
    hushSfx();
    expect(crowd.cut).toBe(true);
  });

  it('fetches the files as the app starts, and makes them ready on the first tap, which fetches nothing', async () => {
    const asked = serve({ 'sfx.json': { cheer: 0.5 }, 'cheer.mp3': { seconds: 1.5 } });
    const made = vi.fn();
    vi.stubGlobal('window', { AudioContext: class extends FakeContext { constructor() { super(); made(); } }, localStorage: { getItem: () => null, setItem: () => undefined } });
    const { sfx, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    expect(asked).toEqual(['sfx.json', 'cheer.mp3']);
    /* no sound before the tap, so no context to decode with yet */
    expect(made).not.toHaveBeenCalled();
    await unlockSfx();
    expect(asked).toHaveLength(2);
    sfx.cheer();
    expect(FakeSource.made.map((s) => s.buffer)).toEqual([{ duration: 1.5 }]);
  });

  it('a tap before the files have come: they are made ready as they come', async () => {
    serve({ 'sfx.json': { cheer: 0.5 }, 'cheer.mp3': { seconds: 1.5 } });
    const { sfx, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await unlockSfx();
    await loadSfx();
    sfx.cheer();
    expect(FakeSource.made.map((s) => s.buffer)).toEqual([{ duration: 1.5 }]);
  });

  it('makes every sound itself when the build has no recordings', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline and never cached'); });
    const { sfx, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    sfx.cheer();
    /* the crowd's noise and the rising third */
    expect(FakeSource.made.map((s) => s.kind)).toEqual(['noise', 'tone', 'tone']);
    expect(FakeSource.made[0].buffer).not.toEqual({ duration: expect.any(Number) });
  });

  it('keeps a sound made when its file will not load or decode', async () => {
    serve({ 'sfx.json': { kick: 0.8, roll: 0.7, whistle: 0.3 }, 'kick.mp3': 'broken', 'roll.mp3': { seconds: 1 } });
    const { sfx, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    sfx.kick();
    sfx.whistle();
    expect(FakeSource.made.every((s) => s.kind === 'tone')).toBe(true);
    FakeSource.made = [];
    sfx.roll();
    expect(FakeSource.made.map((s) => s.buffer)).toEqual([{ duration: 1 }]);
  });

  it('fetches only names it knows the shape of, and is quiet when sound effects are off', async () => {
    const asked = serve({ 'sfx.json': { '../../secret': 1, cheer: 'loud', win: 0.5 }, 'win.mp3': { seconds: 2 } });
    const { sfx, loadSfx, setSfxEnabled, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    expect(asked).toEqual(['sfx.json', 'win.mp3']);
    setSfxEnabled(false);
    sfx.win();
    sfx.cheer();
    expect(FakeSource.made).toEqual([]);
  });
});

describe('iOS silencing the sound effects', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeSource.made = [];
    FakeContext.made = [];
    vi.stubGlobal('window', { AudioContext: FakeContext, localStorage: { getItem: () => null, setItem: () => undefined } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('after other audio has played, the next tap makes a new context, and the recordings play in it', async () => {
    serve({ 'sfx.json': { cheer: 0.5 }, 'cheer.mp3': { seconds: 1.5 } });
    const { sfx, loadSfx, unlockSfx, staleSfx, wakeSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    const [first] = FakeContext.made;
    staleSfx();
    wakeSfx();
    expect(FakeContext.made).toHaveLength(2);
    expect(first.closed).toBe(true);
    const fresh = FakeContext.made[1];
    expect(fresh.resumed).toBe(1);
    sfx.cheer();
    expect(FakeSource.made.map((s) => [s.buffer, s.on === fresh])).toEqual([[{ duration: 1.5 }, true]]);
    /* and only once: the tap after leaves it be */
    wakeSfx();
    expect(FakeContext.made).toHaveLength(2);
  });

  it('one iOS says is interrupted is made anew; a suspended one is only resumed', async () => {
    const { sfx, wakeSfx } = await import('../../src/lib/sfx');
    sfx.tap();
    const [first] = FakeContext.made;
    first.state = 'suspended';
    wakeSfx();
    expect(first.resumed).toBe(1);
    expect(FakeContext.made).toHaveLength(1);
    first.state = 'interrupted';
    wakeSfx();
    expect(FakeContext.made).toHaveLength(2);
    expect(first.closed).toBe(true);
  });

  it('makes none before there is one, nor straight after the first: a new one has heard nothing yet', async () => {
    serve({ 'sfx.json': { cheer: 0.5 }, 'cheer.mp3': { seconds: 1.5 } });
    const { sfx, loadSfx, unlockSfx, staleSfx, wakeSfx } = await import('../../src/lib/sfx');
    /* the app went into the background before the first tap */
    staleSfx();
    wakeSfx();
    expect(FakeContext.made).toEqual([]);
    /* the first tap makes one and its recordings ready in it, and keeps it */
    await loadSfx();
    await unlockSfx();
    wakeSfx();
    expect(FakeContext.made).toHaveLength(1);
    sfx.cheer();
    expect(FakeSource.made.map((s) => s.buffer)).toEqual([{ duration: 1.5 }]);
  });
});
