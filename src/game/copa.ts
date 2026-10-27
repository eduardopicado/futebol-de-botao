/* The Copa's page: the cup in progress, round by round, and what to do next.
 *
 * Each round shows its opponent's shirt and how hard the computer plays,
 * with the result once it is played. Still in it: play the next round. Won
 * the final: the trophy, with the commentator and confetti the moment it is
 * won (a later visit shows the trophy quietly). Knocked out: start another
 * cup. With no cup on the device it says what a cup is and starts one. The
 * cup itself is cup.ts. */

import { el } from '../lib/dom';
import { lifetime } from '../lib/life';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { LEVEL_NAMES } from './choices';
import { confetti } from './confetti';
import { ROUNDS, cupNow, cupsWon, justWon, roundOf, stageOf, type Cup } from './cup';
import { narrate } from './narration';
import { kit, label, teamById } from './teams';

export function mount(root: HTMLElement): () => void {
  const life = lifetime();
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));
  const page = el('div', { class: 'wrap copa' },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, '🏆 Copa'))));
  const cup = cupNow();
  const won = cupsWon();
  const tally = won > 0 ? el('p', { class: 'tag copa-tally', text: `Cups won on this iPad: ${won}` }) : null;
  const newCup = (text: string, big = false): HTMLElement => {
    const b = el('a', { class: big ? 'btn big' : 'btn ghost', href: '#/copa-team', text });
    b.addEventListener('click', () => sfx.tap());
    return b;
  };

  if (!cup) {
    page.append(el('section', { class: 'panel copa-intro' },
      el('p', { text: 'Three matches against the computer: a quarter-final, a semi-final and the final, each harder than the last. Win all three and the cup is yours.' }),
      el('div', { class: 'kick-row' }, newCup('▶ Pick your team', true))), ...(tally ? [tally] : []));
    root.append(page);
    return () => life.end();
  }

  const stage = stageOf(cup);
  const team = teamById(cup.team)!;
  page.dataset.stage = stage;
  page.append(el('p', { class: 'copa-team' }, kit(team, 32), el('span', { text: `Your team: ${label(team)}` })));

  /* how it ended comes first, above the rounds, so a phone shows it on opening */
  if (stage === 'playing') {
    const round = ROUNDS[roundOf(cup)];
    const play = el('a', { class: 'btn big', href: '#/copa-jogo', text: `▶ Play the ${round.name.toLowerCase()}` });
    play.addEventListener('click', () => sfx.whistle());
    page.append(bracket(cup), el('div', { class: 'kick-row' }, play), el('div', { class: 'row copa-again' }, newCup('Start a new cup')));
  } else if (stage === 'won') {
    page.append(el('section', { class: 'panel copa-trophy', role: 'status' },
      el('p', { class: 'trophy', 'aria-hidden': 'true', text: '🏆' }),
      el('p', { class: 'win-shout', text: 'É campeão!' }),
      el('p', { class: 'win-team', text: `${label(team)} won the Copa` })),
    bracket(cup), el('div', { class: 'kick-row' }, newCup('🏆 Play another cup', true)));
    if (justWon()) {
      narrate('champion', team, () => undefined, life.later);
      page.append(confetti(team));
    }
  } else {
    const lost = ROUNDS[cup.results.length - 1];
    page.append(el('section', { class: 'panel copa-out', role: 'status' },
      el('p', { class: 'win-team', text: `Out in the ${lost.name.toLowerCase()}.` }),
      el('p', { text: 'So close! Pick a team and go again.' })),
    bracket(cup), el('div', { class: 'kick-row' }, newCup('▶ Start a new cup', true)));
  }
  if (tally) page.append(tally);
  root.append(page);
  return () => life.end();
}

/** the three rounds: who, how hard, and how it went */
function bracket(cup: Cup): HTMLElement {
  const next = stageOf(cup) === 'playing' ? roundOf(cup) : -1;
  return el('ol', { class: 'copa-rounds' }, ...ROUNDS.map((r, i) => {
    const them = teamById(cup.opponents[i])!;
    const result = cup.results[i];
    const how = result
      ? `${result.us > result.them ? 'Won' : 'Lost'} ${result.us} – ${result.them}`
      : i === next ? 'Next' : 'To come';
    const state = result ? (result.us > result.them ? 'won' : 'lost') : i === next ? 'next' : 'later';
    return el('li', { class: `copa-round ${state}`, 'data-round': String(i) },
      el('span', { class: 'copa-round-name', text: r.name }),
      el('span', { class: 'copa-opponent' }, kit(them, 32), el('span', { text: label(them) })),
      el('span', { class: 'copa-level', text: LEVEL_NAMES[r.level] }),
      el('span', { class: 'copa-result', text: how }));
  }));
}
