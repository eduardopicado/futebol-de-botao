/* A goal, felt: the screen flashes, the table shakes, and "GOOOL!" in the
 * scorer's colours bursts over it, then all of it clears, so nothing is
 * left on the table (app.css draws it). Under Reduce Motion, the words alone,
 * fading in and out. The goal is said in words above the table too, so this
 * is hidden from screen readers. */

import { el } from '../lib/dom';
import type { Life } from '../lib/life';
import type { Team } from './teams';

/** how long the words stay, in ms (the flash and the shake are over sooner) */
export const CELEBRATION = 1800;

export function celebrate(stage: HTMLElement, team: Team, life: Life, words = 'GOOOL!'): void {
  for (const old of stage.querySelectorAll('.bt-flash, .bt-gooool')) old.remove();
  const flash = el('div', { class: 'bt-flash', 'aria-hidden': 'true' });
  const banner = el('div', { class: 'bt-gooool', 'aria-hidden': 'true', vars: { '--fill': team.colours[0], '--edge': team.colours[1] } },
    el('span', { text: words }));
  stage.append(flash, banner);
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
  life.later(() => { stage.classList.remove('shake'); flash.remove(); }, 700);
  life.later(() => banner.remove(), CELEBRATION);
}
