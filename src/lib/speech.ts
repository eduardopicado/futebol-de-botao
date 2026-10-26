/* Speech, defensively.
 *
 * The family is in Australia and also speaks Portuguese, so an English word
 * read by the device's default voice comes out mangled. We hunt for en-AU,
 * fall back to en-GB, then any English voice, and never inherit the device
 * language.
 *
 * Apple ships three tiers of each voice and only the worst one is installed by
 * default. They are told apart by the identifier, not the name — Karen may be
 * com.apple.voice.compact.en-AU.Karen or ...enhanced... or ...premium... — so
 * a device can offer two voices called "Karen" that sound nothing alike. We
 * rank by tier and pick the best installed, which is the most a web page can
 * do: a voice that has not been downloaded in Settings simply is not in the
 * list, and Siri's voices are never exposed to the web at all.
 *
 * Reading `window.speechSynthesis` can itself throw in some embedded contexts,
 * which is what produced the prototypes' unattributed "Script error." — so
 * even reaching for the object is inside a try. On iOS nothing is spoken until
 * a user gesture has happened, so the first tap in the app unlocks it. */

import { hasClip, playClip, stopClips } from './audio';

let cached: SpeechSynthesisVoice | null = null;
/**
 * The utterance being said now, if any.
 *
 * Two jobs. Its end is reported only while it is still this one: stopping
 * speech makes the engine fire `error` (Chrome) or `end` (Safari) on whatever
 * it was saying, and passing that on as "finished" let a game that had just
 * been left carry on — the commentator's "Goooool!" was cut off on the way
 * out and the word after it was then said over the home screen. And holding
 * it here keeps it from being garbage-collected mid-sentence, which in some
 * engines means its end never fires at all.
 */
let speaking: SpeechSynthesisUtterance | null = null;
let unlocked = false;
let enabled = true;
/** a voice the parent chose by hand, which beats anything we would rank */
let preferredURI: string | null = null;
const voiceListeners = new Set<() => void>();
let lastSignature = '';

