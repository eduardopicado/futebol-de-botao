/* What has been chosen in the settings (src/game/settings.ts), read where a
   game needs it. Each falls back to its default for anything saved that it
   does not know. */

import { say } from '../lib/speech';
import { read } from '../lib/storage';
import { LEVELS, type Level } from '../content/computer';
import { GOALS, SIZES } from '../content/match';

/** how many goals win a match */
export const goalsToWin = (): number => {
  const n = read<number>('goals', GOALS[0]);
  return (GOALS as readonly number[]).includes(n) ? n : GOALS[0];
};

/** buttons a side, besides the goleiro */
export const buttonsPerSide = (): number => {
  const n = read<number>('buttons', SIZES[0]);
  return (SIZES as readonly number[]).includes(n) ? n : SIZES[0];
};

/** how well the computer plays */
export const computerLevel = (): Level => {
  const l = read<string>('level', 'medium');
  return (LEVELS as readonly string[]).includes(l) ? (l as Level) : 'medium';
};

/** are the words above the table read aloud? */
export const readAloud = (): boolean => read<boolean>('read-aloud', true);

/** the words, said aloud, if that is chosen */
export const speak = (words: string): void => { if (readAloud()) say(words); };

/** are the sound effects on? */
export const soundsOn = (): boolean => read<boolean>('sounds', true);
