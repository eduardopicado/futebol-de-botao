/* The Copa: a cup for one player against the computer.
 *
 * Pick a team, and three opponents are drawn: a quarter-final on easy, a
 * semi-final on medium, the final on hard (at night, under floodlights).
 * Win to go through; lose and the cup is over. A cup in progress is kept on
 * this device, so it can be finished another day, and so is the number of
 * cups won. Each tie is a match (partida.ts) to the rule and buttons the
 * settings chose, against the clock (CUP_CLOCK) rather than to a number of
 * goals: level at full time, extra time; still level, penalties
 * (penaltis.ts). A match left before full time does not count, and is
 * played again. Winning the cup is celebrated once, when the final is won. */

import { read, write } from '../lib/storage';
import type { Level } from '../content/computer';
import { TEAMS, clash, real, teamById, type Team } from './teams';

export const ROUNDS: readonly { name: string; level: Level }[] = [
  { name: 'Quarter-final', level: 'easy' },
  { name: 'Semi-final', level: 'medium' },
  { name: 'Final', level: 'hard' },
];

/** a tie's score, and the shootout's when it went to penalties */
export interface Result { us: number; them: number; pens?: { us: number; them: number } }

/** a Copa tie: halves of 8 turns a side; extra time, 3 a side each half */
export const CUP_CLOCK = { turns: 8, extra: 3 } as const;

/** did we win this tie: ahead, or level and ahead on penalties */
export const won = (r: Result): boolean => r.us > r.them || (r.us === r.them && !!r.pens && r.pens.us > r.pens.them);
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

/* the cup as last written: a device that will not keep it (storage full or
   turned off) still plays a cup through, for as long as the app is open */
let held: Cup | null = null;
/* the final was won just now: the Copa's page celebrates it once, not on every visit */
let fresh = false;

const isScore = (r: unknown): r is { us: number; them: number } =>
  !!r && typeof r === 'object' && Number.isInteger((r as Result).us) && Number.isInteger((r as Result).them);
const isResult = (r: unknown): r is Result => isScore(r) && ((r as Result).pens === undefined || isScore((r as Result).pens));

const copyResult = (r: Result): Result => ({ us: r.us, them: r.them, ...(r.pens ? { pens: { us: r.pens.us, them: r.pens.them } } : {}) });
const copy = (c: Cup): Cup => ({ team: c.team, opponents: [...c.opponents], results: c.results.map(copyResult) });

const keep = (c: Cup): void => {
  held = copy(c);
  write(KEY, c);
};

/** the cup in progress (or just finished) on this device, if what was saved is one */
export function cupNow(): Cup | null {
  const c = read<Cup | null>(KEY, null);
  const valid = !!c && typeof c === 'object' && !!teamById(c.team)
    && Array.isArray(c.opponents) && c.opponents.length === ROUNDS.length && c.opponents.every((o) => teamById(o))
    && Array.isArray(c.results) && c.results.length <= ROUNDS.length && c.results.every(isResult);
  return valid ? copy(c) : held && copy(held);
}

/** still in it, won the final, or knocked out */
export function stageOf(c: Cup): Stage {
  if (c.results.some((r) => !won(r))) return 'out';
  return c.results.length === ROUNDS.length ? 'won' : 'playing';
}

/** the round to play next (or the last one played, once it is over) */
export const roundOf = (c: Cup): number => Math.min(c.results.length, ROUNDS.length - 1);

/** the tie to play now: the cup, its round, and the two teams; none once the cup is over */
export interface Tie { cup: Cup; name: string; level: Level; us: Team; them: Team }
export function tieNow(): Tie | null {
  const c = cupNow();
  if (!c || stageOf(c) !== 'playing') return null;
  const round = ROUNDS[roundOf(c)];
  return { cup: c, name: round.name, level: round.level, us: teamById(c.team)!, them: teamById(c.opponents[roundOf(c)])! };
}

/** a new cup for this team: three different real teams drawn against it, none whose buttons look like its */
export function newCup(team: Team, rand: () => number = Math.random): Cup {
  const pool = TEAMS.filter((t) => real(t) && t.id !== team.id && !clash(t, team));
  const drawn: string[] = [];
  while (drawn.length < ROUNDS.length && pool.length > 0) {
    const [t] = pool.splice(Math.floor(rand() * pool.length), 1);
    drawn.push(t.id);
  }
  const cup: Cup = { team: team.id, opponents: drawn, results: [] };
  keep(cup);
  return cup;
}

const same = (c: Cup, d: Cup): boolean =>
  c.team === d.team && c.opponents.join() === d.opponents.join() && c.results.length === d.results.length;

/** the tie just played for this cup, at full time: the cup goes on, is won, or
    is over. A different cup started since (in another window) is left as it is */
export function recordResult(played: Cup, result: Result): Cup {
  const c = copy(played);
  if (stageOf(c) !== 'playing') return c;
  c.results.push(copyResult(result));
  const now = cupNow();
  if (now && !same(now, played)) return c;
  keep(c);
  if (stageOf(c) === 'won') {
    write(WON, cupsWon() + 1);
    fresh = true;
  }
  return c;
}

const PENS = 'cup-penalties';

/** a tie level after extra time, waiting for its penalties (penaltis.ts):
    the cup's team and round, and the score */
export function levelAfterExtraTime(c: Cup, score: { us: number; them: number }): void {
  write(PENS, { team: c.team, round: c.results.length, us: score.us, them: score.them });
}

/** the score of this cup's tie that is waiting for its penalties, if one is */
export function waitingForPenalties(): { us: number; them: number } | null {
  const p = read<{ team?: unknown; round?: unknown; us?: unknown; them?: unknown } | null>(PENS, null);
  const c = cupNow();
  if (!p || typeof p !== 'object' || !c || stageOf(c) !== 'playing') return null;
  if (p.team !== c.team || p.round !== c.results.length || !isScore(p) || p.us !== p.them) return null;
  return { us: p.us, them: p.them };
}

/** no tie is waiting for penalties: a tie's match has started again, or its shootout is over */
export const noPenaltiesWaiting = (): void => write(PENS, null);

/** what full time shouts, for how the cup stands after the tie */
export function cupShout(c: Cup): string {
  const stage = stageOf(c);
  if (stage === 'won') return 'É campeão!';
  if (stage === 'out') return 'Out of the Copa';
  return `Through to the ${ROUNDS[roundOf(c)].name.toLowerCase()}!`;
}

/** was the cup won just now? Asking says so once */
export function justWon(): boolean {
  const was = fresh;
  fresh = false;
  return was;
}

/** how many cups have been won on this device */
export const cupsWon = (): number => {
  const n = read<number>(WON, 0);
  return Number.isInteger(n) && n > 0 ? n : 0;
};
