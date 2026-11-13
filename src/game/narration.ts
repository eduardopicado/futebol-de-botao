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
  EN_CLOSE, EN_DANGER, EN_KEEPER_BALL, EN_KICKOFF, EN_HALF_TIME, EN_EXTRA_TIME, EN_TO_PENALTIES, EN_FOULS, EN_PENALTIES, EN_NO_GOAL, EN_CHIPS, EN_OVER, EN_OWN_GOALS, EN_POSTS, EN_SAVES, EN_SHOTS, PT_CALL, PT_CHAMPIONS, PT_GOAL_CRIES, PT_GOLACO_CRIES, PT_CLOSE, PT_DANGER, PT_KEEPER_BALL, PT_KICKOFF, PT_HALF_TIME, PT_EXTRA_TIME, PT_TO_PENALTIES, PT_FOULS, PT_PENALTIES, PT_NO_GOAL, PT_CHIPS, PT_OVER, PT_OWN_GOALS,
  PT_POSTS, PT_SAVES, PT_SHOTS, enChampion, enGolaco, enGoal, ptGoals, ptGolacos,
} from '../content/commentary';
import { real, type Team } from './teams';

export type Narration = 'pt' | 'en' | 'off';
export type Moment = 'goal' | 'golaco' | 'save' | 'champion' | 'post' | 'close' | 'over' | 'keeper-ball' | 'own-goal' | 'kickoff' | 'half-time' | 'extra-time' | 'to-penalties' | 'foul' | 'penalty' | 'no-goal' | 'chip' | 'shot' | 'danger';

const KEY = 'football-narration';
const PT = 'pt-BR';

export const narrationChoice = (): Narration => {
  const v = read<string>(KEY, 'pt');
  return v === 'en' || v === 'off' ? v : 'pt';
};
export const setNarration = (v: Narration): void => write(KEY, v);

/** how often a goal gets one of the old radio cries */
const CRY = 0.3;

/** the same moment, whoever it was for */
const SAME: Record<Exclude<Moment, 'goal' | 'golaco' | 'champion'>, { pt: string[]; en: string[] }> = {
  save: { pt: PT_SAVES, en: EN_SAVES },
  post: { pt: PT_POSTS, en: EN_POSTS },
  close: { pt: PT_CLOSE, en: EN_CLOSE },
  over: { pt: PT_OVER, en: EN_OVER },
  'keeper-ball': { pt: PT_KEEPER_BALL, en: EN_KEEPER_BALL },
  'kickoff': { pt: PT_KICKOFF, en: EN_KICKOFF },
  'half-time': { pt: PT_HALF_TIME, en: EN_HALF_TIME },
  'extra-time': { pt: PT_EXTRA_TIME, en: EN_EXTRA_TIME },
  'to-penalties': { pt: PT_TO_PENALTIES, en: EN_TO_PENALTIES },
  'foul': { pt: PT_FOULS, en: EN_FOULS },
  'penalty': { pt: PT_PENALTIES, en: EN_PENALTIES },
  'no-goal': { pt: PT_NO_GOAL, en: EN_NO_GOAL },
  'chip': { pt: PT_CHIPS, en: EN_CHIPS },
  'own-goal': { pt: PT_OWN_GOALS, en: EN_OWN_GOALS },
  shot: { pt: PT_SHOTS, en: EN_SHOTS },
  danger: { pt: PT_DANGER, en: EN_DANGER },
};

/** what the commentator shouts: a goal or the cup for `team`, or a moment
    that is the same whoever it was for */
export function callFor(moment: Moment, team: Team, lang: 'pt' | 'en'): string {
  if (moment !== 'goal' && moment !== 'golaco' && moment !== 'champion') return pick(SAME[moment][lang]);
  if (lang === 'pt') {
    if (moment === 'champion') return pick(PT_CHAMPIONS);
    /* now and then, one of the old radio cries instead of the team's own */
    const cry = Math.random() < CRY;
    if (moment === 'golaco') return cry ? pick(PT_GOLACO_CRIES) : pick(ptGolacos(team.pt));
    return cry ? pick(PT_GOAL_CRIES) : pick(ptGoals(team.pt));
  }
  const name = real(team) ? team.name : undefined;
  if (moment === 'champion') return enChampion(name);
  return moment === 'golaco' ? enGolaco(name) : enGoal(name);
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
  const name = (moment === 'goal' || moment === 'golaco') && scorer ? `${scorer}!` : '';
  const sayName = (): void => say(name, { lang: lang && canSpeak(lang) ? lang : undefined, onEnd: next });
  say(call, { lang, onEnd: name ? sayName : next });
  later(next, (hasClip(call) ? RECORDED : SPOKEN) + (name ? NAME : 0));
}

/** "Pro gol!": a shot called, by a player or the computer, shouted in the
    Portuguese voice whichever commentator is chosen (it is the call's own
    name), and not at all with no commentator. The recording, or the
    device's Portuguese voice; with neither, nothing */
export function shoutCall(): void {
  if (narrationChoice() === 'off') return;
  say(PT_CALL, { lang: PT });
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
