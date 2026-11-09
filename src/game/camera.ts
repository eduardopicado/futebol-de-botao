/* The TV camera, for a called shot or a penalty: the table tilts back, the
 * goal being shot at further away, and the things that stand up off the
 * felt (the goals' posts, crossbars and nets, the goleiros, a chipped ball)
 * are drawn standing, where that tilt puts them.
 *
 * The felt and everything flat on it (the lines, the buttons, which are
 * flat discs) tilt with the table itself, a CSS transform on the board's
 * SVG; the standing things are drawn on a flat layer over it (board.ts), at
 * the place on the screen that same transform gives their points. Both come
 * from one camera here, so they cannot disagree.
 *
 * Presentation only: the physics, and where a finger lands, never see the
 * camera, which only turns while nothing can be flicked. */

import { BAR, L, MOUTH, NET, POST, THICK, VIEW, W, BALL, type Goleiro, type Point } from '../content/botao';

/** which goal the shot is at: the one at the top (behind the shooter), or
    the one at the bottom (the camera behind that goal, the shot coming at it) */
export type Attack = 'top' | 'bottom';

/** the camera: how far the table is tilted back (degrees), how much it is
    scaled up, the point it tilts about (table units), and the perspective's
    distance (table units) */
export interface Cam { tilt: number; scale: number; ox: number; oy: number; p: number }

/** fully tilted */
const TILT = 40;
const SCALE = 0.22;
const P = 110;

/** a smooth start and stop for `c` from 0 to 1 */
const ease = (c: number): number => c * c * (3 - 2 * c);

/** the camera `c` of the way (0 to 1) from straight above to the TV view */
export function camAt(c: number, attack: Attack): Cam {
  const e = ease(Math.min(1, Math.max(0, c)));
  /* behind the shooter, tilting about a little below the ball's usual
     place; behind the goal at the bottom, tilting about nearer it */
  const oy = VIEW.y + VIEW.h * (attack === 'top' ? 0.42 : 0.72);
  return { tilt: TILT * e, scale: 1 + SCALE * e, ox: W / 2, oy, p: P };
}

/** where a point of the table, `z` up off the felt, is seen on the flat
    layer (table units, the board's own viewBox); `near` grows towards the
    camera, and `k` is how much bigger than straight above it looks */
export function project(cam: Cam, x: number, y: number, z = 0): { x: number; y: number; near: number; k: number } {
  const a = (cam.tilt * Math.PI) / 180;
  const [sx, sy, sz] = [cam.scale * (x - cam.ox), cam.scale * (y - cam.oy), cam.scale * z];
  const y1 = sy * Math.cos(a) - sz * Math.sin(a);
  const z1 = sy * Math.sin(a) + sz * Math.cos(a);
  const k = cam.p / (cam.p - z1);
  return { x: cam.ox + sx * k, y: cam.oy + y1 * k, near: z1, k: k * cam.scale };
}

/** the CSS that tilts the board's SVG the same way, for `u` pixels a table unit */
export function cssOf(cam: Cam, u: number): { transform: string; origin: string } {
  return {
    transform: `perspective(${(cam.p * u).toFixed(1)}px) rotateX(${cam.tilt.toFixed(2)}deg) scale3d(${cam.scale}, ${cam.scale}, ${cam.scale})`,
    origin: `${((cam.ox - VIEW.x) * u).toFixed(1)}px ${((cam.oy - VIEW.y) * u).toFixed(1)}px`,
  };
}

/** something to draw on the flat layer: its shapes, and how near it is, to draw the far ones first */
export interface Piece { near: number; shapes: Shape[] }
export type Shape =
  | { kind: 'poly'; pts: Point[]; cls: string; fill?: string }
  | { kind: 'line'; a: Point; b: Point; cls: string; width: number }
  | { kind: 'ellipse'; at: Point; rx: number; ry: number; cls: string };

const flat = (q: { x: number; y: number }): Point => ({ x: q.x, y: q.y });

/** a goal standing on its line (y = 0 at the top, L at the bottom): its net
    behind, and in front of that its posts and crossbar. The goal at the
    bottom is the camera's side of the table, its net between the camera and
    the play: seen through, so only its frame is drawn */
