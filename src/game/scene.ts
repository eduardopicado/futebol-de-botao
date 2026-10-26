/* The things on the desk round the table, as in the design picture: chalk
 * doodles on the wall by the title, a coach's clipboard with a chalk tactic
 * on it, a leather pouch of spare buttons in the teams' colours, a plant,
 * and the sun through its leaves on the desk. The wall and the wood are
 * tiles in CSS (.scene in app.css).
 *
 * The pictures were made with ChatGPT from the design picture, made smaller
 * and saved as WebP (src/assets/). Decoration only: hidden from screen
 * readers, never in the way of a finger, and drawn once. The pouch's buttons
 * are drawn again after the settings, where the teams may have changed. */

import board from '../assets/clipboard.webp';
import leather from '../assets/pouch.webp';
import foliage from '../assets/plant.webp';
import sunlight from '../assets/sunlight.webp';
import chalkMarks from '../assets/chalk.webp';
import { svg } from '../lib/dom';
import { button, shading } from './table';
import { RIVALS, ourTeam, rivalChoice, teamById, type Team } from './teams';

const CHALK = { fill: 'none', stroke: 'rgba(255, 246, 231, .32)', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

/** chalk marks on the wall, a tactic out at each side, clear of the title
    and the words (src/assets/chalk.webp, made with ChatGPT) */
function doodles(): SVGSVGElement {
  return svg('svg', { class: 'doodles', viewBox: '0 0 1400 467', 'aria-hidden': 'true' },
    svg('image', { href: chalkMarks, width: 1400, height: 467 }));
}

/** the coach's clipboard (src/assets/clipboard.webp, made with ChatGPT,
    its chalkboard left blank), and a play drawn on it in chalk: two of
    ours, two of theirs, a pass and a shot */
function clipboard(): SVGSVGElement {
  const chalk = { ...CHALK, stroke: 'rgba(255, 255, 255, .72)', 'stroke-width': 8 };
  const x = (cx: number, cy: number): SVGElement => svg('path', { ...chalk, d: `M${cx - 22} ${cy - 22} L${cx + 22} ${cy + 22} M${cx + 22} ${cy - 22} L${cx - 22} ${cy + 22}` });
  return svg('svg', { class: 'clipboard', viewBox: '0 0 672 972', 'aria-hidden': 'true' },
    svg('image', { href: board, width: 672, height: 972 }),
    x(200, 340), svg('circle', { ...chalk, cx: 440, cy: 310, r: 26 }),
    svg('circle', { ...chalk, cx: 240, cy: 650, r: 26 }), x(430, 730),
    svg('path', { ...chalk, 'stroke-dasharray': '18 18', d: 'M262 618 Q370 520 420 345' }),
    svg('path', { ...chalk, d: 'M420 345 l-30 10 M420 345 l6 30' }),
    svg('path', { ...chalk, d: 'M462 288 Q500 250 486 222 M486 222 l-6 26 M486 222 l22 14' }));
}

/** a leather drawstring pouch, open (src/assets/pouch.webp, made with
    ChatGPT, empty), with spare buttons in it */
function pouch(us: Team, them: Team): SVGSVGElement {
  /* spare buttons, drawn as on the table (R = 5 table units) and made bigger */
  const spare = (team: Team, x: number, y: number): SVGGElement => {
    const g = button(team, 'spare');
    g.setAttribute('transform', `translate(${x} ${y}) scale(9)`);
    return g;
  };
  return svg('svg', { class: 'pouch', viewBox: '0 0 672 672', 'aria-hidden': 'true' },
    shading(),
    svg('image', { href: leather, width: 672, height: 672 }),
    spare(us, 286, 290), spare(them, 392, 302), spare(us, 336, 392));
}

/** a plant in the corner, its leaves catching the light
    (src/assets/plant.webp, made with ChatGPT, cut off at its bottom and
    right edges so it sits flush in the corner) */
function plant(): SVGSVGElement {
  return svg('svg', { class: 'plant', viewBox: '0 0 640 640', 'aria-hidden': 'true' },
    svg('image', { href: foliage, width: 640, height: 640 }));
}

/** the sun on the desk at the bottom left, through the leaves of a plant by
    the window (src/assets/sunlight.webp, made with ChatGPT) */
function leaves(): SVGSVGElement {
  return svg('svg', { class: 'leaves', viewBox: '0 0 900 600', 'aria-hidden': 'true' },
    svg('image', { href: sunlight, width: 900, height: 600 }));
}

export function mountScene(): void {
  const scene = document.createElement('div');
  scene.className = 'scene';
  scene.setAttribute('aria-hidden', 'true');
  const draw = (): void => {
    const us = ourTeam();
    const them = teamById(rivalChoice()) ?? RIVALS;
    /* the chalk stays on the wall, however tall the marks are on a wide screen */
    const wall = document.createElement('div');
    wall.className = 'wall-marks';
    wall.append(doodles());
    scene.replaceChildren(leaves(), wall, clipboard(), pouch(us, them === us ? RIVALS : them), plant());
  };
  draw();
  document.body.prepend(scene);
  /* the teams may have changed in the settings */
  window.addEventListener('hashchange', draw);
}
