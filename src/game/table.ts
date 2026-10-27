/* The table, drawn: the tray, the felt, the lines, the goals and the buttons.
 *
 * SVG in table units (src/content/botao.ts), so the physics' numbers are the
 * drawing's. The light comes from the top left, and everything is shapes and
 * gradients, never filters, so it stays at sixty frames a second on an iPad.
 * The tray is the design handoff's picture of it, its felt laid exactly over
 * the 64 × 98 pitch (TRAY and VIEW in botao.ts). */

import tray from '../assets/tray.webp';
import { crestOf } from '../lib/crests';
import { svg } from '../lib/dom';
import { L, MARKS, MOUTH, NET, POST, R, VIEW, W, type Point } from '../content/botao';
import type { Team } from './teams';

export const at = (g: SVGGraphicsElement, p: Point): void => g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);

/* The light comes from the top left, so things shine up there and throw
   their shadows down and to the right. Nothing here is more than shapes and
   gradients: no filters, so sixty frames a second stay cheap on an iPad. */
export const SHADOW = { x: 0.55, y: 0.85 } as const;
/** how high the crossbar stands, as it looks from in front and above */
const LIFT = 1.9;
/** how much narrower the back of the net looks each side, being further away */
const GOAL_BACK = 1.2;
/** how far a button's side shows below its top */
const DEPTH = 0.7;

/** the shading laid over the table, the buttons, the ball and the goal: a
    highlight and a shade on top of any colour, so one set serves every team */
export function shading(): SVGDefsElement {
  type Stop = [offset: number, colour: string, opacity: number];
  const stops = (...s: Stop[]): SVGElement[] => s.map(([o, c, a]) => svg('stop', { offset: `${o}%`, 'stop-color': c, 'stop-opacity': a }));
  const radial = (id: string, ...s: Stop[]): SVGElement => svg('radialGradient', { id, cx: '35%', cy: '30%', r: '75%' }, ...stops(...s));
  const linear = (id: string, to: [number, number], ...s: Stop[]): SVGElement =>
    svg('linearGradient', { id, x1: 0, y1: 0, x2: to[0], y2: to[1] }, ...stops(...s));
  return svg('defs', {},
    /* a button's face: a shine on the top left, darker towards the edge */
    radial('bt-shine', [0, '#fff', 0.6], [30, '#fff', 0.14], [65, '#fff', 0], [100, '#000', 0.3]),
    /* its rim: lit on the top left, in its own shade on the bottom right */
    linear('bt-bevel', [1, 1], [0, '#fff', 0.55], [42, '#fff', 0], [58, '#000', 0], [100, '#000', 0.5]),
    radial('bt-ballshade', [0, '#fff', 1], [50, '#f2f2f2', 1], [100, '#8c8c8c', 1]),
    /* the felt, lit in the middle and darker towards the rim */
    svg('radialGradient', { id: 'bt-feltlight', cx: '50%', cy: '42%', r: '72%' }, ...stops([0, '#fff', 0.12], [55, '#fff', 0], [100, '#000', 0.12])),
    /* the rim's shadow on the felt, along the top and down the left */
    linear('bt-rimdown', [0, 1], [0, '#000', 0.4], [100, '#000', 0]),
    linear('bt-rimright', [1, 0], [0, '#000', 0.4], [100, '#000', 0]),
    /* inside the net, darker towards the back */
    linear('bt-netdepth', [0, 1], [0, '#000', 0.5], [100, '#000', 0.12]),
    /* the goleiro's block, lit on top */
    linear('bt-blockshade', [0, 1], [0, '#fff', 0.45], [45, '#fff', 0], [100, '#000', 0.4]),
    /* a crest, cut to the button's face */
    svg('clipPath', { id: 'bt-crest-clip' }, svg('circle', { r: R * 0.72 })),
  );
}

/** a button's face, inside its rim */
const FACE = R * 0.72;

/** a button, raised off the felt: its shadow, its side showing below it,
    the rim in a team's second colour with a bevel, the face in its first
    with a shine, and on top the crest added for the team
    (src/lib/crests.ts), or its flag; its number, if it has one, small at the
    foot of the rim like the sticker on a real botão. Its top is where the
    physics has it */
