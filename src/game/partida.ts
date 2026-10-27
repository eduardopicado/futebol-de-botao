/* Partida — a match, first to 3 goals (or 5, or 10): two players on one iPad,
 * or one against the computer.
 *
 * The iPad lies flat between the two players. Side a sits at the bottom and
 * attacks the goal at the top; side b sits at the top and attacks the
 * bottom. The table never turns: the side to play glows, and the paper note
 * above the table turns to face whoever has to do something, the defender
 * too when they have to place their goleiro.
 *
 * A coin toss picks who kicks off. Then each turn is up to three flicks with
 * any buttons (at 1 Toque, one flick, and the note warns when the ball is
 * parked between the buttons of the side to play); a shot has to be called with "A gol!", in a turn that started
 * in the attacking half, and the defender slides their goleiro along the
 * line and taps Pronto before it is taken. Fouls give free kicks, or a
 * penalty in the area. When the turn passes, the note says whose it is and
 * nothing can be flicked for a moment, so nobody flicks by mistake in the
 * handover.
 *
 * Against the computer you play side a, at the bottom, and the note never
 * turns round: the computer thinks for a moment on its turn, shows its arrow
 * for a moment and flicks, calls "A gol!" for you to place your goleiro, and
 * places its own when you call. All the rules are in src/content/match.ts,
 * the computer in src/content/computer.ts; the table on the screen is
 * board.ts. */

import { el } from '../lib/dom';
import { lifetime } from '../lib/life';
import { pick } from '../lib/random';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { read, write } from '../lib/storage';
import { COMPUTER, decide, placeKeeper } from '../content/computer';
import {
  KICKOFF_TOUCHES, call, clampKeeper, flick, mayCall, mayFlick, mustFree, newMatch, other, pronto, touchesFor,
  type Event, type Match, type Side,
} from '../content/match';
import { type Benched, type Keepers, makeBoard, SHAPE } from './board';
import { RULE_NAMES, buttonsPerSide, computerLevel, goalsToWin, matchRule, speak } from './choices';
import { narrate } from './narration';
import { label, ourTeam, rivalFor, type Team } from './teams';

/** a moment between turns when nothing can be flicked */
const HANDOVER = 1000;

/** two players on one iPad */
export const mount = (root: HTMLElement): (() => void) => match(root, false);
/** one player, against the computer */
export const mountComputer = (root: HTMLElement): (() => void) => match(root, true);

