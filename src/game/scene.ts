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

/** a wooden clipboard with a chalkboard on it, and a play drawn in chalk */
function clipboard(): SVGSVGElement {
  const grad = svg('linearGradient', { id: 'sc-board', x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': '#C98D5A' }), svg('stop', { offset: '100%', 'stop-color': '#9A5E31' }));
  const metal = svg('linearGradient', { id: 'sc-metal', x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': '#E3E3E3' }), svg('stop', { offset: '55%', 'stop-color': '#A9A9A9' }), svg('stop', { offset: '100%', 'stop-color': '#7D7D7D' }));
  const chalk = { ...CHALK, stroke: 'rgba(255, 255, 255, .7)', 'stroke-width': 3 };
  return svg('svg', { class: 'clipboard', viewBox: '0 0 220 300', 'aria-hidden': 'true' },
    svg('defs', {}, grad, metal),
    svg('rect', { x: 14, y: 22, width: 200, height: 274, rx: 16, fill: 'rgba(20, 8, 0, .35)' }),
    svg('rect', { x: 4, y: 12, width: 200, height: 274, rx: 16, fill: 'url(#sc-board)' }),
    svg('rect', { x: 20, y: 44, width: 168, height: 226, rx: 6, fill: '#1E4A3F' }),
    svg('rect', { x: 20, y: 44, width: 168, height: 226, rx: 6, fill: 'none', stroke: 'rgba(0, 0, 0, .3)', 'stroke-width': 2 }),
    /* the play: two of ours, a defender, a pass and a shot */
    svg('path', { ...chalk, d: 'M44 104 L64 124 M64 104 L44 124' }),
    svg('circle', { ...chalk, cx: 140, cy: 96, r: 11 }),
    svg('circle', { ...chalk, cx: 72, cy: 200, r: 11 }),
    svg('path', { ...chalk, d: 'M126 220 L146 240 M146 220 L126 240' }),
    svg('path', { ...chalk, 'stroke-dasharray': '7 7', d: 'M84 192 Q120 150 132 108' }),
    svg('path', { ...chalk, d: 'M132 108 l-12 4 M132 108 l2 12' }),
    svg('path', { ...chalk, d: 'M150 84 Q170 60 160 50' }),
    /* the clip */
    svg('rect', { x: 66, y: 2, width: 76, height: 30, rx: 7, fill: 'url(#sc-metal)', stroke: '#6B6B6B', 'stroke-width': 1.5 }),
    svg('circle', { cx: 104, cy: 12, r: 6, fill: '#5A5A5A' }));
}

/** a leather pouch, open, with spare buttons in it */
function pouch(us: Team, them: Team): SVGSVGElement {
  const leather = svg('linearGradient', { id: 'sc-leather', x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': '#8E522A' }), svg('stop', { offset: '100%', 'stop-color': '#5E3216' }));
  /* spare buttons, drawn as on the table (R = 5 table units) and made bigger */
  const spare = (team: Team, x: number, y: number): SVGGElement => {
    const g = button(team, 'spare');
    g.setAttribute('transform', `translate(${x} ${y}) scale(4.6)`);
    return g;
  };
  return svg('svg', { class: 'pouch', viewBox: '0 0 200 250', 'aria-hidden': 'true' },
    svg('defs', {}, leather), shading(),
    svg('path', { d: 'M28 22 Q100 2 176 22 L190 222 Q100 250 14 222 Z', fill: 'rgba(20, 8, 0, .35)', transform: 'translate(8 10)' }),
    svg('path', { d: 'M28 22 Q100 2 176 22 L190 222 Q100 250 14 222 Z', fill: 'url(#sc-leather)' }),
    svg('path', { d: 'M36 34 Q100 16 168 34 L180 214 Q100 238 24 214 Z', fill: 'none', stroke: '#D9A574', 'stroke-width': 2.5, 'stroke-dasharray': '7 6' }),
    svg('path', { d: 'M42 40 Q100 26 162 40 L170 200 Q100 220 32 200 Z', fill: '#3E200C' }),
    spare(us, 74, 72), spare(them, 128, 112), spare(us, 82, 160));
}

/** a plant in the corner, its leaves catching the light */
function plant(): SVGSVGElement {
  const leaf = svg('linearGradient', { id: 'sc-leaf', x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': '#6DB55A' }), svg('stop', { offset: '100%', 'stop-color': '#2A6B34' }));
  const one = (x: number, y: number, turn: number, size: number): SVGElement => svg('g', { transform: `translate(${x} ${y}) rotate(${turn}) scale(${size})` },
    svg('path', { d: 'M0 0 C18 -22 52 -24 74 0 C52 24 18 22 0 0 Z', fill: 'url(#sc-leaf)' }),
    svg('path', { d: 'M4 0 L66 0', stroke: 'rgba(255, 255, 255, .28)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  return svg('svg', { class: 'plant', viewBox: '0 0 220 240', 'aria-hidden': 'true' },
    svg('defs', {}, leaf),
    one(200, 230, -150, 1.3), one(206, 200, -125, 1.15), one(212, 170, -105, 1.2),
    one(214, 236, -170, 1), one(190, 140, -120, 0.95), one(218, 120, -95, 0.9));
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
