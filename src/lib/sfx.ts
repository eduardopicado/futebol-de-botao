/* Little sounds: made in the browser, or recorded for the big moments.
 *
 * Every sound can be made here from a few tones, so with nothing else
 * shipped there is nothing to fetch and the app stays offline-capable and
 * request-free. Kept gentle: a rising third for right, a soft low thud for
 * wrong — never a buzzer.
 *
 * The big moments can also be recorded (tools/make-sfx.ts): a crowd, the
 * referee's whistle, a boot on the ball, a chess piece set down. The files
 * come from the app's own origin, listed in audio/sfx/sfx.json with how loud
 * each one plays, and load on the first tap. A sound plays its recording
 * once that has loaded; until then, and for every sound without one, the
 * made one plays as before. */

let ctx: AudioContext | null = null;
/* on or off is a setting (src/game/settings.ts), which sets
   this as the app starts */
let enabled = true;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

/** browsers suspend audio until a gesture, same as speech. The first tap
    also loads the recordings, now that there is a context to decode them */
export function unlockSfx(): void {
  try {
    void audio()?.resume();
  } catch {
    /* ignore */
  }
  void loadSfx();
}

/** the sounds that can be recorded; tools/make-sfx.ts says what each one is */
export type Recordable = 'cheer' | 'win' | 'whistle' | 'crowd' | 'kick' | 'clack' | 'post' | 'move' | 'take' | 'roll';

/** the recordings that have loaded, with how loud each one plays */
const recorded = new Map<string, { buffer: AudioBuffer; gain: number }>();
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
 * Loads the recorded sounds listed in sfx.json.
 *
 * A missing or unreadable list means this build has no recordings, and a
 * file that will not load or decode leaves that one sound made here: none of
 * it is an error.
 */
export function loadSfx(url = './audio/sfx/sfx.json'): Promise<void> {
  if (loading) return loading;
  const ac = audio();
  if (!ac) return Promise.resolve();
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
          const buffer = await decode(ac, await file.arrayBuffer());
          recorded.set(name, { buffer, gain: Math.min(1, Math.max(0.01, gain)) });
        } catch {
          /* this one stays made here */
        }
      }));
    } catch {
      /* no recordings: every sound is made here */
    }
  })();
  return loading;
}

/**
 * Wakes the sounds again after iOS has put them to sleep.
 *
 * The first tap is not enough on an iPad. When the screen locks, another app
 * plays audio, or the home-screen app is left and reopened, Safari moves the
 * audio context to "interrupted" (or "suspended") and it stays silent until
 * resumed inside another gesture. Cheap to ask, so every tap asks.
 */
export function wakeSfx(): void {
  try {
    if (ctx && ctx.state !== 'running') void ctx.resume();
  } catch {
    /* ignore */
  }
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
