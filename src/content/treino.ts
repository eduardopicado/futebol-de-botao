/* Treino: practice in front of the other side's goal.
 *
 * Until the match is settled (docs/HANDOVER.md, "Questions for the new
 * game"), this is the whole game: his three buttons, the ball, three of
 * theirs standing still in the way, and their goleiro, who gets in line with
 * the ball after every touch. Three touches to score, the regra carioca's.
 *
 * Every set-up comes with a way to score from it (the planner in botao.ts),
 * so none is impossible, and the tests can play it. */

import { BALL, L, R, W, keeperFor, oneTouch, passPlan, type Plan, type Table } from './botao';

export interface Drill { table: Table; plan: Plan }

type Rand = () => number;

/** room for everything: no two discs touching, all well on the table */
export function fits(t: Table): boolean {
  const all = [{ ...t.ball, r: BALL }, ...t.us.map((p) => ({ ...p, r: R })), ...t.them.map((p) => ({ ...p, r: R }))];
  for (const [i, a] of all.entries()) {
    if (a.x < a.r + 1 || a.x > W - a.r - 1 || a.y < a.r + 6 || a.y > L - a.r - 1) return false;
    for (const b of all.slice(i + 1)) if (Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) < a.r + b.r + 2) return false;
  }
  return true;
}

/** a set-up, and a way to score from it */
export function drill(rand: Rand = Math.random): Drill {
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rand();
  for (let tries = 0; tries < 200; tries += 1) {
    const ball = { x: between(14, 50), y: between(30, 54) };
    const t: Table = {
      ball,
      us: [
        /* one right behind the ball, and two further back, one each side */
        { x: ball.x + between(-6, 6), y: ball.y + between(11, 15) },
        { x: between(8, 26), y: between(56, 80) },
        { x: between(38, 56), y: between(56, 80) },
      ],
      them: [
        { x: between(12, 28), y: between(14, 26) },
        { x: between(36, 52), y: between(14, 26) },
        { x: between(22, 42), y: between(26, 38) },
      ],
      keeper: keeperFor('middle', ball),
    };
    if (!fits(t)) continue;
    const plan = oneTouch(t, [0, 1, 2], true) ?? passPlan(t, 0, 1, 'middle') ?? passPlan(t, 0, 2, 'middle');
    if (plan) return { table: t, plan };
  }
  /* never seen, but never stuck: the ball in front of goal, nobody in the way */
  const ball = { x: W / 2, y: 34 };
  const table: Table = { ball, us: [{ x: W / 2, y: 46 }, { x: 16, y: 70 }, { x: 48, y: 70 }], them: [], keeper: null };
  return { table, plan: oneTouch(table, [0], false)! };
}
