/* Picking teams before a match: yours and the computer's, or the two players'.
 *
 * Every team is a shirt to tap, in its colours (and with its crest, if one
 * was added). The side at the top may also be "Anyone", a different team
 * each time, never one whose buttons look like yours. Both sides cannot be
 * the same team; two that look alike are allowed, with a word of warning.
 * The picks are kept for the next match, and Kick off starts it. */

import { el } from '../lib/dom';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { TEAMS, clash, kit, ourTeam, rivalChoice, setPick, teamById, type Team } from './teams';

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
      /* the name as shown first, then in full where it is shortened: PSG, Paris Saint-Germain */
      const named = !t ? 'Anyone, a different team each time' : t.short === t.name ? t.name : `${t.short}, ${t.name}`;
      const button = el('button', { class: 'team', type: 'button', 'data-team': id, 'aria-label': named },
        t ? kit(t, 44) : el('span', { class: 'any', 'aria-hidden': 'true', text: '🎲' }),
        el('span', { class: 'team-name', 'aria-hidden': 'true', text: t ? `${t.flag ? `${t.flag} ` : ''}${t.short}` : 'Anyone' })) as HTMLButtonElement;
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
    root.append(el('div', { class: 'wrap pick' },
      el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, players === 1 ? '1 player' : '2 players'))),
      el('section', { class: 'panel' }, el('h2', { class: 'lbl', text: sides.a }), el('div', { class: 'teams', role: 'group', 'aria-label': sides.a }, ...shirts.a)),
      el('section', { class: 'panel' }, el('h2', { class: 'lbl', text: sides.b }), el('div', { class: 'teams', role: 'group', 'aria-label': sides.b }, ...shirts.b)),
      warn,
      el('div', { class: 'kick-row' }, kick)));
    draw();
  };
}

export const mountOne = picker(1);
export const mountTwo = picker(2);
