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

/** an audio parameter, remembering the values it was asked to move towards */
const param = () => {
  const p = { value: 0, targets: [] as number[], setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined, setTargetAtTime: (v: number) => { p.targets.push(v); } };
  return p;
};

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
  gains: { gain: ReturnType<typeof param> }[] = [];
  createGain() { const g = { gain: param(), connect: <T>(n: T) => n }; this.gains.push(g); return g; }
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

describe('the crowd', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeSource.made = [];
    FakeContext.made = [];
    vi.stubGlobal('window', { AudioContext: FakeContext, localStorage: { getItem: () => null, setItem: () => undefined } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('watching a flick: its murmur looped, louder the nearer the ball comes to a goal, dying away when it is over', async () => {
    serve({ 'sfx.json': { crowd: 0.25 }, 'crowd.mp3': { seconds: 8 } });
    const { watching, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    const crowd = watching();
    const murmur = FakeSource.made.at(-1)!;
    expect([murmur.loop, murmur.buffer]).toEqual([true, { duration: 8 }]);
    const { gain } = FakeContext.made[0].gains.at(-1)!;
    crowd.to(0);
    crowd.to(0.3);
    crowd.to(1);
    const [none, far, near] = gain.targets;
    expect(none).toBeLessThan(0.001);
    expect(near).toBeGreaterThan(far * 5);
    crowd.done();
    expect(gain.targets.at(-1)).toBeLessThan(0.001);
    expect(murmur.endsAt).not.toBeNull();
    /* and nothing after it is over */
    crowd.to(1);
    expect(gain.targets.at(-1)).toBeLessThan(0.001);
  });

  it('the supporters all match long: their own recording, never silent between flicks, louder near a goal, and gone when the game is left', async () => {
    serve({ 'sfx.json': { crowd: 0.25, torcida: 0.3 }, 'crowd.mp3': { seconds: 8 }, 'torcida.mp3': { seconds: 22 } });
    const { watching, loadSfx, unlockSfx, hushSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    const crowd = watching(0.3);
    const song = FakeSource.made.at(-1)!;
    expect([song.loop, song.buffer]).toEqual([true, { duration: 22 }]);
    expect(crowd.live()).toBe(true);
    const { gain } = FakeContext.made[0].gains.at(-1)!;
    const start = gain.targets.at(-1)!;
    expect(start).toBeGreaterThan(0.05);
    crowd.to(0);
    crowd.to(0.3);
    crowd.to(1);
    const [none, far, near] = gain.targets.slice(-3);
    /* between flicks, and with the ball in midfield: still there */
    expect(none).toBeCloseTo(start, 6);
    expect(far).toBeCloseTo(start, 6);
    expect(near).toBeGreaterThan(start * 2);
    /* a flick under way without them still gets the murmur */
    watching();
    expect(FakeSource.made.at(-1)!.buffer).toEqual({ duration: 8 });
    hushSfx();
    expect(song.cut).toBe(true);
    expect(crowd.live()).toBe(false);
  });

  it('the supporters murmur where their song is not recorded', async () => {
    serve({ 'sfx.json': { crowd: 0.25 }, 'crowd.mp3': { seconds: 8 } });
    const { watching, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    await loadSfx();
    await unlockSfx();
    watching(0.3);
    expect(FakeSource.made.at(-1)!.buffer).toEqual({ duration: 8 });
  });

  it('made from noise where it is not recorded; leaving the game hushes it; none with sound effects off', async () => {
    const { watching, hushSfx, setSfxEnabled } = await import('../../src/lib/sfx');
    watching().to(1);
    const murmur = FakeSource.made.at(-1)!;
    expect([murmur.kind, murmur.loop]).toEqual(['noise', true]);
    hushSfx();
    expect(murmur.cut).toBe(true);
    setSfxEnabled(false);
    const before = FakeSource.made.length;
    watching().to(1);
    expect(FakeSource.made).toHaveLength(before);
  });

  it('a goal roars and a near miss groans: their recordings, or the cheer and a groan made here', async () => {
    serve({ 'sfx.json': { roar: 0.5, groan: 0.45 }, 'roar.mp3': { seconds: 3.5 }, 'groan.mp3': { seconds: 2 } });
    const { sfx, loadSfx, unlockSfx } = await import('../../src/lib/sfx');
    sfx.roar();
    sfx.groan();
    const made = FakeSource.made.map((s) => s.kind);
    expect(made).toContain('noise');
    expect(made).toContain('tone');
    expect(FakeSource.made.every((s) => s.buffer === null || (s.buffer as { duration?: number }).duration === undefined)).toBe(true);
    FakeSource.made = [];
    await loadSfx();
    await unlockSfx();
    sfx.roar();
    sfx.groan();
    expect(FakeSource.made.map((s) => s.buffer)).toEqual([{ duration: 3.5 }, { duration: 2 }]);
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

  it('a context that will not start is no error: its refusal to resume is caught, at the first tap, a renewal, and a resume', async () => {
    /* as WebKit does with no sound device: "AudioDestinationNode is not initialized" */
    class Refusing extends FakeContext {
      resume() { this.resumed += 1; return Promise.reject(new Error('InvalidStateError: AudioDestinationNode is not initialized')); }
    }
    vi.stubGlobal('window', { AudioContext: Refusing, localStorage: { getItem: () => null, setItem: () => undefined } });
    const unhandled: unknown[] = [];
    const note = (e: unknown): void => { unhandled.push(e); };
    process.on('unhandledRejection', note);
    try {
      const { unlockSfx, staleSfx, wakeSfx } = await import('../../src/lib/sfx');
      await unlockSfx();
      FakeContext.made[0].state = 'suspended';
      wakeSfx();
      staleSfx();
      wakeSfx();
      expect(FakeContext.made.map((c) => c.resumed)).toEqual([2, 1]);
      await new Promise((done) => setTimeout(done, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', note);
    }
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

describe("the commentator's recordings, through the same sound", () => {
  /** an audio element that plays at once, and the contexts it is joined to */
  class FakeElement {
    static made: FakeElement[] = [];
    src = '';
    paused = true;
    onended: (() => void) | null = null;
    currentTime = 0;
    playbackRate = 1;
    defaultPlaybackRate = 1;
    joined: unknown[] = [];
    constructor() { FakeElement.made.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  class JoiningContext extends FakeContext {
    createMediaElementSource(el: FakeElement) {
      el.joined.push(this);
      return { connect: (n: unknown) => n };
    }
  }

  beforeEach(() => {
    vi.resetModules();
    FakeContext.made = [];
    FakeElement.made = [];
    vi.stubGlobal('Audio', FakeElement);
    vi.stubGlobal('window', { AudioContext: JoiningContext, localStorage: { getItem: () => null, setItem: () => undefined } });
    vi.stubGlobal('document', { hidden: false });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a recording plays through the sound effects\' context, and leaves them awake: no new context at the next tap', async () => {
    const { clipId } = await import('../../src/lib/clip-id');
    serve({ 'clips.json': [clipId('Gol!')], 'sfx.json': {} });
    const { loadClips, playClip } = await import('../../src/lib/audio');
    const sfx = await import('../../src/lib/sfx');
    await loadClips('./audio/clips.json');
    await sfx.unlockSfx();
    const [ac] = FakeContext.made;
    expect(await playClip('Gol!')).toBe(true);
    const el = FakeElement.made.at(-1)!;
    expect(el.joined).toEqual([ac]);
    /* the next tap: the same context, still running */
    sfx.wakeSfx();
    expect(FakeContext.made).toHaveLength(1);
  });

  it('a new context, after the app was away, gets a new element joined to it in the same tap', async () => {
    serve({ 'clips.json': [], 'sfx.json': {} });
    const audio = await import('../../src/lib/audio');
    const sfx = await import('../../src/lib/sfx');
    await sfx.unlockSfx();
    const first = FakeElement.made.at(-1)!;
    sfx.staleSfx();
    sfx.wakeSfx();
    expect(FakeContext.made).toHaveLength(2);
    const second = FakeElement.made.at(-1)!;
    expect(second).not.toBe(first);
    expect(second.joined).toEqual([FakeContext.made[1]]);
    expect(first.joined).toEqual([FakeContext.made[0]]);
    void audio;
  });
});
