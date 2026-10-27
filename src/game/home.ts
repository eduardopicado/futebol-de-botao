/* The start: the name, the ways to play (a match for 1 player or 2, a
 * penalty shootout, Treino), and the settings. A match
 * starts by picking the teams (pick.ts); the settings are behind the ⚙
 * (settings.ts). */

import { el } from '../lib/dom';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';

export function mount(root: HTMLElement): void {
  const one = el('a', { class: 'btn big', href: '#/teams-1', text: '🤖 1 player' });
  const two = el('a', { class: 'btn big', href: '#/teams-2', text: '👥 2 players' });
  const penalties = el('a', { class: 'btn big ghost', href: '#/pen-teams-1', text: '🥅 Pênaltis' });
  const practice = el('a', { class: 'btn big ghost', href: '#/treino', text: '⚽ Treino' });
  for (const link of [one, two, penalties, practice]) link.addEventListener('click', () => sfx.tap());
  const settings = el('button', { class: 'icon-btn settings-btn', type: 'button', 'aria-label': 'Settings', text: '⚙' });
  settings.addEventListener('click', () => { sfx.tap(); go('settings'); });
  root.append(el('div', { class: 'home' },
    settings,
    el('h1', {}, 'Futebol de ', el('span', { class: 'swash', text: 'Botão' })),
    el('p', { class: 'home-tag', text: 'Flick your buttons. Three touches a turn. Call "A gol!" to shoot.' }),
    el('div', { class: 'modes' }, one, two, penalties, practice)));
}
