/* Little sounds: made in the browser, or recorded for the big moments.
 *
 * Every sound can be made here from a few tones, so with nothing else
 * shipped there is nothing to fetch and the app stays offline-capable and
 * request-free. Kept gentle: a rising third for right, a soft low thud for
 * wrong — never a buzzer.
 *
 * The big moments can also be recorded (public/audio/README.md): a crowd, the
 * referee's whistle, a boot on the ball, a chess piece set down. The files
 * come from the app's own origin, listed in audio/sfx/sfx.json with how loud
 * each one plays. They are fetched as the app starts and made ready on the
 * first tap, which fetches nothing: a tap that also asked the offline worker
 * for files could leave a new version waiting for good in Chrome, and the
 * first tap may be the one on "New version". A sound plays its recording
 * once that is ready; until then, and for every sound without one, the made
 * one plays as before. */

let ctx: AudioContext | null = null;
/* on or off is a setting (src/game/settings.ts), which sets
   this as the app starts */
let enabled = true;
/* iOS can silence the context while it still says it is running, and
   resume() does not always bring it back: after the page's other audio has
   played (a recording of the commentator, src/lib/audio.ts, which an audio
   element plays and which carries on through it), or after the app has been
   in the background. After either, the next tap makes a new context, as it
   does for one iOS says is interrupted. */
let stale = false;

/* The commentator's recordings (src/lib/audio.ts) play through this same
   context, so there is one way out for every sound and iOS has no other
   audio to silence this one for. Told of each new context, inside the tap
   that made it, so the recordings follow it there. */
let follow: ((ac: AudioContext) => void) | null = null;
export function followContext(fn: (ac: AudioContext) => void): void {
  follow = fn;
  if (ctx) fn(ctx);
}

/** start a context, or try to: one that will not start (WebKit with no
    sound device says "AudioDestinationNode is not initialized") only means
    no sound, never an error */
function start(ac: AudioContext | null): void {
  try {
    void ac?.resume()?.catch(() => undefined);
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    /* a new one has heard nothing yet */
    stale = false;
    try { follow?.(ctx); } catch { /* the recordings play on their own */ }
    return ctx;
  } catch {
    return null;
  }
}

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

/** browsers suspend audio until a gesture, same as speech. The first tap
    also makes the recordings ready, now that there is a context to decode
    them with; done when they are */
export function unlockSfx(): Promise<void> {
  const ac = audio();
  start(ac);
  return ac ? decodeAll(ac) : Promise.resolve();
}

/** the sounds that can be recorded (tools/make-sfx.ts says what each one is) */
export type Recordable = 'cheer' | 'win' | 'whistle' | 'crowd' | 'kick' | 'clack' | 'post' | 'move' | 'take' | 'roll' | 'roar' | 'groan' | 'torcida' | 'torcida2' | 'torcida3';

/** the recordings that are ready, with how loud each one plays */
const recorded = new Map<string, { buffer: AudioBuffer; gain: number }>();
/** and the files fetched, not decoded yet */
const fetched = new Map<string, { data: ArrayBuffer; gain: number }>();
let loading: Promise<void> | null = null;

/** the callback form, which every Safari has; newer engines also return a
    promise, which rejects as well as calling back, so it is caught */
function decode(ac: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((done, fail) => {
    try {
      void ac.decodeAudioData(data, done, fail)?.catch(() => undefined);
    } catch (e) {
      fail(e);
    }
  });
}

/**
 * Fetches the recorded sounds listed in sfx.json, as the app starts; they
 * are decoded once there is a context (unlockSfx), or here if there already is.
 *
 * A missing or unreadable list means this build has no recordings, and a
 * file that will not load or decode leaves that one sound made here: none of
 * it is an error.
 */
export function loadSfx(url = './audio/sfx/sfx.json'): Promise<void> {
  if (loading) return loading;
  const dir = url.replace(/\/[^/]*$/, '');
  loading = (async () => {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) return;
      const list: unknown = await res.json();
      if (!list || typeof list !== 'object') return;
      await Promise.all(Object.entries(list).map(async ([name, gain]) => {
        if (!/^[a-z]+$/.test(name) || typeof gain !== 'number') return;
        try {
          const file = await fetch(`${dir}/${name}.mp3`, { cache: 'force-cache' });
          if (!file.ok) return;
          fetched.set(name, { data: await file.arrayBuffer(), gain: Math.min(1, Math.max(0.01, gain)) });
        } catch {
          /* this one stays made here */
        }
      }));
    } catch {
      /* no recordings: every sound is made here */
    }
    /* a tap before they had all come has made the context already */
    if (ctx) await decodeAll(ctx);
  })();
  return loading;
}

