/* The things on the desk round the table, as in the design picture: chalk
 * doodles on the wall by the title, a coach's clipboard with a chalk tactic
 * on it, a leather pouch of spare buttons in his team's colours, a plant,
 * and the shadows of leaves where the sun comes in. The wall and the wood
 * are CSS (.scene in app.css).
 *
 * Decoration only: hidden from screen readers, never in the way of a finger,
 * and drawn with shapes and gradients alone, once. The pouch's buttons are
 * drawn again when he comes back from the grown-ups' screen, where his team
 * may have changed. */

import board from '../assets/clipboard.webp';
import leather from '../assets/pouch.webp';
import foliage from '../assets/plant.webp';
import { svg } from '../lib/dom';
import { button, shading } from './table';
import { RIVALS, ourTeam, rivalChoice, teamById, type Team } from './teams';

const CHALK = { fill: 'none', stroke: 'rgba(255, 246, 231, .32)', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

const cross = (x: number, y: number, s: number): SVGElement => svg('path', { ...CHALK, d: `M${x - s} ${y - s} L${x + s} ${y + s} M${x + s} ${y - s} L${x - s} ${y + s}` });
const ring = (x: number, y: number, r: number): SVGElement => svg('circle', { ...CHALK, cx: x, cy: y, r });

/** chalk marks on the wall, out at the sides, clear of the title and the words */
function doodles(): SVGSVGElement {
  return svg('svg', { class: 'doodles', viewBox: '0 0 980 300', 'aria-hidden': 'true' },
    cross(46, 118, 9), ring(96, 70, 8), cross(30, 236, 8),
    svg('path', { ...CHALK, d: 'M880 52 Q905 38 934 52 M880 52 l12 -9 M880 52 l14 5' }),
    ring(944, 120, 8),
    svg('path', { ...CHALK, d: 'M934 196 Q962 226 936 256 M936 256 l2 -15 M936 256 l-14 -5' }));
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

/** the shadows of leaves on the desk, soft, where the sun comes in */
function leaves(): SVGSVGElement {
  const soft = svg('radialGradient', { id: 'sc-shade' },
    svg('stop', { offset: '0%', 'stop-color': '#2A1204', 'stop-opacity': 0.42 }),
    svg('stop', { offset: '60%', 'stop-color': '#2A1204', 'stop-opacity': 0.22 }),
    svg('stop', { offset: '100%', 'stop-color': '#2A1204', 'stop-opacity': 0 }));
  const shade = (x: number, y: number, rx: number, ry: number, turn: number): SVGElement =>
    svg('ellipse', { cx: x, cy: y, rx, ry, fill: 'url(#sc-shade)', transform: `rotate(${turn} ${x} ${y})` });
  return svg('svg', { class: 'leaves', viewBox: '0 0 600 400', 'aria-hidden': 'true' },
    svg('defs', {}, soft),
    shade(80, 260, 70, 24, -35), shade(150, 200, 64, 20, -60), shade(60, 340, 80, 26, -15),
    shade(200, 300, 58, 18, -40), shade(130, 380, 70, 22, -5), shade(250, 380, 60, 18, -25),
    shade(30, 180, 60, 18, -70), shade(300, 340, 50, 16, -50));
}

export function mountScene(): void {
  const scene = document.createElement('div');
  scene.className = 'scene';
  scene.setAttribute('aria-hidden', 'true');
  const draw = (): void => {
    const us = ourTeam();
    const them = teamById(rivalChoice()) ?? RIVALS;
    scene.replaceChildren(leaves(), doodles(), clipboard(), pouch(us, them === us ? RIVALS : them), plant());
  };
  draw();
  document.body.prepend(scene);
  /* his team may have changed on the grown-ups' screen */
  window.addEventListener('hashchange', draw);
}