export function goalPieces(cam: Cam, end: Attack): Piece[] {
  const line = end === 'top' ? 0 : L;
  const back = end === 'top' ? -NET : L + NET;
  /* the net slopes down from the crossbar to the back */
  const high = BAR * 0.72;
  const [m0, m1] = MOUTH;
  const at = (x: number, y: number, z: number): Point => flat(project(cam, x, y, z));
  const net: Shape[] = [
    { kind: 'poly', cls: 'tv-net', pts: [at(m0, back, 0), at(m1, back, 0), at(m1, back, high), at(m0, back, high)] },
    { kind: 'poly', cls: 'tv-net', pts: [at(m0, line, 0), at(m0, line, BAR), at(m0, back, high), at(m0, back, 0)] },
    { kind: 'poly', cls: 'tv-net', pts: [at(m1, line, 0), at(m1, line, BAR), at(m1, back, high), at(m1, back, 0)] },
    { kind: 'poly', cls: 'tv-net roof', pts: [at(m0, line, BAR), at(m1, line, BAR), at(m1, back, high), at(m0, back, high)] },
    /* the mesh: down the back and across the roof */
    ...Array.from({ length: 7 }, (_, i): Shape => {
      const x = m0 + ((m1 - m0) * (i + 1)) / 8;
      return { kind: 'line', cls: 'tv-mesh', width: 0.12, a: at(x, back, 0), b: at(x, back, high) };
    }),
    ...Array.from({ length: 7 }, (_, i): Shape => {
      const x = m0 + ((m1 - m0) * (i + 1)) / 8;
      return { kind: 'line', cls: 'tv-mesh', width: 0.12, a: at(x, line, BAR), b: at(x, back, high) };
    }),
  ];
  const k = project(cam, MOUTH[0], line).k;
  const frame: Shape[] = [
    ...MOUTH.map((x): Shape => ({ kind: 'line', cls: 'tv-post', width: 2 * POST * k, a: at(x, line, 0), b: at(x, line, BAR) })),
    { kind: 'line', cls: 'tv-post', width: 2 * POST * k, a: at(m0, line, BAR), b: at(m1, line, BAR) },
  ];
  return [
    ...(end === 'top' ? [{ near: project(cam, (m0 + m1) / 2, back).near, shapes: net }] : []),
    { near: project(cam, (m0 + m1) / 2, line).near + 0.01, shapes: frame },
  ];
}

/** a goleiro standing in front of his line (`end`'s), at `x` across and
    `out` off it: a block, its far faces first and its near one and top last */
export function goleiroPiece(cam: Cam, end: Attack, g: Goleiro, x: number, out: number, fill: string): Piece {
  const dir = end === 'top' ? 1 : -1;
  const line = end === 'top' ? 0 : L;
  const [y0, y1] = [line + dir * (g.y[0] + out), line + dir * (g.y[1] + out)];
  const [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
  const [xa, xb] = [x - g.w / 2, x + g.w / 2];
  const at = (px: number, py: number, pz: number): Point => flat(project(cam, px, py, pz));
  const face = (pts: Point[], cls: string): Shape => ({ kind: 'poly', pts, cls, fill });
  /* the camera is always towards the bottom of the table (larger y): the face at yb is the near one */
  return {
    near: project(cam, x, (ya + yb) / 2).near,
    shapes: [
      /* its sides in shade, its top in the light (no filters: a shade drawn over) */
      ...[xa, xb].flatMap((sx) => {
        const pts = [at(sx, ya, 0), at(sx, yb, 0), at(sx, yb, g.h), at(sx, ya, g.h)];
        return [face(pts, 'tv-keeper'), { kind: 'poly', pts, cls: 'tv-shade' } as Shape];
      }),
      face([at(xa, ya, g.h), at(xb, ya, g.h), at(xb, yb, g.h), at(xa, yb, g.h)], 'tv-keeper'),
      { kind: 'poly', pts: [at(xa, ya, g.h), at(xb, ya, g.h), at(xb, yb, g.h), at(xa, yb, g.h)], cls: 'tv-light' },
      face([at(xa, yb, 0), at(xb, yb, 0), at(xb, yb, g.h), at(xa, yb, g.h)], 'tv-keeper'),
    ],
  };
}

/** the ball: its shadow on the felt, and the ball itself at its height, a
    flat disc seen from the camera */
export function ballPiece(cam: Cam, ball: Point): Piece {
  const z = ball.z ?? 0;
  const a = (cam.tilt * Math.PI) / 180;
  const shadow = project(cam, ball.x, ball.y, 0);
  const top = project(cam, ball.x, ball.y, z + THICK / 2);
  const r = BALL * top.k;
  return {
    near: shadow.near,
    shapes: [
      { kind: 'ellipse', cls: 'tv-ball-shadow', at: flat(shadow), rx: BALL * shadow.k, ry: BALL * shadow.k * Math.cos(a) },
      { kind: 'ellipse', cls: 'tv-ball', at: flat(top), rx: r, ry: Math.max(r * Math.cos(a), r * 0.45) },
    ],
  };
}
