export function rollD6(seed: number): { value: 1 | 2 | 3 | 4 | 5 | 6; nextSeed: number } {
  const nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { value: ((nextSeed % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6, nextSeed };
}