/** the files fetched, made into sounds to play: each one once */
async function decodeAll(ac: AudioContext): Promise<void> {
  await Promise.all([...fetched].map(async ([name, { data, gain }]) => {
    fetched.delete(name);
    try {
      recorded.set(name, { buffer: await decode(ac, data), gain });
    } catch {
      /* this one stays made here */
    }
  }));
}

/** the context may have been silenced (see `stale`): make a new one at the next tap */
export function staleSfx(): void {
  stale = true;
}

/**
 * Wakes the sounds again after iOS has put them to sleep.
 *
 * The first tap is not enough on an iPad. When the screen locks, another app
 * plays audio, or the home-screen app is left and reopened, Safari moves the
 * audio context to "interrupted" (or "suspended") and it stays silent until
 * resumed inside another gesture; or it says it is running and is silent all
 * the same. Cheap to ask, so every tap asks: a suspended context is resumed,
 * and one that is interrupted, or may have been silenced, is made anew.
 */
export function wakeSfx(): void {
  try {
    if (!ctx) return;
    if (stale || (ctx.state as string) === 'interrupted') renew();
    else if (ctx.state !== 'running') start(ctx);
  } catch {
    /* ignore */
  }
}

/** a new context in place of the old, inside the tap that asked for it, so
    iOS lets it start: what the old one was still playing stops with it, and
    the recordings carry over, as a decoded sound belongs to no context */
function renew(): void {
  const old = ctx;
  stale = false;
  ctx = null;
  playing.clear();
  try {
    void old?.close().catch(() => undefined);
  } catch {
    /* already closed */
  }
  start(audio());
}

interface Note { hz: number; at: number; for: number; gain?: number; type?: OscillatorType }

/* Everything scheduled and not yet finished, with when it ends, so leaving a
   game can silence it: a crowd murmur runs as long as the take it sits
   under, and a fanfare lasts most of a second. */
const playing = new Map<AudioScheduledSourceNode, number>();

function track(source: AudioScheduledSourceNode, end: number): void {
  playing.set(source, end);
  source.onended = () => playing.delete(source);
}

/** a tap's click is over almost before the next screen opens: let it finish */
const MOMENT = 0.15;

/** stop the sound effects still playing. Called when a game is left; the
    click of the tap that left it is allowed to finish */
export function hushSfx(): void {
  const now = ctx?.currentTime ?? 0;
  for (const [source, end] of playing) {
    if (end - now <= MOMENT) continue;
    try { source.stop(); } catch { /* not started, or already over */ }
    playing.delete(source);
  }
}

function play(notes: Note[]): void {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    for (const note of notes) {
      const osc = ac.createOscillator();
      const vol = ac.createGain();
      osc.type = note.type ?? 'sine';
      osc.frequency.value = note.hz;
      const start = now + note.at;
      const peak = note.gain ?? 0.16;
      /* ramped rather than switched, so nothing clicks */
      vol.gain.setValueAtTime(0.0001, start);
      vol.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      vol.gain.exponentialRampToValueAtTime(0.0001, start + note.for);
      osc.connect(vol).connect(ac.destination);
      osc.start(start);
      osc.stop(start + note.for + 0.02);
      track(osc, start + note.for + 0.02);
    }
  } catch {
    /* a game without sound effects is still a game */
  }
}

/**
 * A burst of filtered noise: the nearest thing to a crowd that three lines
 * of Web Audio can make. Band-passed so it is a roar and not a hiss, and
 * swelled in and out so it never clicks.
 */
function noise(seconds: number, peak: number): void {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  try {
    const length = Math.floor(ac.sampleRate * seconds);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.6;
    const vol = ac.createGain();
    const now = ac.currentTime;
    vol.gain.setValueAtTime(0.0001, now);
    vol.gain.exponentialRampToValueAtTime(peak, now + seconds * 0.25);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(band).connect(vol).connect(ac.destination);
    source.start(now);
    source.stop(now + seconds + 0.02);
    track(source, now + seconds + 0.02);
  } catch {
    /* no crowd, still a goal */
  }
}

