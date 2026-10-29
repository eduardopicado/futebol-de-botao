/* The start screen's flick, once, as the app opens: your team's button,
 * pulled back at the start of the line under "Botão", flicks the ball, which
 * rolls along the line and stops at its end, a full stop to the title; the
 * button goes. A moment of the game before any of it is chosen.
 *
 * Nothing waits for it and nothing is in its way: it draws over the title
 * with pointer-events off, and every button can be tapped while it plays.
 * The start screen asks for it only when the app opened on it (home.ts), and
 * it does nothing under Reduce Motion. The launch images are made under
 * Reduce Motion too, so they show the title without it. */

import { prefersReducedMotion, svg } from '../lib/dom';
import type { Life } from '../lib/life';
import { sfx } from '../lib/sfx';
import { ourTeam } from './teams';

/** how it goes, in milliseconds: the two appear, the pull, the strike, the roll, the button goes */
const T = { appear: 250, pull: 300, strike: 160, roll: 850, gone: 350 } as const;

export async function flick(title: HTMLElement, life: Life): Promise<void> {
  if (prefersReducedMotion()) return;
  const swash = title.querySelector<HTMLElement>('.swash');
  if (!swash || typeof swash.animate !== 'function') return;
  /* the title's own font, so the line is where it will stay */
  await document.fonts.ready.catch(() => undefined);
  if (!life.alive()) return;

  const { width: w, height: h } = swash.getBoundingClientRect();
  /* the line under the word: 2% in from each end, its middle 0.5px above the box's foot (app.css) */
  const line = { from: w * 0.02, to: w * 0.98, y: h - 0.5 };
  const r = Math.max(4, h * 0.11);
  const R = r * 2;
  const ballAt = line.from + r;
  const ballTo = line.to - r;
  const touch = ballAt - r - R;
  const team = ourTeam();

  const ball = svg('circle', { r, cx: 0, cy: 0, fill: '#fff', stroke: '#1B1B1B', 'stroke-width': Math.max(1, r * 0.22) });
  const button = svg('g', {},
    svg('circle', { r: R, cx: R * 0.12, cy: R * 0.22, fill: '#000', 'fill-opacity': 0.25 }),
    /* a light edge, so a rim as dark as the board still shows */
    svg('circle', { r: R, fill: team.colours[1], stroke: '#FFF6E7', 'stroke-opacity': 0.55, 'stroke-width': Math.max(1, R * 0.08) }),
    svg('circle', { r: R * 0.72, fill: team.colours[0] }),
    svg('circle', { r: R * 0.3, cx: -R * 0.3, cy: -R * 0.3, fill: '#fff', 'fill-opacity': 0.35 }));
  const layer = svg('svg', {
    class: 'intro', 'aria-hidden': 'true', width: w, height: h + R * 2, viewBox: `0 0 ${w} ${h + R * 2}`,
  }, button, ball);
  swash.append(layer);
  const at = (x: number): string => `translate(${x.toFixed(1)}px, ${line.y.toFixed(1)}px)`;

  const start = T.appear;
  const hit = start + T.pull + T.strike;
  const end = hit + T.roll;
  const all = end + T.gone;
  const keys = (frames: [number, string, number][]): Keyframe[] =>
    frames.map(([t, transform, opacity]) => ({ offset: t / all, transform, opacity }));
  button.animate(keys([
    [0, at(touch - R * 0.2), 0],
    [start, at(touch - R * 0.2), 1],
    /* pulled back, as a finger does */
    [start + T.pull, at(touch - R * 1.1), 1],
    [hit, at(touch), 1],
    [hit + 180, at(touch + R * 0.35), 1],
    [end, at(touch + R * 0.35), 1],
    [all, at(touch + R * 0.35), 0],
  ]), { duration: all, easing: 'linear', fill: 'forwards' });
  ball.style.transform = at(ballAt);
  ball.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.appear, fill: 'both' });
  /* the roll slows, as on felt */
  ball.animate([{ transform: at(ballAt) }, { transform: at(ballTo) }],
    { delay: hit, duration: T.roll, easing: 'cubic-bezier(.15, .65, .3, 1)', fill: 'both' });
  life.later(() => sfx.clack(), hit);
  life.later(() => button.remove(), all + 50);
}
