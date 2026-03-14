// ============================================================================
// Nema Lab Simulation Engine — Deterministic RNG
// Pure TypeScript, zero browser/DOM/Canvas dependencies
//
// CRITICAL: These functions must remain byte-identical to the original app.js
// implementation to preserve seed determinism across the rebuild.
// ============================================================================

/**
 * Hash a string into a seed-generating closure.
 * Uses MurmurHash3-like mixing.
 *
 * Identical to the original `hashString()` in app.js.
 *
 * @param input - Any string (e.g. seed + parameters concatenation)
 * @returns A closure that, when called, returns a 32-bit unsigned integer seed
 */
export function hashString(input: string): () => number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * Mulberry32 PRNG — produces uniform [0, 1) values from a 32-bit seed.
 *
 * Identical to the original `mulberry32()` in app.js.
 * The returned closure mutates the captured seed on each call.
 *
 * @param seed - 32-bit unsigned integer seed
 * @returns A closure that returns the next pseudo-random number in [0, 1)
 */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return function rng(): number {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a random alphanumeric seed string.
 *
 * NOTE: This is the only non-deterministic function in the engine; it relies
 * on Math.random(). It is used only to create *new* seeds, not during
 * simulation stepping. Determinism is guaranteed once the seed is set.
 */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}