/**
 * Plays the recording of a sound, once, or looped for `seconds` and swelled
 * in and out the way the made crowd is. False if there is none (or it would
 * not start), so the made sound plays instead.
 */
function recording(name: Recordable, seconds?: number): boolean {
  const take = recorded.get(name);
  if (!take || !ctx) return false;
  try {
    const source = ctx.createBufferSource();
    source.buffer = take.buffer;
    const vol = ctx.createGain();
    const now = ctx.currentTime;
    let end = now + take.buffer.duration;
    if (seconds) {
      source.loop = true;
      end = now + seconds;
      vol.gain.setValueAtTime(0.0001, now);
      vol.gain.exponentialRampToValueAtTime(take.gain, now + seconds * 0.25);
      vol.gain.setValueAtTime(take.gain, end - seconds * 0.25);
      vol.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      vol.gain.value = take.gain;
    }
    source.connect(vol).connect(ctx.destination);
    source.start(now);
    if (seconds) source.stop(end + 0.02);
    track(source, end + 0.02);
    return true;
  } catch {
    return false;
  }
}

/** the recording of a sound where there is one, and the made one otherwise */
function sound(name: Recordable, made: () => void): void {
  if (!enabled) return;
  if (!recording(name)) made();
}

const TAP: Note[] = [{ hz: 520, at: 0, for: 0.05, gain: 0.07 }];
const KICK: Note[] = [
  { hz: 120, at: 0, for: 0.08, gain: 0.3 },
  { hz: 70, at: 0.02, for: 0.12, gain: 0.2 },
];
const CRACK: Note[] = [
  { hz: 140, at: 0, for: 0.12, type: 'sawtooth', gain: 0.09 },
  { hz: 95, at: 0.08, for: 0.16, type: 'sawtooth', gain: 0.07 },
];

export const sfx = {
  /** a bright rising third */
  right: () => play([{ hz: 660, at: 0, for: 0.12 }, { hz: 880, at: 0.09, for: 0.18 }]),
  /** low and short — a nudge, not a buzzer */
  wrong: () => play([{ hz: 180, at: 0, for: 0.16, type: 'triangle', gain: 0.12 }]),
  /** the little click of a card or tile */
  tap: () => play(TAP),
  /** something landed in the right place */
  land: () => play([{ hz: 440, at: 0, for: 0.08 }, { hz: 660, at: 0.06, for: 0.12 }]),
  /** a fanfare for finishing */
  win: () => sound('win', () => play([
    { hz: 523, at: 0, for: 0.16 },
    { hz: 659, at: 0.13, for: 0.16 },
    { hz: 784, at: 0.26, for: 0.16 },
    { hz: 1047, at: 0.39, for: 0.34 },
  ])),
  /** a quick upward sweep — something caught in flight */
  zap: () => play([
    { hz: 700, at: 0, for: 0.06, type: 'square', gain: 0.06 },
    { hz: 1050, at: 0.05, for: 0.1, type: 'square', gain: 0.05 },
  ]),
  /** a thud and a rattle — a shield taking a hit */
  crack: () => play(CRACK),
  /** three falling notes for a round that is over */
  over: () => play([
    { hz: 494, at: 0, for: 0.18, type: 'triangle' },
    { hz: 392, at: 0.18, for: 0.18, type: 'triangle' },
    { hz: 294, at: 0.36, for: 0.34, type: 'triangle' },
  ]),
  /** boot on ball: a low, short thump */
  kick: () => sound('kick', () => play(KICK)),
  /** a little plastic player or button striking the ball: foosball and botão */
  clack: () => sound('clack', () => play(KICK)),
  /** the ball off the post */
  post: () => sound('post', () => play(CRACK)),
  /** a chess piece set down on its square */
  move: () => sound('move', () => play(TAP)),
  /** a chess piece taking another */
  take: () => sound('take', () => play(KICK)),
  /** the referee: two short blasts */
  whistle: () => sound('whistle', () => play([
    { hz: 2200, at: 0, for: 0.12, gain: 0.06 },
    { hz: 2300, at: 0.17, for: 0.28, gain: 0.06 },
  ])),
  /** a crowd murmuring under the commentary, for as long as asked */
  crowd: (seconds: number) => {
    const s = Math.max(1, seconds);
    if (enabled && !recording('crowd', s)) noise(s, 0.07);
  },
  /** a goal in a match: the stadium going up, or the cheer where it is not recorded */
  roar: () => sound('roar', () => sfx.cheer()),
  /** a shot just wide, off the post or saved: the crowd's "uuuh" */
  groan: () => sound('groan', () => {
    noise(1.4, 0.1);
    play([{ hz: 330, at: 0.1, for: 0.5, type: 'triangle', gain: 0.06 }, { hz: 247, at: 0.5, for: 0.7, type: 'triangle', gain: 0.05 }]);
  }),
  /** a goal or a save, or any right answer: the crowd, and the rising third on top */
  cheer: () => sound('cheer', () => {
    noise(1.3, 0.22);
    play([{ hz: 660, at: 0.05, for: 0.12 }, { hz: 880, at: 0.14, for: 0.2 }]);
  }),
  /** the tumble of the die */
  roll: () => sound('roll', () => play([
    { hz: 300, at: 0, for: 0.05, type: 'square', gain: 0.05 },
    { hz: 260, at: 0.12, for: 0.05, type: 'square', gain: 0.05 },
    { hz: 340, at: 0.26, for: 0.05, type: 'square', gain: 0.05 },
    { hz: 420, at: 0.44, for: 0.08, type: 'square', gain: 0.05 },
  ])),
};

