/* Pênaltis — a penalty shootout: two players on one iPad, or one against
 * the computer.
 *
 * A coin toss picks who kicks first. Then five kicks each, in turn: the
 * ball on the spot in front of the other side's goal, the defender slides
 * their goleiro along the line and taps Pronto, and the taker has one flick.
 * Decided as soon as one side cannot be caught; level after five each, a
 * kick each until one scores and the other does not. Side a kicks at the
 * goal at the top, side b at the bottom, as in a match. The note turns to
 * face whoever has to act, as in a match. The rules are in
 * src/content/match.ts; the table on the screen is board.ts. */

import { el } from '../lib/dom';
import { lifetime } from '../lib/life';
import { pick } from '../lib/random';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { read, write } from '../lib/storage';
import { COMPUTER, decide, guessKeeper } from '../content/computer';
import {
  ON_THE_LINE, SHOOTOUT_KICKS, clampKeeper, flick, kicked, mayFlick, missed, moment, newShootout, onTheLine, other, penaltyFor, pronto, scoredFrom,
  shootoutGoals, shootoutTaken, type Match, type Shootout, type Side,
} from '../content/match';
import { type Keepers, makeBoard, SHAPE } from './board';
import { computerLevel, speak } from './choices';
import { confetti } from './confetti';
import { narrate } from './narration';
import { celebrate } from './moment';
import { PACE } from './pace';
import { cupShout, noPenaltiesWaiting, recordResult, tieNow, waitingForPenalties } from './cup';
import { takerOf } from './squads';
import { kit, label, ourTeam, rivalFor, type Team } from './teams';

/** two players on one iPad */
export const mount = (root: HTMLElement): (() => void) => shootout(root, false);
/** one player, against the computer */
export const mountComputer = (root: HTMLElement): (() => void) => shootout(root, true);
/** the penalties of a Copa tie still level after extra time (cup.ts):
    against the round's opponent, as hard as the round, the result kept */
export const mountCup = (root: HTMLElement): (() => void) => shootout(root, true, true);

