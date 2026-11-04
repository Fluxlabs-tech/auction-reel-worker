// Deterministic PRNG (mulberry32) so decorative effects such as confetti are identical across
// re-renders of the same lot and unit tests stay stable.
export const createSeededRandom = (seedText: string): (() => number) => {
  let seed: number;
  let i: number;

  try {
    seed = 2166136261;
    for (i = 0; i < seedText.length; i++) {
      seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
    }

    return () => {
      let t: number;

      try {
        seed = (seed + 0x6d2b79f5) | 0;
        t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      } catch (error: any) {
        console.error('[createSeededRandom.next] Error:', error?.message || error);
        return 0.5;
      }
    };
  } catch (error: any) {
    console.error('[createSeededRandom] Error:', error?.response?.data || error?.message || error);
    return () => 0.5;
  }
};
