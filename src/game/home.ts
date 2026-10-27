/* The start: the name, the ways to play (a match for 1 player or 2, a
 * penalty shootout, Treino), How to play, and the settings. A match
 * starts by picking the teams (pick.ts); the settings are behind the ⚙
 * (settings.ts). The first time, How to play (guide.ts) is offered above
 * the ways to play; once it has been opened or turned down, it waits below
 * them. */

import { el } from '../lib/dom';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { read, write } from '../lib/storage';

/** the guide has been opened, or turned down, on this device */
export const GUIDE_SEEN = 'guide-seen';

export function mount(root: HTMLElement): void {
  const one = el('a', { class: 'btn big', href: '#/teams-1', text: '🤖 1 player' });
  const two = el('a', { class: 'btn big', href: '#/teams-2', text: '👥 2 players' });
  const penalties = el('a', { class: 'btn big ghost', href: '#/pen-teams-1', text: '🥅 Pênaltis' });
  const practice = el('a', { class: 'btn big ghost', href: '#/treino', text: '⚽ Treino' });
  for (const link of [one, two, penalties, practice]) link.addEventListener('click', () => sfx.tap());
  const settings = el('button', { class: 'icon-btn settings-btn', type: 'button', 'aria-label': 'Settings', text: '⚙' });
  settings.addEventListener('click', () => { sfx.tap(); go('settings'); });
  const seen = read<boolean>(GUIDE_SEEN, false) === true;
  const how = (big: boolean): HTMLElement => {
    const link = el('a', { class: big ? 'btn small' : 'btn ghost small', href: '#/how-to-play', text: '📖 How to play' });
    link.addEventListener('click', () => sfx.tap());
    return link;
  };
  const modes = el('div', { class: 'modes' }, one, two, penalties, practice);
  const later = el('div', { class: 'home-how' }, how(false));
  const offer = el('div', { class: 'home-how offer', role: 'group', 'aria-label': 'New here?' }, el('span', { text: 'New here?' }), how(true));
  const no = el('button', { class: 'btn ghost small', type: 'button', text: 'Not now' });
  no.addEventListener('click', () => {
    sfx.tap();
    write(GUIDE_SEEN, true);
    offer.remove();
    modes.after(later);
  });
  offer.append(no);
  root.append(el('div', { class: 'home' },
    settings,
    el('h1', {}, 'Futebol de ', el('span', { class: 'swash', text: 'Botão' })),
    el('p', { class: 'home-tag', text: 'Flick your buttons. Three touches a turn. Call "A gol!" to shoot.' }),
    ...(seen ? [modes, later] : [offer, modes])));
}
