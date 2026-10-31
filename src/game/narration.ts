/* The commentator in the football games, the way it sounds at home.
 *
 * A goal is "Goooool do Brasil!" and a save is "Defendeu o goleiro!", shouted
 * in Portuguese by a Portuguese voice: the sound of football in Brazil; a
 * shot off the post is "Na trave!", one just wide "Quase!", and an own goal
 * "Gol contra!". It comes after the kick, as the celebration.
 *
 * With no Portuguese voice on the device and no recording of the line, the
 * English voice cannot say it, so it calls the moment in English instead.
 * English, or no commentator, can be chosen in the settings. The lines
 * themselves are in src/content/commentary.ts. */

import { pick } from '../lib/random';
import { canSpeak, say } from '../lib/speech';
import { hasClip } from '../lib/audio';
import { read, write } from '../lib/storage';
import {
  EN_CLOSE, EN_OWN_GOALS, EN_POSTS, EN_SAVES, PT_CHAMPIONS, PT_CLOSE, PT_OWN_GOALS, PT_POSTS, PT_SAVES, enChampion, enGoal, ptGoals,
} from '../content/commentary';
import { real, type Team } from './teams';

export type Narration = 'pt' | 'en' | 'off';
export type Moment = 'goal' | 'save' | 'champion' | 'post' | 'close' | 'own-goal';

const KEY = 'football-narration';
const PT = 'pt-BR';

export const narrationChoice = (): Narration => {
  const v = read<string>(KEY, 'pt');
  return v === 'en' || v === 'off' ? v : 'pt';
};
export const setNarration = (v: Narration): void => write(KEY, v);

/** the same moment, whoever it was for */
const SAME: Record<'save' | 'post' | 'close' | 'own-goal', { pt: string[]; en: string[] }> = {
  save: { pt: PT_SAVES, en: EN_SAVES },
  post: { pt: PT_POSTS, en: EN_POSTS },
  close: { pt: PT_CLOSE, en: EN_CLOSE },
  'own-goal': { pt: PT_OWN_GOALS, en: EN_OWN_GOALS },
};

/** what the commentator shouts: a goal or the cup for `team`, or a moment
    that is the same whoever it was for */
export function callFor(moment: Moment, team: Team, lang: 'pt' | 'en'): string {
  if (moment !== 'goal' && moment !== 'champion') return pick(SAME[moment][lang]);
  if (lang === 'pt') return pick(moment === 'champion' ? PT_CHAMPIONS : ptGoals(team.pt));
  if (moment === 'champion') return enChampion(real(team) ? team.name : undefined);
  return enGoal(real(team) ? team.name : undefined);
}

/**
 * Shout the moment, then whatever comes next; a goal with the scorer's name
 * after it, when there is one: "Goooool do Brasil! Vinícius Júnior!". `then` runs once the call is
 * over — or after a short wait, since some speech engines never say they
 * have finished — so the word is never lost.
 */
export function narrate(moment: Moment, team: Team, then: () => void, later: (fn: () => void, ms: number) => void, scorer = ''): void {
  const choice = narrationChoice();
  if (choice === 'off') { then(); return; }
  let done = false;
  const next = (): void => { if (!done) { done = true; then(); } };
  /* in Portuguese when there is a recording of the line or a voice to say it,
     and in English otherwise */
  const pt = choice === 'pt' ? callFor(moment, team, 'pt') : '';
  const [call, lang] = pt && (hasClip(pt) || canSpeak(PT)) ? [pt, PT] : [callFor(moment, team, 'en'), undefined];
  /* the name on its own, after the call: the call is recorded (public/audio),
     a name the players can change never is. In Portuguese where the device
     can say it, and otherwise in the voice it has, as a name still sounds */
  const name = moment === 'goal' && scorer ? `${scorer}!` : '';
  const sayName = (): void => say(name, { lang: lang && canSpeak(lang) ? lang : undefined, onEnd: next });
  say(call, { lang, onEnd: name ? sayName : next });
  later(next, (hasClip(call) ? RECORDED : SPOKEN) + (name ? NAME : 0));
}

/* how long to give the call before going on regardless, in milliseconds: a
   recording reports its end, and this only covers one that fails without
   saying so, so it is longer than the longest of them ("Goooool do
   Manchester United!", 3.3 s); the device voice, which may never report it,
   gets less; and a name after the call, a little more */
const RECORDED = 4000;
const SPOKEN = 2400;
const NAME = 1500;

/** the setup row: who does the commentary */
export function narrationSelect(onChange?: () => void): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Commentator');
  for (const [value, text] of [['pt', 'Commentator: Português'], ['en', 'Commentator: English'], ['off', 'No commentator']]) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    sel.append(o);
  }
  sel.value = narrationChoice();
  sel.addEventListener('change', () => { setNarration(sel.value as Narration); onChange?.(); });
  return sel;
}