function shootout(root: HTMLElement, computer: boolean, forCup = false): () => void {
  const life = lifetime();
  /* in the Copa, the tie waiting for its penalties; with none, back to the Copa's page */
  const tie = forCup ? tieNow() : null;
  const level0 = forCup ? waitingForPenalties() : null;
  if (forCup && (!tie || !level0)) {
    go('copa');
    return () => life.end();
  }
  const cpu: Side | null = computer ? COMPUTER : null;
  const level = tie ? tie.level : computerLevel();
  const wait = (ms: number): Promise<void> => new Promise((done) => { life.later(done, ms); });
  const a = tie ? tie.us : ourTeam();
  const teams: Record<Side, Team> = { a, b: tie ? tie.them : rivalFor(a) };
  const name = (s: Side): string => label(teams[s], true);
  /* the final's penalties, still under the floodlights */
  document.body.classList.toggle('night', tie?.name === 'Final');

  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': tie ? 'Back to the Copa' : 'Back to the start', text: '←' });
  back.addEventListener('click', () => go(tie ? 'copa' : 'home'));
  const scoreEl = el('p', { class: 'score match-score', 'aria-live': 'polite' });
  const words = el('span', { class: 'say-words' });
  const actions = el('span', { class: 'say-actions' });
  const sayEl = el('div', { class: 'bt-say', 'aria-live': 'polite' }, words, actions);
  const rows = { a: el('span', { class: 'pen-row', role: 'img' }), b: el('span', { class: 'pen-row', role: 'img' }) };
  const board = makeBoard(life, `The table: a penalty shootout, ${teams.a.name} kicking at the top goal and ${teams.b.name}${cpu ? ', the computer,' : ''} at the bottom one`);
  const stage = el('div', { class: 'bt-stage' }, board.node);
  const overlay = el('div', { class: 'bt-overlay', hidden: '' });
  stage.append(overlay);
  const node = el('div', { class: 'game', vars: SHAPE },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, tie ? `${tie.name}: pênaltis` : 'Pênaltis'), el('p', { class: 'pen-kicks' }, rows.a, rows.b)), scoreEl),
    sayEl, stage);
  root.append(node);
  const prontoBtn = el('button', { class: 'btn small pronto', type: 'button', text: '✋ Pronto' });
  /* a chip for the kick (Cobertura): armed here, its lift held for on the table (board.ts) */
  let chipArmed = false;
  const chipBtn = el('button', { class: 'btn small chip', type: 'button', 'aria-pressed': 'false', 'aria-label': '🌈 Cobertura' }, el('span', { text: '🌈' }), el('span', { class: 'chip-label', text: ' Cobertura' }));

  let s: Shootout = newShootout('a');
  let m: Match = penaltyFor('a');
  /* a kick, a pause or the toss is under way: no finger does anything */
  let busy = true;
  let sliding = 0;

  const keepersOf = (x: Match): Keepers => ({ top: x.keepers.b, bottom: x.keepers.a });
  const defender = (): Side => other(m.turn);
  const keeperLine = (side: Side): 'top' | 'bottom' => (side === 'a' ? 'bottom' : 'top');
  const draw = (): void => board.draw({ ball: m.ball, a: m.a, b: m.b }, keepersOf(m));

  /** each side's taker for its next kick, on the table: the forward first, then back through the team */
  const setUpKick = (): void => board.setUp(teams.a, teams.b, { a: 1, b: 1 },
    { a: [takerOf(teams.a, shootoutTaken(s, 'a'))], b: [takerOf(teams.b, shootoutTaken(s, 'b'))] });

  /** the score, and each side's kicks: scored, missed, or still to take of the five */
  function showKicks(): void {
    const [ga, gb] = [shootoutGoals(s, 'a'), shootoutGoals(s, 'b')];
    scoreEl.replaceChildren(`${teams.a.flag ?? ''} ${ga} – ${gb} ${teams.b.flag ?? ''}`.trim());
    scoreEl.setAttribute('aria-label', `${teams.a.name} ${ga}, ${teams.b.name} ${gb}`);
    node.dataset.score = `${ga}-${gb}`;
    for (const side of ['a', 'b'] as const) {
      const mine = s.kicks.filter((k) => k.side === side);
      const left = Math.max(0, SHOOTOUT_KICKS - mine.length);
      rows[side].replaceChildren(
        kit(teams[side], 20),
        ...mine.map((k) => el('span', { class: `pen-mark ${k.scored ? 'goal' : 'miss'}`, text: k.scored ? '' : '✕' })),
        ...Array.from({ length: left }, () => el('span', { class: 'pen-mark' })));
      const scored = shootoutGoals(s, side);
      rows[side].setAttribute('aria-label', `${teams[side].name}: ${scored} scored, ${shootoutTaken(s, side) - scored} missed`);
    }
  }

  /** the note: what to do, said to whoever has to do it, facing them */
  const tell = (text: string, facing: Side, ...buttons: HTMLElement[]): void => {
    words.textContent = text;
    actions.replaceChildren(...buttons);
    sayEl.classList.toggle('flip', facing === 'b' && !cpu);
  };

  /** the kick as it stands: the goleiro to place, or the flick to take */
  function render(news = ''): void {
    const lead = news ? `${news} ` : '';
    draw();
    showKicks();
    node.dataset.turn = m.turn;
    node.dataset.phase = m.phase;
    const placing = m.phase === 'placing';
    board.glow(busy || placing ? null : m.turn);
    board.placing(placing && defender() !== cpu && !busy ? keeperLine(defender()) : null, (x) => {
      sliding = clampKeeper(x);
      m = { ...m, keepers: { ...m.keepers, [defender()]: sliding } };
      draw();
    });
    if (placing) sliding = m.keepers[defender()];
    const kick = `Kick ${shootoutTaken(s, m.turn) + 1}`;
    if (cpu && (placing ? defender() === cpu : m.turn === cpu)) {
      tell(`${lead}${kick} for ${name(m.turn)}. ${placing ? `${name(cpu)} places its goleiro…` : `${name(cpu)} steps up…`}`, 'a');
      if (!busy) life.later(() => { void (placing ? cpuPlace() : cpuKick()); }, placing ? PACE.cpuPlace : PACE.cpuMove);
      return;
    }
    if (placing) tell(`${lead}${kick} for ${name(m.turn)}. ${name(defender())}: slide your goleiro along the line, then tap Pronto.`, defender(), ...(busy ? [] : [prontoBtn]));
    else {
      chipBtn.setAttribute('aria-pressed', String(chipArmed));
      const how = chipArmed ? 'Cobertura! Pull back, hold still while the ring fills to lift it, and let go.' : 'take your penalty! One flick.';
      tell(`${lead}${name(m.turn)}: ${how}`, m.turn, ...(m.turn !== cpu && !busy ? [chipBtn] : []));
    }
  }

  prontoBtn.addEventListener('click', () => {
    if (busy || m.phase !== 'placing') return;
    sfx.tap();
    m = pronto(m, sliding);
    narrate('shot', teams[m.turn], () => undefined, life.later);
    render();
  });

  /** the flick: a goal or not, the kick counted, then the next kick or the winner */
  async function shoot(index: number, vx: number, vy: number, byComputer = false, lift = 0): Promise<void> {
    if ((busy && !byComputer) || m.phase !== 'penalty' || !mayFlick(m, index)) return;
    busy = true;
    board.drop();
    board.glow(null);
    actions.replaceChildren();
    const taker = m.turn;
    const who = takerOf(teams[taker], shootoutTaken(s, taker));
    const play = flick(m, index, vx, vy, lift);
    chipArmed = false;
    const scored = scoredFrom(play, taker);
    /* a chip over the bar is a miss of its own */
    const miss = scored ? null : play.event.kind === 'over' ? 'over' : missed(play, taker);
    /* a goal or a near miss is slowed right down as the ball gets there */
    await board.play(play.frames, play.bumps, keepersOf(m), [], 1, scored || miss ? moment(play) : null);
    if (scored) celebrate(stage, teams[taker], life);
    const saved = !scored && play.bumps.some((b) => b.what === 'keeper');
    s = kicked(s, scored);
    node.dataset.kick = scored ? 'goal' : saved ? 'saved' : 'missed';
    showKicks();
    /* the commentator first, and the words read aloud once he has finished,
       so neither talks over the other; on the deciding kick, his "É campeão!" */
    const called = new Promise<void>((done) => {
      if (scored) { sfx.roar(); narrate('goal', teams[taker], done, life.later, who.name); } else if (miss) { sfx.groan(); narrate(miss, teams[miss === 'save' ? other(taker) : taker], done, life.later); }
      else { sfx.wrong(); done(); }
    });
    const by = who.name || `Number ${who.n}`;
    const said = scored ? `GOL! ${by} scores for ${name(taker)}.` : saved ? `Saved by ${name(other(taker))}!`
      : `${miss === 'post' ? 'Off the post! ' : miss === 'over' ? 'Over the bar! ' : ''}${onTheLine(play.frames.at(-1)!.ball) ? `${ON_THE_LINE} ` : ''}${by} misses for ${name(taker)}!`;
    tell(said, 'a');
    if (!s.winner) void called.then(() => speak(said));
    await wait(PACE.kick);
    if (s.winner) { await called; champion(s.winner); return; }
    m = penaltyFor(s.turn);
    setUpKick();
    busy = false;
    render(said);
  }

  /* ── the computer ───────────────────────────────────────────────────── */

  /** it guesses where to stand, slides its goleiro there, and says Pronto */
  async function cpuPlace(): Promise<void> {
    if (busy || m.phase !== 'placing' || defender() !== cpu) return;
    busy = true;
    const from = m.keepers[cpu];
    const to = guessKeeper();
    for (let i = 1; i <= 8; i += 1) {
      m = { ...m, keepers: { ...m.keepers, [cpu]: from + (to - from) * i / 8 } };
      draw();
      await wait(PACE.slideStep);
    }
    sfx.tap();
    m = pronto(m, to);
    narrate('shot', teams[m.turn], () => undefined, life.later);
    busy = false;
    render();
  }

  /** it takes its kick, its arrow shown for a moment first */
  async function cpuKick(): Promise<void> {
    if (busy || m.phase !== 'penalty' || m.turn !== cpu) return;
    const move = decide(m, level);
    if (move.kind !== 'flick') return;
    busy = true;
    const from = m[cpu][move.button];
    if (from) board.arrow(from, { button: move.button, vx: move.vx, vy: move.vy });
    await wait(PACE.cpuAim);
    board.clearAim();
    await shoot(move.button, move.vx, move.vy, true);
  }

  board.listen({
    side: () => (busy || m.phase !== 'penalty' || m.turn === cpu ? null : m.turn),
    may: (_side, index) => mayFlick(m, index),
    flick: (_side, index, f) => { void shoot(index, f.vx, f.vy, false, f.lift ?? 0); },
    chip: () => chipArmed && m.phase === 'penalty',
  });

  chipBtn.addEventListener('click', () => {
    if (busy || m.phase !== 'penalty') return;
    sfx.tap();
    chipArmed = !chipArmed;
    render();
  });

  /* ── the toss, and the end ──────────────────────────────────────────── */

  async function toss(): Promise<void> {
    busy = true;
    const first: Side = pick(['a', 'b'] as const);
    overlay.replaceChildren(el('div', { class: 'toss' },
      el('span', { class: 'coin', 'aria-hidden': 'true', text: '🪙' }),
      el('p', { text: `First kick: ${name(first)}!` }),
      el('p', { class: 'toss-to', text: `${SHOOTOUT_KICKS} kicks each` })));
    overlay.removeAttribute('hidden');
    node.dataset.phase = 'toss';
    tell('Coin toss…', 'a');
    sfx.whistle();
    await wait(PACE.toss);
    overlay.setAttribute('hidden', '');
    begin(newShootout(first));
  }

  function begin(from: Shootout): void {
    s = from;
    m = penaltyFor(s.turn);
    setUpKick();
    busy = false;
    speak(`First kick: ${teams[s.turn].name}!`);
    render();
  }

  function champion(side: Side): void {
    sfx.cheer();
    narrate('champion', teams[side], () => undefined, life.later);
    node.dataset.phase = 'over';
    node.dataset.winner = side;
    board.glow(null);
    tell(`${name(side)} win on penalties!`, 'a');
    const again = el('button', { class: 'btn', type: 'button', text: '🔁 Play again' });
    again.addEventListener('click', () => {
      overlay.setAttribute('hidden', '');
      node.querySelector('.confetti')?.remove();
      delete node.dataset.winner;
      void toss();
    });
    const change = el('button', { class: 'btn ghost', type: 'button', text: 'Change teams' });
    change.addEventListener('click', () => go(cpu ? 'pen-teams-1' : 'pen-teams-2'));
    /* a Copa tie: its result, with the shootout's, kept, and back to the cup */
    const pens = { us: shootoutGoals(s, 'a'), them: shootoutGoals(s, 'b') };
    const cup = tie && level0 ? recordResult(tie.cup, { ...level0, pens }) : null;
    if (cup) noPenaltiesWaiting();
    const copa = el('button', { class: 'btn', type: 'button', text: '🏆 Back to the Copa' });
    copa.addEventListener('click', () => { sfx.tap(); go('copa'); });
    overlay.replaceChildren(el('div', { class: 'win', role: 'dialog', 'aria-label': 'Full time' },
      el('p', { class: 'win-shout', text: cup ? cupShout(cup) : 'É campeão!' }),
      el('p', { class: 'win-team', text: label(teams[side]) }),
      ...(level0 ? [el('p', { class: 'win-score', text: `${label(teams.a, true)} ${level0.us} – ${level0.them} ${label(teams.b, true)} after extra time` })] : []),
      el('p', { class: 'win-score', text: `${label(teams.a, true)} ${pens.us} – ${pens.them} ${label(teams.b, true)}, on penalties` }),
      el('div', { class: 'row' }, ...(cup ? [copa] : [again, change]))));
    overlay.removeAttribute('hidden');
    node.append(confetti(teams[side]));
  }

  setUpKick();
  /* a test (or someone debugging) can put a shootout part-way through on the device to start from */
  const setup = read<Partial<Shootout> | null>('shootout-setup', null);
  if (setup && typeof setup === 'object') {
    write('shootout-setup', null);
    begin({ ...newShootout(setup.first === 'b' ? 'b' : 'a'), ...setup });
  } else {
    render();
    void toss();
  }
  return () => { document.body.classList.remove('night'); life.end(); };
}