function match(root: HTMLElement, computer: boolean): () => void {
  const life = lifetime();
  /* the computer's side, if it is playing, and how well */
  const cpu: Side | null = computer ? COMPUTER : null;
  const level = computerLevel();
  const wait = (ms: number): Promise<void> => new Promise((done) => { life.later(done, ms); });
  const a = ourTeam();
  const teams: Record<Side, Team> = { a, b: rivalFor(a) };
  const name = (s: Side): string => label(teams[s], true);

  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));
  const scoreEl = el('p', { class: 'score match-score', 'aria-live': 'polite' });
  const words = el('span', { class: 'say-words' });
  const actions = el('span', { class: 'say-actions' });
  const sayEl = el('div', { class: 'bt-say', 'aria-live': 'polite' }, words, actions);
  const whose = el('span', { class: 'whose' });
  const pips = el('span', { class: 'bt-pips', role: 'img' });
  const board = makeBoard(life, `The table: ${teams.a.name} at the bottom, attacking the top, and ${teams.b.name}${cpu ? ', the computer,' : ''} at the top`);
  const stage = el('div', { class: 'bt-stage' }, board.node);
  const node = el('div', { class: 'game', vars: SHAPE },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, 'Partida'), el('p', { class: 'bt-touches' }, whose, pips)), scoreEl),
    sayEl, stage);
  root.append(node);

  const callBtn = el('button', { class: 'btn small call', type: 'button', text: '📣 A gol!' });
  const prontoBtn = el('button', { class: 'btn small pronto', type: 'button', text: '✋ Pronto' });

  let m: Match = newMatch(goalsToWin(), 'a', buttonsPerSide(), matchRule());
  /* a flick, a pause or the toss is under way: no finger does anything */
  let busy = true;
  /* the goleiro being placed, where the finger has slid it so far */
  let sliding = 0;
  /* what just happened, said before what to do next */
  let news = '';
  /* the computer is about to move: it has been asked once */
  let thinking = false;

  const keepersOf = (x: Match): Keepers => ({ top: x.keepers.b, bottom: x.keepers.a });
  const benchedOf = (x: Match): Benched[] => x.out.map(({ side, index, net }) => ({ side, index, net }));
  const defender = (): Side => other(m.turn);
  const keeperLine = (s: Side): 'top' | 'bottom' => (s === 'a' ? 'bottom' : 'top');

  const showScore = (): void => {
    scoreEl.replaceChildren(`${teams.a.flag ?? ''} ${m.score.a} – ${m.score.b} ${teams.b.flag ?? ''}`.trim());
    scoreEl.setAttribute('aria-label', `${teams.a.name} ${m.score.a}, ${teams.b.name} ${m.score.b}`);
    node.dataset.score = `${m.score.a}-${m.score.b}`;
  };

  /** the note: what to do, said to whoever has to do it, facing them */
  const tell = (text: string, facing: Side, ...buttons: HTMLElement[]): void => {
    words.textContent = text;
    actions.replaceChildren(...buttons);
    /* against the computer the note always faces you, at the bottom */
    sayEl.classList.toggle('flip', facing === 'b' && !cpu);
  };

  /** everything as it is now, and what the side to play may do, after the
      news if there is some (given, or kept from the last time) */
  function render(said?: string): void {
    if (said !== undefined) news = said;
    const lead = news ? `${news} ` : '';
    board.draw({ ball: m.ball, a: m.a, b: m.b }, keepersOf(m), benchedOf(m));
    showScore();
    node.dataset.turn = m.turn;
    node.dataset.phase = m.phase;
    node.dataset.touches = String(m.touches);
    const most = m.phase === 'kickoff' ? KICKOFF_TOUCHES : m.phase === 'penalty' || m.phase === 'shot' ? 1 : touchesFor(m.rule);
    const used = m.phase === 'penalty' || m.phase === 'shot' ? 0 : m.touches;
    pips.replaceChildren(...Array.from({ length: most }, (_, i) => el('span', { class: `bt-pip${i < used ? ' used' : ''}` })));
    pips.setAttribute('aria-label', `${used} of ${most} touches used`);
    whose.textContent = m.phase === 'placing' ? `${name(defender())}: goleiro` : name(m.turn);
    const placing = m.phase === 'placing';
    board.glow(busy || placing || m.phase === 'over' ? null : m.turn);
    board.placing(placing && defender() !== cpu ? keeperLine(defender()) : null, (x) => {
      sliding = clampKeeper(x);
      m = { ...m, keepers: { ...m.keepers, [defender()]: sliding } };
      board.draw({ ball: m.ball, a: m.a, b: m.b }, keepersOf(m), benchedOf(m));
    });
    if (placing) sliding = m.keepers[defender()];
    const t = name(m.turn);
    /* the computer's own turn, or its goleiro to place: it says so, and does it */
    if (cpu && m.phase !== 'over' && (m.phase === 'placing' ? defender() === cpu : m.turn === cpu)) {
      tell(`${lead}${m.phase === 'placing' ? `A gol! ${name(cpu)} places its goleiro…` : `${t} is thinking…`}`, 'a');
      if (!busy) schedule();
      return;
    }
    switch (m.phase) {
      case 'kickoff':
        tell(`${lead}Kick-off: ${t}. Two flicks, by two different buttons, and the ball has to leave the circle.`, m.turn);
        break;
      case 'play': {
        const left = touchesFor(m.rule) - m.touches;
        const count = m.rule === '1' ? `${t} to play: one flick.` : m.touches === 0 ? `${t} to play: three touches.` : `${t}: ${left} ${left === 1 ? 'touch' : 'touches'} left.`;
        const free = mustFree(m) ? ' The ball is parked between two of your buttons: free it with this flick, or it is a free kick to them.' : '';
        tell(`${lead}${count}${free}${mayCall(m) ? ' Shooting? Call it first!' : ''}`, m.turn, ...(mayCall(m) && !busy && m.turn !== cpu ? [callBtn] : []));
        break;
      }
      case 'placing':
        tell(`${lead}${m.penalty ? `Penalty to ${t}! ` : 'A gol! '}${name(defender())}: slide your goleiro along the line, then tap Pronto.`, defender(), ...(busy ? [] : [prontoBtn]));
        break;
      case 'shot':
        tell(`${lead}${t}: take your shot!`, m.turn);
        break;
      case 'penalty':
        tell(`${lead}${t}: take the penalty! One flick.`, m.turn);
        break;
      case 'over':
        break;
    }
  }

  callBtn.addEventListener('click', () => {
    if (busy || !mayCall(m)) return;
    sfx.whistle();
    m = call(m);
    render('');
  });
  prontoBtn.addEventListener('click', () => {
    if (busy || m.phase !== 'placing') return;
    sfx.tap();
    m = pronto(m, sliding);
    render('');
  });

  /* ── what a flick led to ────────────────────────────────────────────── */

  const WHY: Record<Extract<Event, { kind: 'turn' }>['why'], string> = {
    touches: 'Three touches.',
    still: 'The ball did not move.',
    theirs: 'Their touch.',
    kickoff: '',
    penalty: '',
  };

  async function after(event: Event, called: boolean, saved: boolean): Promise<void> {
    switch (event.kind) {
      case 'goal': {
        sfx.cheer();
        narrate('goal', teams[event.side], () => undefined, life.later);
        node.dataset.goal = event.side;
        showScore();
        words.textContent = `${event.own ? 'Own goal! ' : ''}GOL! ${name(event.side)}! ${m.score.a} – ${m.score.b}`;
        actions.replaceChildren();
        sayEl.classList.remove('flip');
        await wait(2600);
        delete node.dataset.goal;
        render('');
        return;
      }
      case 'champion':
        champion(event.side);
        return;
      case 'uncalled': {
        sfx.whistle();
        const why = event.couldCall ? 'No goal: the shot was not called. Call "A gol!" first.' : 'No goal: a shot only counts in a turn that starts in the other half.';
        speak(why);
        render(`${why} Goal kick to ${name(other(event.side))}.`);
        await wait(2200);
        return;
      }
      case 'foul': {
        sfx.whistle();
        const why = event.penalty ? `Foul in the area! Penalty to ${name(event.side)}.` : `Foul! Free kick to ${name(event.side)}.`;
        speak(why);
        render(event.penalty ? 'Foul in the area!' : why);
        await wait(1800);
        return;
      }
      case 'parked': {
        sfx.whistle();
        const why = `Parked ball! Free kick to ${name(event.side)}: the ball was left between the other side's own buttons.`;
        speak(why);
        render(why);
        await wait(2200);
        return;
      }
      case 'retake':
        sfx.whistle();
        render('The ball has to leave the circle: kick off again.');
        await wait(1600);
        return;
      case 'turn': {
        const shotWords = event.why === 'penalty' ? (saved ? 'Saved!' : 'Missed!') : called ? (saved ? 'Saved!' : 'No goal.') : event.why === 'touches' && m.rule === '1' ? '' : WHY[event.why];
        render(shotWords);
        /* the handover: nothing can be flicked for a moment */
        await wait(HANDOVER);
        return;
      }
      case 'on':
        render(called ? (saved ? 'Saved! Play on.' : 'No goal. Play on.') : '');
        return;
    }
  }

  async function shoot(side: Side, index: number, vx: number, vy: number, byComputer = false): Promise<void> {
    if ((busy && !byComputer) || side !== m.turn || !mayFlick(m, index)) return;
    busy = true;
    board.drop();
    board.glow(null);
    actions.replaceChildren();
    const called = m.phase === 'shot' || m.phase === 'penalty';
    const before = m;
    const play = flick(m, index, vx, vy);
    await board.play(play.frames, play.bumps, keepersOf(before), benchedOf(before));
    m = play.next;
    node.dataset.event = play.event.kind;
    const saved = play.bumps.some((b) => b.what === 'keeper');
    if (saved && called) narrate('save', teams[other(before.turn)], () => undefined, life.later);
    await after(play.event, called, saved);
    if (m.phase === 'over') return;
    busy = false;
    render();
  }

  /* ── the computer ───────────────────────────────────────────────────── */

  /** the computer's next move, a moment from now: its goleiro, or its turn */
  function schedule(): void {
    if (!cpu || busy || thinking || m.phase === 'over') return;
    thinking = true;
    if (m.phase === 'placing') life.later(() => { void cpuPlace(cpu); }, 500);
    else life.later(() => { void cpuMove(cpu); }, 700);
  }

  /** it slides its goleiro to where it wants it, and says Pronto */
  async function cpuPlace(me: Side): Promise<void> {
    busy = true;
    const from = m.keepers[me];
    const to = placeKeeper(m, level);
    for (let i = 1; i <= 8; i += 1) {
      m = { ...m, keepers: { ...m.keepers, [me]: from + (to - from) * i / 8 } };
      board.draw({ ball: m.ball, a: m.a, b: m.b }, keepersOf(m), benchedOf(m));
      await wait(50);
    }
    sfx.tap();
    m = pronto(m, to);
    busy = false;
    thinking = false;
    render('');
  }

  /** its turn: "A gol!", or a flick, its arrow shown for a moment first */
  async function cpuMove(me: Side): Promise<void> {
    if (m.turn !== me || m.phase === 'placing' || m.phase === 'over') { thinking = false; return; }
    const move = decide(m, level);
    if (move.kind === 'call') {
      sfx.whistle();
      m = call(m);
      thinking = false;
      render('');
      return;
    }
    busy = true;
    const from = m[me][move.button];
    if (from) board.arrow(from, { button: move.button, vx: move.vx, vy: move.vy });
    await wait(900);
    board.clearAim();
    thinking = false;
    await shoot(me, move.button, move.vx, move.vy, true);
  }

  board.listen({
    side: () => (busy || m.phase === 'placing' || m.phase === 'over' || m.turn === cpu ? null : m.turn),
    may: (_side, index) => {
      if (mayFlick(m, index)) return true;
      sfx.wrong();
      words.textContent = 'At the kick-off, the second flick is by another button.';
      return false;
    },
    flick: (side, index, f) => { void shoot(side, index, f.vx, f.vy); },
  });

  /* ── the toss, and the end ──────────────────────────────────────────── */

  const overlay = el('div', { class: 'bt-overlay', hidden: '' });
  stage.append(overlay);

  async function toss(): Promise<void> {
    const first: Side = pick(['a', 'b'] as const);
    overlay.replaceChildren(el('div', { class: 'toss' },
      el('span', { class: 'coin', 'aria-hidden': 'true', text: '🪙' }),
      el('p', { text: `Kick-off: ${name(first)}!` }),
      el('p', { class: 'toss-to', text: `First to ${goalsToWin()} goals · ${RULE_NAMES[m.rule]}` })));
    overlay.removeAttribute('hidden');
    node.dataset.phase = 'toss';
    tell('Coin toss…', 'a');
    sfx.whistle();
    await wait(1800);
    overlay.setAttribute('hidden', '');
    m = newMatch(goalsToWin(), first, m.size, m.rule);
    speak(`Kick-off: ${teams[first].name}!`);
    busy = false;
    render('');
  }

  function champion(side: Side): void {
    sfx.cheer();
    narrate('champion', teams[side], () => undefined, life.later);
    showScore();
    node.dataset.phase = 'over';
    node.dataset.winner = side;
    board.glow(null);
    words.textContent = `${name(side)} win!`;
    actions.replaceChildren();
    const again = el('button', { class: 'btn', type: 'button', text: '🔁 Play again' });
    again.addEventListener('click', () => {
      overlay.setAttribute('hidden', '');
      node.querySelector('.confetti')?.remove();
      delete node.dataset.winner;
      void toss();
    });
    const change = el('button', { class: 'btn ghost', type: 'button', text: 'Change teams' });
    change.addEventListener('click', () => go(cpu ? 'teams-1' : 'teams-2'));
    overlay.replaceChildren(el('div', { class: 'win', role: 'dialog', 'aria-label': 'Full time' },
      el('p', { class: 'win-shout', text: 'É campeão!' }),
      el('p', { class: 'win-team', text: label(teams[side]) }),
      el('p', { class: 'win-score', text: `${label(teams.a, true)} ${m.score.a} – ${m.score.b} ${label(teams.b, true)}` }),
      el('div', { class: 'row' }, again, change)));
    overlay.removeAttribute('hidden');
    const colours = [teams[side].colours[0], teams[side].colours[1], '#F3B229', '#FFF6E7'];
    node.append(el('div', { class: 'confetti', 'aria-hidden': 'true' },
      ...Array.from({ length: 48 }, (_, i) => el('i', { vars: { '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.18}s`, '--c': colours[i % colours.length], '--r': `${(i * 53) % 360}deg` } }))));
  }

  /* a test (or someone debugging) can put a match on the device to start from */
  const setup = read<Partial<Match> | null>('match-setup', null);
  if (setup && typeof setup === 'object') {
    write('match-setup', null);
    m = { ...newMatch(goalsToWin(), setup.turn === 'b' ? 'b' : 'a', setup.a?.length ?? buttonsPerSide(), matchRule()), ...setup };
    board.setUp(teams.a, teams.b, { a: m.a.length, b: m.b.length });
    busy = false;
    render('');
  } else {
    board.setUp(teams.a, teams.b, { a: m.a.length, b: m.b.length });
    render();
    void toss();
  }
  return () => life.end();
}
