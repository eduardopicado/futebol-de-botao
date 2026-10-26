export const shuffle = <T>(items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** takes n items, spreading them evenly across the groups rather than
 *  emptying one group before starting the next */
export function spreadAcross<T>(groups: T[][], n: number): T[] {
  const pools = groups.map((g) => shuffle(g));
  const out: T[] = [];
  for (let round = 0; out.length < n; round += 1) {
    let took = false;
    for (const pool of pools) {
      if (out.length >= n) break;
      const next = pool.pop();
      if (next !== undefined) { out.push(next); took = true; }
    }
    if (!took) break;
  }
  return out;
}
