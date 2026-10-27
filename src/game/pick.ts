/* Picking teams before a match: yours and the computer's, or the two players'.
 *
 * Every team is a shirt to tap, in its colours (and with its crest, if one
 * was added). The side at the top may also be "Anyone", a different team
 * each time, never one whose buttons look like yours. Both sides cannot be
 * the same team; two that look alike are allowed, with a word of warning.
 * Under each side, a button gives its team a crest from the device's photos,
 * or changes it. The picks are kept for the next match, and Kick off starts
 * it. */

import { el } from '../lib/dom';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { crestButton, redrawShirts, shirtTile } from './shirts';
import { TEAMS, clash, ourTeam, rivalChoice, setPick, teamById, type Team } from './teams';

type Players = 1 | 2;

function picker(players: Players): (root: HTMLElement) => void {
  return (root) => {
    let a = ourTeam().id;
    let b = rivalChoice();
    if (b === a) b = 'any';
    const sides = players === 1
      ? { a: 'Your team', b: 'The computer plays' }
      : { a: 'Player at the bottom', b: 'Player at the top' };

    const warn = el('p', { class: 'said pick-warn', 'aria-live': 'polite' });

    /** a team's shirt to tap, or Anyone's die */
    const shirt = (t: Team | null, side: 'a' | 'b'): HTMLButtonElement => {
      const id = t ? t.id : 'any';
      const button = shirtTile(t);
      button.addEventListener('click', () => {
        sfx.tap();
        if (side === 'a') a = id; else b = id;
        draw();
      });
      return button;
    };
    const shirts = {
      a: TEAMS.map((t) => shirt(t, 'a')),
      b: [shirt(null, 'b'), ...TEAMS.map((t) => shirt(t, 'b'))],
    };
    /* a crest for each side's team, or a new one; none for Anyone */
    const said = el('p', { class: 'said pick-said', 'aria-live': 'polite' });
    const page = el('div', { class: 'wrap pick' });
    const saved = (t: Team, words: string): void => {
      redrawShirts(page, t);
      crests.a.update();
      crests.b.update();
      said.textContent = words;
    };
    const crests = {
      a: crestButton(() => teamById(a) ?? null, saved),
      b: crestButton(() => teamById(b) ?? null, saved),
    };

    /** which is picked on each side, and which may not be */
    function draw(): void {
      for (const side of ['a', 'b'] as const) {
        const chosen = side === 'a' ? a : b;
        const otherPick = side === 'a' ? b : a;
        for (const button of shirts[side]) {
          const id = button.dataset.team!;
          button.setAttribute('aria-pressed', String(id === chosen));
          /* not the team the other side has */
          button.disabled = id !== 'any' && id === otherPick;
        }
      }
      crests.a.update();
      crests.b.update();
      const [ta, tb] = [teamById(a), teamById(b)];
      warn.textContent = ta && tb && clash(ta, tb) ? 'Those two look alike on the table: their buttons may be hard to tell apart.' : '';
    }

    const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
    back.addEventListener('click', () => go('home'));
    const kick = el('button', { class: 'btn big kick', type: 'button', text: '▶ Kick off' });
    kick.addEventListener('click', () => {
      setPick('a', a);
      setPick('b', b);
      sfx.tap();
      go(players === 1 ? 'computador' : 'partida');
    });
    page.append(
      el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, players === 1 ? '1 player' : '2 players'))),
      el('section', { class: 'panel' }, el('h2', { class: 'lbl', text: sides.a }), el('div', { class: 'teams', role: 'group', 'aria-label': sides.a }, ...shirts.a), crests.a.node),
      el('section', { class: 'panel' }, el('h2', { class: 'lbl', text: sides.b }), el('div', { class: 'teams', role: 'group', 'aria-label': sides.b }, ...shirts.b), crests.b.node),
      warn, said,
      el('div', { class: 'kick-row' }, kick));
    root.append(page);
    draw();
  };
}

export const mountOne = picker(1);
export const mountTwo = picker(2);