export function button(team: Team, cls: string, number?: number): SVGGElement {
  const crest = crestOf(team.id);
  const g = svg('g', { class: `bt-btn ${cls}` },
    svg('circle', { r: R, cx: SHADOW.x, cy: SHADOW.y + DEPTH, class: 'bt-shadow' }),
    svg('circle', { r: R, cy: DEPTH, fill: team.colours[1], class: 'bt-side' }),
    svg('circle', { r: R, cy: DEPTH, class: 'bt-side-shade' }),
    svg('circle', { r: R, fill: team.colours[1], class: 'bt-rim' }),
    svg('circle', { r: R - 0.2, class: 'bt-bevel' }),
    svg('circle', { r: FACE, fill: team.colours[0], class: 'bt-face' }),
    /* the crest like the sticker on a real botão: cut to a circle, under the shine */
    crest ? svg('image', { href: crest, x: -FACE, y: -FACE, width: 2 * FACE, height: 2 * FACE, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#bt-crest-clip)', class: 'bt-crest' }) : null,
    svg('circle', { r: FACE, class: 'bt-shine' }));
  if (!crest && team.flag) {
    const flag = svg('text', { class: 'bt-flag', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 4.6 });
    flag.textContent = team.flag;
    g.append(flag);
  }
  if (number !== undefined) {
    const n = svg('text', { class: 'bt-number', y: R - 0.75, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 1.7 });
    n.textContent = String(number);
    g.append(n);
  }
  return g;
}

/** the inside of a goal, as a box seen from in front, drawn at the top: its
    back is further away, so a little narrower, and its sides show as slivers */
function goalNet(): SVGGElement {
  const [left, right] = MOUTH;
  const [backL, backR] = [left + GOAL_BACK, right - GOAL_BACK];
  /* x across the box at depth y, from the front (0) to the back (−NET), k from 0 to 1 across */
  const across = (k: number, y: number): number => {
    const d = -y / NET;
    return left + (backL - left) * d + ((right - left) - (2 * GOAL_BACK) * d) * k;
  };
  const net = svg('g', { class: 'bt-net' },
    svg('rect', { x: left, y: -NET, width: right - left, height: NET, class: 'bt-net-turf' }),
    svg('rect', { x: left, y: -NET, width: right - left, height: NET, class: 'bt-net-floor' }),
    svg('path', { class: 'bt-net-side', d: `M${left} 0 L${left} ${-NET} L${backL} ${-NET} Z M${right} 0 L${right} ${-NET} L${backR} ${-NET} Z` }));
  const cells = 11;
  for (let i = 1; i < cells; i += 1) {
    const k = i / cells;
    net.append(svg('line', { x1: across(k, 0), y1: 0, x2: across(k, -NET), y2: -NET }));
  }
  for (let y = -NET + 1.25; y < 0; y += 1.25) net.append(svg('line', { x1: across(0, y), y1: y, x2: across(1, y), y2: y }));
  net.append(
    svg('path', { class: 'bt-net-edge', d: `M${left} 0 L${backL} ${-NET} L${backR} ${-NET} L${right} 0` }),
    svg('line', { class: 'bt-backbar', x1: backL, y1: -NET, x2: backR, y2: -NET }));
  return net;
}

export function pitch(): SVGGElement {
  const line = (attrs: Record<string, string | number>): SVGElement => svg('rect', { ...attrs, class: 'bt-line' });
  const [left, right] = MOUTH;
  const net = goalNet();
  net.classList.add('ours');
  /* the bottom goal, the top one turned round: the side at the bottom
     attacks the top, and a ball in its own net is an own goal */
  const theirs = svg('g', { class: 'bt-goal-far', transform: FAR }, goalNet());
  /* mown stripes across the felt and down it, so it is mown in squares */
  const stripes = [
    ...Array.from({ length: 5 }, (_, i) => svg('rect', { x: 0, y: (2 * i + 1) * (L / 10), width: W, height: L / 10, class: 'bt-stripe' })),
    ...Array.from({ length: 3 }, (_, i) => svg('rect', { x: (2 * i + 1) * (W / 6), y: 0, width: W / 6, height: L, class: 'bt-stripe down' })),
  ];
  return svg('g', {},
    /* the wooden tray, the handoff's picture of it, its felt under ours (VIEW, botao.ts) */
    svg('image', { href: tray, x: VIEW.x, y: VIEW.y, width: VIEW.w, height: VIEW.h, preserveAspectRatio: 'none', class: 'bt-tray' }),
    svg('rect', { x: 0, y: 0, width: W, height: L, class: 'bt-felt' }),
    ...stripes,
    svg('rect', { x: 0, y: 0, width: W, height: L, fill: 'url(#bt-feltlight)' }),
    svg('rect', { x: 0, y: 0, width: W, height: 2.4, fill: 'url(#bt-rimdown)' }),
    svg('rect', { x: 0, y: 0, width: 2.4, height: L, fill: 'url(#bt-rimright)' }),
    net,
    theirs,
    line({ x: 0.6, y: 0.6, width: W - 1.2, height: L - 1.2 }),
    ...ends(),
    svg('line', { x1: 0.6, y1: L / 2, x2: W - 0.6, y2: L / 2, class: 'bt-line' }),
    svg('circle', { cx: W / 2, cy: L / 2, r: 8, class: 'bt-line' }),
    svg('circle', { cx: W / 2, cy: L / 2, r: 0.6, class: 'bt-spot' }),
    /* the frame's shadow on the felt in front of the goal */
    svg('path', { class: 'bt-goal-shadow', d: `M${left + SHADOW.x} ${SHADOW.y} L${right + SHADOW.x} ${SHADOW.y}` }),
  );
}

/** the markings at each end: the penalty area with the arc on its edge, the
    small area, the spot, and the quarter circles in the corners */
function ends(): SVGElement[] {
  const edge = 0.6;
  const [boxW, boxD] = MARKS.box;
  const [penW, penD] = MARKS.penalty;
  const { spot, arc } = MARKS;
  /* where the arc round the spot meets the penalty area's edge */
  const half = Math.sqrt(arc * arc - (penD - spot) ** 2);
  const corner = 1.6;
  return [0, 1].flatMap((end) => {
    /* the top end as drawn, and the bottom one turned round */
    const y = (d: number): number => (end === 0 ? edge + d : L - edge - d);
    const sweep = end === 0 ? 0 : 1;
    return [
      svg('rect', { class: 'bt-line', x: (W - penW) / 2, y: Math.min(y(0), y(penD)), width: penW, height: penD }),
      svg('rect', { class: 'bt-line', x: (W - boxW) / 2, y: Math.min(y(0), y(boxD)), width: boxW, height: boxD }),
      svg('circle', { class: 'bt-spot', cx: W / 2, cy: y(spot), r: 0.6 }),
      svg('path', { class: 'bt-line', d: `M${W / 2 - half} ${y(penD)} A${arc} ${arc} 0 0 ${sweep} ${W / 2 + half} ${y(penD)}` }),
      svg('path', { class: 'bt-line', d: `M${edge + corner} ${y(0)} A${corner} ${corner} 0 0 ${1 - sweep} ${edge} ${y(corner)}` }),
      svg('path', { class: 'bt-line', d: `M${W - edge - corner} ${y(0)} A${corner} ${corner} 0 0 ${sweep} ${W - edge} ${y(corner)}` }),
    ];
  });
}

/** the far end, drawn as the top one turned round */
export const FAR = `translate(0 ${L}) scale(1 -1)`;

/** the goal's frame: the uprights standing on the line, their round feet
    where the ball hits a post, and the crossbar across their tops. Drawn
    over the ball, so a ball in the net is behind the crossbar */
export function goalFrame(): SVGGElement {
  const [left, right] = MOUTH;
  return svg('g', { class: 'bt-goal' },
    ...MOUTH.map((x) => svg('line', { x1: x, y1: 0, x2: x, y2: -LIFT, class: 'bt-upright', 'stroke-width': 2 * POST })),
    svg('line', { x1: left, y1: -LIFT, x2: right, y2: -LIFT, class: 'bt-crossbar' }),
    svg('line', { x1: left, y1: -LIFT - 0.25, x2: right, y2: -LIFT - 0.25, class: 'bt-crossbar-shine' }),
  );
}
