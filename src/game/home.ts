/* The start: who you play for, who against, and the way onto the table.
 *
 * The settings live on their own page (src/game/grown-ups.ts), behind a
 * button that has to be held for three seconds, so a tap about cannot change
 * your team. */

import { el } from '../lib/dom';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { kit, ourTeam, rivalChoice, teamById, type Team } from './teams';

const HOLD_MS = 3000;

/** a button that only works when held down for three seconds, with a bar
    that fills while it is held; a tap just says what to do */
function holdButton(label: string, onDone: () => void): { node: HTMLButtonElement; stop: () => void } {
  let timer = 0;
  const hint = el('span', { class: 'hold-hint', text: 'Hold for 3 seconds' });
  const node = el('button', { class: 'btn ghost small hold', type: 'button' }, `${label} · `, hint);
  const stop = (): void => {
    window.clearTimeout(timer);
    timer = 0;
    node.classList.remove('holding');
  };
  const start = (): void => {
    if (timer) return;
    node.classList.add('holding');
    hint.textContent = 'Keep holding…';
    timer = window.setTimeout(() => { stop(); onDone(); }, HOLD_MS);
  };
  const letGo = (): void => {
    if (timer) hint.textContent = 'Hold for 3 seconds';
    stop();
  };
  node.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) node.addEventListener(type, letGo);
  node.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
  node.addEventListener('keyup', letGo);
  /* iOS opens its callout menu on a long press; the page must not */
  node.addEventListener('contextmenu', (e) => e.preventDefault());
  return { node, stop };
}

const side = (team: Team | null, name: string): HTMLElement =>
  el('figure', {}, team ? kit(team, 72) : el('span', { class: 'any', text: '❔', 'aria-hidden': 'true' }), el('figcaption', { text: name }));

export function mount(root: HTMLElement): () => void {
  const us = ourTeam();
  const rival = teamById(rivalChoice());
  const one = el('a', { class: 'btn big', href: '#/computador', text: '🤖 1 player' });
  const play = el('a', { class: 'btn big', href: '#/partida', text: '👥 2 players' });
  const practice = el('a', { class: 'btn big ghost', href: '#/treino', text: '⚽ Treino' });
  for (const link of [one, play, practice]) link.addEventListener('click', () => sfx.tap());
  const grownUps = holdButton('⚙ Grown-ups', () => { sfx.tap(); go('grown-ups'); });
  root.append(el('div', { class: 'home' },
    el('h1', {}, 'Futebol de ', el('span', { class: 'swash', text: 'Botão' })),
    el('div', { class: 'versus' },
      side(us, `${us.flag ? `${us.flag} ` : ''}${us.short}`),
      el('span', { text: 'v' }),
      side(rival && rival !== us ? rival : null, rival && rival !== us ? `${rival.flag ? `${rival.flag} ` : ''}${rival.short}` : 'Anyone')),
    el('div', { class: 'modes' }, one, play, practice),
    grownUps.node));
  return () => grownUps.stop();
}
