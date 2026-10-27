/* The Copa: a cup for one player against the computer.
 *
 * Pick a team, and three opponents are drawn: a quarter-final on easy, a
 * semi-final on medium, the final on hard. Win to go through; lose and the
 * cup is over. A cup in progress is kept on this device, so it can be
 * finished another day, and so is the number of cups won. Each tie is an
 * ordinary match (partida.ts), to the goals, rule and buttons the settings
 * chose; a match left before full time does not count, and is played again. */

import { read, write } from '../lib/storage';
import type { Level } from '../content/computer';
import { TEAMS, clash, real, teamById, type Team } from './teams';

export const ROUNDS: readonly { name: string; level: Level }[] = [
  { name: 'Quarter-final', level: 'easy' },
  { name: 'Semi-final', level: 'medium' },
  { name: 'Final', level: 'hard' },
];

export interface Result { us: number; them: number }
export interface Cup {
  /** your team, and the three drawn against it, round by round (team ids) */
  team: string;
  opponents: string[];
  /** each tie played so far */
  results: Result[];
}
export type Stage = 'playing' | 'won' | 'out';

const KEY = 'cup';
const WON = 'cups-won';

const isResult = (r: unknown): r is Result =>
  !!r && typeof r === 'object' && Number.isInteger((r as Result).us) && Number.isInteger((r as Result).them);

/** the cup in progress (or just finished) on this device, if what was saved is one */
export function cupNow(): Cup | null {
  const c = read<Cup | null>(KEY, null);
  if (!c || typeof c !== 'object' || !teamById(c.team)) return null;
  if (!Array.isArray(c.opponents) || c.opponents.length !== ROUNDS.length || !c.opponents.every((o) => teamById(o))) return null;
  if (!Array.isArray(c.results) || c.results.length > ROUNDS.length || !c.results.every(isResult)) return null;
  return { team: c.team, opponents: [...c.opponents], results: c.results.map((r) => ({ us: r.us, them: r.them })) };
}

/** still in it, won the final, or knocked out */
export function stageOf(c: Cup): Stage {
  if (c.results.some((r) => r.us <= r.them)) return 'out';
  return c.results.length === ROUNDS.length ? 'won' : 'playing';
}

/** the round to play next (or the last one played, once it is over) */
export const roundOf = (c: Cup): number => Math.min(c.results.length, ROUNDS.length - 1);

/** a new cup for this team: three different real teams drawn against it, none whose buttons look like its */
export function newCup(team: Team, rand: () => number = Math.random): Cup {
  const pool = TEAMS.filter((t) => real(t) && t.id !== team.id && !clash(t, team));
  const drawn: string[] = [];
  while (drawn.length < ROUNDS.length && pool.length > 0) {
    const [t] = pool.splice(Math.floor(rand() * pool.length), 1);
    drawn.push(t.id);
  }
  const cup = { team: team.id, opponents: drawn, results: [] };
  write(KEY, cup);
  return cup;
}

/** the tie just played, at full time: the cup goes on, is won, or is over */
export function recordResult(result: Result): Cup | null {
  const c = cupNow();
  if (!c || stageOf(c) !== 'playing') return c;
  c.results.push({ us: result.us, them: result.them });
  write(KEY, c);
  if (stageOf(c) === 'won') write(WON, cupsWon() + 1);
  return c;
}

/** how many cups have been won on this device */
export const cupsWon = (): number => {
  const n = read<number>(WON, 0);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** the cup forgotten, to start another */
export const clearCup = (): void => write(KEY, null);
