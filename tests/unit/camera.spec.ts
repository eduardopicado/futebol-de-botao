/* The TV camera: straight above it changes nothing; tilted, what stands up
   is drawn above its foot, the far end smaller, the near things last; and
   the CSS that tilts the table is the same camera. */

import { describe, expect, it } from 'vitest';
import { BAR, GOLEIROS, L, MOUTH, W } from '../../src/content/botao';
import { ballPiece, camAt, cssOf, goalPieces, goleiroPiece, project } from '../../src/game/camera';

describe('the TV camera', () => {
  it('straight above, every point of the felt is where it was', () => {
    const cam = camAt(0, 'top');
    for (const [x, y] of [[0, 0], [W, L], [17, 63]]) {
      const p = project(cam, x, y);
      expect(p.x).toBeCloseTo(x, 9);
      expect(p.y).toBeCloseTo(y, 9);
      expect(p.k).toBeCloseTo(1, 9);
    }
    expect(cssOf(cam, 8).transform).toContain('rotateX(0.00deg)');
  });

  it('tilted: the goal at the top further away and smaller, the bottom nearer and bigger, and what stands up drawn above its foot', () => {
    const cam = camAt(1, 'top');
    const far = project(cam, W / 2, 0);
    const near = project(cam, W / 2, L);
    expect(far.k).toBeLessThan(1);
    expect(near.k).toBeGreaterThan(far.k);
    expect(near.near).toBeGreaterThan(far.near);
    const foot = project(cam, MOUTH[0], 0, 0);
    const head = project(cam, MOUTH[0], 0, BAR);
    expect(head.y).toBeLessThan(foot.y);
    /* the middle stays the middle */
    expect(project(cam, W / 2, 30).x).toBeCloseTo(W / 2, 9);
    expect(cssOf(cam, 8).transform).toMatch(/perspective\(880\.0px\) rotateX\(40\.00deg\) scale3d\(1\.22/);
  });

  it('turns smoothly: a little of the way is a little tilt, slow to start', () => {
    expect(camAt(0.1, 'top').tilt).toBeLessThan(40 * 0.1);
    expect(camAt(0.5, 'top').tilt).toBeCloseTo(20, 9);
    expect(camAt(2, 'top').tilt).toBe(40);
  });

  it('the goal shot at stands with its net; the one on the camera\'s side, seen through, only its frame', () => {
    const cam = camAt(1, 'top');
    const top = goalPieces(cam, 'top');
    const bottom = goalPieces(cam, 'bottom');
    expect(top).toHaveLength(2);
    expect(top[0].shapes.some((s) => s.cls.startsWith('tv-net'))).toBe(true);
    expect(bottom).toHaveLength(1);
    expect(bottom[0].shapes.filter((s) => s.cls === 'tv-post')).toHaveLength(3);
    /* the net is behind the frame */
    expect(top[0].near).toBeLessThan(top[1].near);
  });

  it('a goleiro is a block as tall as he is, its face towards the camera drawn last', () => {
    const cam = camAt(1, 'top');
    const g = GOLEIROS['3'];
    const piece = goleiroPiece(cam, 'top', g, 32, 0, '#123456');
    const front = piece.shapes.at(-1)!;
    expect(front.kind).toBe('poly');
    if (front.kind !== 'poly') return;
    expect(front.fill).toBe('#123456');
    /* its top edge is drawn above its bottom edge, by about his height */
    const [bottomLeft, , , topLeft] = front.pts;
    expect(topLeft.y).toBeLessThan(bottomLeft.y);
  });

  it('a goleiro wears its team on the face towards the camera: a band at each end, and its crest, or else its flag', () => {
    const cam = camAt(1, 'top');
    const g = GOLEIROS['3'];
    const plain = goleiroPiece(cam, 'top', g, 32, 0, '#123456').shapes;
    const flagged = goleiroPiece(cam, 'top', g, 32, 0, '#123456', { trim: '#abcdef', flag: '🇧🇷' }).shapes;
    const worn = flagged.slice(plain.length);
    expect(worn.map((s) => s.kind)).toEqual(['poly', 'poly', 'text']);
    expect(worn.slice(0, 2).every((s) => s.kind === 'poly' && s.fill === '#abcdef')).toBe(true);
    const [flag, front] = [worn[2], plain.at(-1)!];
    if (flag.kind !== 'text' || front.kind !== 'poly') throw new Error('not a flag on a face');
    expect(flag.text).toBe('🇧🇷');
    /* in the middle of the face, and no taller than it */
    const ys = front.pts.map((p) => p.y);
    expect(flag.at.y).toBeGreaterThan(Math.min(...ys));
    expect(flag.at.y).toBeLessThan(Math.max(...ys));
    expect(flag.size).toBeLessThan(Math.max(...ys) - Math.min(...ys));
    /* a crest added for the team goes on instead of the flag */
    const crested = goleiroPiece(cam, 'top', g, 32, 0, '#123456', { trim: '#abcdef', flag: '🇧🇷', crest: 'data:image/png;base64,AAAA' }).shapes;
    expect(crested.at(-1)!.kind).toBe('image');
  });

  it('the ball in the air is drawn above its shadow, which stays on the felt', () => {
    const cam = camAt(1, 'top');
    const [shadow, ball] = ballPiece(cam, { x: 32, y: 20, z: 6 }).shapes;
    if (shadow.kind !== 'ellipse' || ball.kind !== 'ellipse') throw new Error('ellipses');
    expect(ball.at.y).toBeLessThan(shadow.at.y);
    expect(shadow.at.y).toBeCloseTo(project(cam, 32, 20).y, 9);
    /* on the felt, the ball sits on its shadow */
    const [s0, b0] = ballPiece(cam, { x: 32, y: 20 }).shapes;
    if (s0.kind !== 'ellipse' || b0.kind !== 'ellipse') throw new Error('ellipses');
    expect(Math.abs(b0.at.y - s0.at.y)).toBeLessThan(0.3);
  });
});