/** a crowd watching a flick: `to` says how near the ball is to a goal, from
    0 (nowhere near) to 1 (in the mouth), and `done` lets it die away */
export interface Watching { to: (near: number) => void; done: () => void; live: () => boolean }

const QUIET: Watching = { to: () => undefined, done: () => undefined, live: () => false };

/**
 * The crowd's murmur under a flick, swelling as the ball nears a goal and
 * dying away when the flick is over: its recording looped, or noise made
 * here. Quiet with the ball far from both goals, so a flick in midfield is
 * not drowned; louder with the square of how near it is, so it builds.
 *
 * With `floor` above 0 it is the supporters all match long: never quieter
 * than that share of its loudest, singing if their recording is there (the
 * torcida) and murmuring if not. It lasts until it is done or the game is
 * left; `live` says whether it can still be heard (iOS can take its audio
 * context away), so whoever holds it knows to start another.
 */
export function watching(floor = 0): Watching {
  if (!enabled) return QUIET;
  const ac = audio();
  if (!ac) return QUIET;
  try {
    /* the supporters sing one of their songs, a different one from match to match */
    const songs = (['torcida', 'torcida2', 'torcida3'] as const).flatMap((n) => recorded.get(n) ?? []);
    const take = (floor > 0 && songs.length ? songs[Math.floor(Math.random() * songs.length)] : undefined) ?? recorded.get('crowd');
    const source = ac.createBufferSource();
    const vol = ac.createGain();
    let peak: number;
    if (take) {
      source.buffer = take.buffer;
      peak = Math.min(1, take.gain * 2.4);
      source.connect(vol);
    } else {
      const length = Math.floor(ac.sampleRate * 2);
      const buffer = ac.createBuffer(1, length, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
      const band = ac.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 0.6;
      source.connect(band).connect(vol);
      peak = 0.12;
    }
    source.loop = true;
    vol.gain.setValueAtTime(0.0001, ac.currentTime);
    if (floor > 0) vol.gain.setTargetAtTime(peak * floor, ac.currentTime, 0.6);
    vol.connect(ac.destination);
    source.start(ac.currentTime);
    /* until it is done: leaving the game hushes it before then */
    track(source, Number.POSITIVE_INFINITY);
    let over = false;
    return {
      to: (near) => {
        if (over) return;
        const k = Math.min(1, Math.max(0, near));
        try { vol.gain.setTargetAtTime(Math.max(0.0001, peak * Math.max(floor, k * k)), ac.currentTime, 0.12); } catch { /* its context was renewed */ }
      },
      live: () => !over && ac === audio() && ac.state === 'running' && playing.has(source),
      done: () => {
        if (over) return;
        over = true;
        try {
          const now = ac.currentTime;
          vol.gain.setTargetAtTime(0.0001, now, 0.25);
          source.stop(now + 1.2);
          playing.set(source, now + 1.2);
        } catch {
          /* hushed already */
        }
      },
    };
  } catch {
    return QUIET;
  }
}