function engine(): SpeechSynthesis | null {
  try {
    return window.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

/* accent first: an Australian child is learning Australian vowels */
const ACCENT_RANK: [RegExp, number][] = [
  [/^en[-_]AU/i, 0],
  [/^en[-_]GB/i, 1],
  [/^en[-_]NZ/i, 2],
  [/^en[-_]IE/i, 3],
  [/^en/i, 4],
];

export type Quality =
  | 'premium' | 'enhanced' | 'compact' | 'super-compact' | 'unknown' | 'retro' | 'novelty';

/**
 * Apple puts the tier in the identifier; other engines name theirs in words.
 *
 * "compact" sounds like the worst of the bunch and is not: it is the ordinary
 * Siri-family voice and the sensible baseline. The genuinely poor ones carry
 * no tier marker at all — the Eloquence set (com.apple.eloquence.*), which is
 * the retro speech engine, and the novelty voices (Bubbles, Zarvox and
 * friends) — so anything unmarked must rank below compact, never above it.
 *
 * "super-compact" is the exception that has to be tested first: it is the
 * cut-down voice iOS keeps for low memory, it sounds worse than compact, and
 * its identifier ends in the word "compact" — so a plain substring check reads
 * it as the better tier. An iPad really does offer both
 * com.apple.voice.compact.en-US.Samantha and ...super-compact..., and calling
 * them the same tier let the dedupe below drop whichever came first.
 */
export function qualityOf(voice: SpeechSynthesisVoice): Quality {
  const id = `${voice.voiceURI} ${voice.name}`.toLowerCase();
  if (id.includes('premium')) return 'premium';
  if (id.includes('enhanced') || id.includes('neural') || id.includes('natural')) return 'enhanced';
  if (id.includes('eloquence')) return 'retro';
  if (id.includes('com.apple.speech.synthesis.voice.')) return 'novelty';
  if (/super[-_ ]?compact/.test(id)) return 'super-compact';
  if (id.includes('compact')) return 'compact';
  return 'unknown';
}

const QUALITY_RANK: Record<Quality, number> = {
  premium: 0, enhanced: 1, compact: 2, 'super-compact': 3,
  unknown: 4, retro: 5, novelty: 6,
};

/** English voices this device actually has, best first */
export function englishVoices(): SpeechSynthesisVoice[] {
  const synth = engine();
  if (!synth) return [];
  try {
    const ranked = synth.getVoices()
      .filter((v) => ACCENT_RANK.some(([re]) => re.test(v.lang)))
      .sort((a, b) => score(a) - score(b));
    /* iOS lists the same voice twice — an iPad shows two Samanthas that are
       indistinguishable to a parent. Collapse anything matching in name,
       accent and tier, keeping the better-ranked one. Two tiers of the same
       name stay apart, because choosing between them is the whole point. */
    const seen = new Set<string>();
    return ranked.filter((v) => {
      const key = `${v.name}|${v.lang}|${qualityOf(v)}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

/** every voice in a language (English by default) with the details behind
 *  it, for the diagnostics screen */
export function voiceReport(lang = 'en'): { name: string; lang: string; uri: string; local: boolean; quality: Quality }[] {
  const synth = engine();
  if (!synth) return [];
  const base = lang.split('-')[0].toLowerCase();
  try {
    return synth.getVoices()
      .filter((v) => v.lang.replace('_', '-').toLowerCase().split('-')[0] === base)
      .map((v) => ({
        name: v.name, lang: v.lang, uri: v.voiceURI,
        local: v.localService, quality: qualityOf(v),
      }));
  } catch {
    return [];
  }
}

function score(v: SpeechSynthesisVoice): number {
  const accent = ACCENT_RANK.find(([re]) => re.test(v.lang))?.[1] ?? 9;
  /* accent dominates, then how good the voice is, then whether it needs the
     network — the app has to keep working in the car with no signal */
  return accent * 100 + QUALITY_RANK[qualityOf(v)] * 10 + (v.localService ? 0 : 1);
}

function chooseVoice(): SpeechSynthesisVoice | null {
  const voices = englishVoices();
  if (!voices.length) return null;
  if (preferredURI) {
    const picked = voices.find((v) => v.voiceURI === preferredURI);
    if (picked) return picked;
  }
  return voices[0];
}

/** the parent's pick, or null to go back to choosing automatically */
export function setPreferredVoice(uri: string | null): void {
  preferredURI = uri;
  cached = null;
}

/**
 * True when nothing better than a compact voice is installed — the state of a
 * device where nobody has downloaded one.
 *
 * This asks whether any voice is enhanced or premium rather than whether every
 * voice is compact: a single Eloquence voice in the list, which iOS ships by
 * default, would otherwise silence the hint on exactly the devices that need
 * it most.
 */
export function onlyCompactVoices(): boolean {
  const voices = englishVoices();
  if (!voices.length) return false;
  return !voices.some((v) => {
    const q = qualityOf(v);
    return q === 'enhanced' || q === 'premium';
  });
}

export function setSpeechEnabled(on: boolean): void {
  enabled = on;
  if (!on) cancelSpeech();
}

/**
 * iOS stays silent until speech has been started inside a real gesture, so
 * the first tap in the app starts an empty utterance to open the gate.
 *
 * The list of voices can also arrive late, and `voiceschanged` does not fire
 * everywhere, so we re-read it a few times afterwards and tell anyone
 * listening if it changed. That is a cheap hedge against slow loading, not a
 * way to summon a downloaded voice: an iPad with Karen Enhanced installed
 * still never offered her to the page, unlock or no unlock.
 *
 * An engine that is already saying something is already open, so nothing
 * is started then. Queuing the empty utterance behind a word in progress
 * froze the whole page in WebKit's Linux build: the next word's speak()
 * never returned. Safari on the iPad has not been seen to, but there is no
 * gate left to open, so there is nothing to lose by not asking.
 */
export function unlockSpeech(): void {
  if (unlocked) return;
  const synth = engine();
  if (!synth) return;
  try {
    if (!synth.speaking && !synth.pending) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      synth.speak(u);
    }
    unlocked = true;
    for (const delay of [0, 250, 750, 2000]) window.setTimeout(rescanVoices, delay);
  } catch {
    /* stays locked; the next tap tries again */
  }
}

/** a cheap fingerprint of the voice list, to spot it growing */
function signature(): string {
  const synth = engine();
  if (!synth) return '';
  try {
    return synth.getVoices().map((v) => v.voiceURI).join('|');
  } catch {
    return '';
  }
}

/** re-reads the voice list and notifies listeners only if it actually changed */
export function rescanVoices(): void {
  const next = signature();
  if (next === lastSignature) return;
  lastSignature = next;
  cached = null;
  for (const fn of voiceListeners) {
    try { fn(); } catch { /* a listener must not break speech */ }
  }
}

/** called whenever the set of installed voices changes, including after the
 *  first tap on iOS reveals the downloaded ones */
export function onVoicesChanged(fn: () => void): () => void {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}

/** silence: the device voice and any recording. Called when a game is left.
 *  Whatever was being said is dropped, not finished: its onEnd never runs */
export function cancelSpeech(): void {
  speaking = null;
  stopClips();
  try {
    engine()?.cancel();
  } catch {
    /* ignore */
  }
}

export interface SayOptions {
  /** slower, for "sound it out for me" */
  slow?: boolean;
  /**
   * Never use a recording, even where one exists.
   *
   * For anything spoken BEFORE the child has answered. Real words have clips
   * and made-up ones never will, so the two sound audibly different — and in
   * Real or Silly, "sound it out for me" speaks the word while he is still
   * deciding. He could tell real from made-up by which voice came out,
   * without reading a thing.
   *
   * After he has answered there is nothing left to give away, so the clip is
   * used there and he gets the clear voice as the reward.
   */
  deviceVoiceOnly?: boolean;
  /** speak through this exact voice instead of the chosen one, for #/voices,
   *  where every row has to be audibly itself rather than the app's pick */
  voiceURI?: string;
  /**
   * Another language, for the football narration ("Goooool do Brasil!"),
   * which is shouted in Portuguese the way it is at home. A recording of the
   * line where one was made, and otherwise the best installed voice for the
   * language, never the English voice, which would mangle it: check
   * hasClip() or canSpeak() first.
   */
  lang?: string;
  /**
   * Called once when it has been said, or at once if it cannot be said at all.
   *
   * Not called when it is stopped — by leaving the game, by turning speech
   * off, or by something else being said over it — so a game never carries
   * on from speech it did not hear the end of. Some engines never report an
   * end even for speech that finished, so anything that has to happen next
   * keeps a timer of its own as well (see narrate in src/games/narration.ts).
   */
  onEnd?: () => void;
}

function voiceByURI(uri: string): SpeechSynthesisVoice | null {
  const synth = engine();
  if (!synth) return null;
  try {
    return synth.getVoices().find((v) => v.voiceURI === uri) ?? null;
  } catch {
    return null;
  }
}

/** installed voices for a language, best first: the exact region (pt-BR)
 *  before its cousins (pt-PT), then by quality */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  const synth = engine();
  if (!synth) return [];
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  const want = norm(lang);
  const base = want.split('-')[0];
  try {
    return synth.getVoices()
      .filter((v) => norm(v.lang).split('-')[0] === base)
      .sort((a, b) => Number(norm(b.lang) === want) - Number(norm(a.lang) === want)
        || QUALITY_RANK[qualityOf(a)] - QUALITY_RANK[qualityOf(b)]);
  } catch {
    return [];
  }
}

/** can this device say something in that language at all? */
export const canSpeak = (lang: string): boolean => voicesFor(lang).length > 0;

export function say(text: string, options: SayOptions = {}): void {
  if (!enabled || !text) { options.onEnd?.(); return; }
  /* a recording where we shipped one (in either language), the device voice
     everywhere else. The diagnostics screen asks for a named voice, so it
     always gets the real thing rather than a clip that would sound the same
     in every row. */
  if (!options.deviceVoiceOnly && !options.voiceURI && hasClip(text)) {
    cancelSpeech();
    void playClip(text, { slow: options.slow, onEnd: options.onEnd })
      .then((played) => { if (!played) speakAloud(text, options); });
    return;
  }
  speakAloud(text, options);
}

function speakAloud(text: string, options: SayOptions): void {
  /* a recording still playing would talk over the device voice */
  stopClips();
  const synth = engine();
  if (!synth) { options.onEnd?.(); return; }
  /* a line in another language, with no voice for it, would come out of the
     English voice mangled. That only happens when its recording would not
     play, and saying nothing is better */
  if (options.lang && !options.voiceURI && !canSpeak(options.lang)) { options.onEnd?.(); return; }
  try {
    /* drop the one being said before the engine reports it stopped */
    speaking = null;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    let voice: SpeechSynthesisVoice | null;
    if (options.voiceURI) {
      voice = voiceByURI(options.voiceURI);
    } else if (options.lang) {
      voice = voicesFor(options.lang)[0] ?? null;
    } else {
      cached ??= chooseVoice();
      voice = cached;
    }
    /* Setting .voice can throw on its own in some engines. Losing the voice is
       survivable — losing the whole utterance is not — so it gets its own try,
       and lang still carries the accent we want. */
    try {
      if (voice) u.voice = voice;
    } catch {
      /* fall back to lang alone */
    }
    u.lang = voice?.lang ?? options.lang ?? 'en-AU';
    /* a touch slower than normal for a beginner reader, and much slower for
       "sound it out for me". Pitch stays at 1: above it Apple's voices sound
       synthetic */
    u.rate = options.slow ? 0.45 : 0.9;
    u.pitch = 1;
    /* an error that is not a stop (no voice, the engine failing) still ends
       it, so a game waiting on it does not wait for ever */
    const finished = (): void => {
      if (speaking !== u) return;
      speaking = null;
      options.onEnd?.();
    };
    u.onend = finished;
    u.onerror = finished;
    speaking = u;
    synth.speak(u);
  } catch {
    speaking = null;
    options.onEnd?.();
  }
}

/** voices load asynchronously in most browsers, so re-pick when they arrive */
export function watchVoices(): void {
  const synth = engine();
  if (!synth) return;
  try {
    lastSignature = signature();
    cached = chooseVoice();
    synth.addEventListener('voiceschanged', rescanVoices);
  } catch {
    /* ignore */
  }
}

/** for the tests and the parent panel: which voice ended up being used */
export function currentVoice(): SpeechSynthesisVoice | null {
  cached ??= chooseVoice();
  return cached;
}

/* Every voice says what it is. Calling the ordinary one "basic" read as a
   warning and made the retro voices look like the better choice. */
const QUALITY_LABEL: Record<Quality, string> = {
  premium: ' — premium, clearest',
  enhanced: ' — enhanced, clearer',
  compact: ' — standard',
  'super-compact': ' — standard, lower detail',
  unknown: '',
  retro: ' — retro, robotic',
  novelty: ' — novelty, just for fun',
};

export const describeVoice = (v: SpeechSynthesisVoice): string =>
  `${v.name} (${v.lang})${QUALITY_LABEL[qualityOf(v)]}`;
