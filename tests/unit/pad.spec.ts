/* A game controller: a stick resting near the middle is the middle, an aim
 * outlasts the stick springing back, and the d-pad finds the next thing the
 * way it points.
 *
 *   npm run test:unit */

import { describe, expect, it } from 'vitest';
import { DEAD, deadZone, latch, towards, type Sample } from '../../src/lib/pad';

describe('the dead zone', () => {
  it('a stick resting a little off the middle is the middle', () => {
    expect(deadZone(0.1, -0.15)).toEqual({ x: 0, y: 0 });
    expect(deadZone(DEAD * 0.99, 0)).toEqual({ x: 0, y: 0 });
  });
  it('the rest is stretched to reach 1, the way it points kept', () => {
    const full = deadZone(0, -1);
    expect(full.x).toBeCloseTo(0);
    expect(full.y).toBeCloseTo(-1);
    const half = deadZone((1 + DEAD) / 2, 0);
    expect(half.x).toBeCloseTo(0.5);
    const slant = deadZone(0.6, 0.6);
    expect(slant.x).toBeCloseTo(slant.y);
  });
  it('a stick that reads past 1 (a square gate) is no more than 1', () => {
    const p = deadZone(1, 1);
    expect(Math.sqrt(p.x * p.x + p.y * p.y)).toBeCloseTo(1);
  });
});

/** readings a frame apart, ~16 ms */
const frames = (sizes: number[]): Sample[] => sizes.map((s, i) => ({ t: i * 16, x: 0, y: s }));

describe('the aim kept when the stick is let go', () => {
  it('let go, it springs home in a few frames: the aim is the one before the fall', () => {
    expect(latch(frames([0.4, 0.7, 0.92, 0.93, 0.92, 0.6, 0.25, 0.05]))).toEqual({ x: 0, y: 0.92 });
  });
  it('eased back slowly, the weaker aim is the one kept', () => {
    expect(latch(frames([0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.66]))).toEqual({ x: 0, y: 0.66 });
  });
  it('a fall slower than a spring, a frame or a few apart, is not taken for one', () => {
    expect(latch(frames([0.8, 0.72, 0.64]))).toEqual({ x: 0, y: 0.64 });
  });
  it('only the last moment counts: an old strong aim is not brought back', () => {
    const s: Sample[] = [{ t: 0, x: 0, y: 1 }, { t: 500, x: 0, y: 0.5 }, { t: 516, x: 0, y: 0.15 }];
    expect(latch(s)).toEqual({ x: 0, y: 0.5 });
  });
  it('a weak aim springs back as surely as a strong one', () => {
    expect(latch(frames([0.2, 0.2, 0.08, 0.02]))).toEqual({ x: 0, y: 0.2 });
  });
  it('eased back a little between readings far apart is still easing', () => {
    const s: Sample[] = [{ t: 0, x: 0, y: 0.9 }, { t: 48, x: 0, y: 0.8 }];
    expect(latch(s)).toEqual({ x: 0, y: 0.8 });
  });
  it('a busy device, a frame every 100 ms: the spring is still seen for one', () => {
    const s: Sample[] = [{ t: 0, x: 0, y: 0.92 }, { t: 100, x: 0, y: 0.92 }, { t: 200, x: 0, y: 0.23 }];
    expect(latch(s)).toEqual({ x: 0, y: 0.92 });
  });
  it('nothing read, nothing kept', () => {
    expect(latch([])).toBeNull();
  });
});

describe('the next one the way the d-pad points', () => {
  const at = { x: 50, y: 50 };
  it('straight on beats nearer but off to the side', () => {
    expect(towards(at, { x: 1, y: 0 }, [{ x: 70, y: 52 }, { x: 58, y: 70 }])).toBe(0);
  });
  it('nothing behind, nothing level with it, nothing missing', () => {
    expect(towards(at, { x: 1, y: 0 }, [{ x: 30, y: 50 }, { x: 50.5, y: 80 }, null])).toBe(-1);
  });
  it('up is towards the top of the screen', () => {
    expect(towards(at, { x: 0, y: -1 }, [{ x: 50, y: 80 }, { x: 52, y: 20 }])).toBe(1);
  });
});
