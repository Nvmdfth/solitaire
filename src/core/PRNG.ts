/**
 * Deterministic PRNG and seed hashing utilities.
 */

/**
 * Generates a pseudo-random number generator function using the Mulberry32 algorithm.
 * Returns values uniformly distributed in [0, 1).
 */
export function createPRNG(seed: number): () => number {
  let s = seed >>> 0;
  return function(): number {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hashes a numeric or string seed into a uint32 integer in [0, 4294967295] using FNV-1a.
 * Numeric strings (e.g. "12345") and numbers (e.g. 12345) produce the same hash value.
 */
export function hashSeed(seed: string | number): number {
  const str = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Generates a random seed integer uniformly distributed in [1, 0xFFFFFFFF].
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF) + 1;
}
