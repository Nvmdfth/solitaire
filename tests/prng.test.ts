import { describe, it, expect } from 'vitest';
import { createPRNG, hashSeed, randomSeed } from '../src/core/PRNG';

describe('PRNG module', () => {
  describe('createPRNG', () => {
    it('produces reproducible sequences given identical seeds', () => {
      const rng1 = createPRNG(12345);
      const rng2 = createPRNG(12345);

      const seq1: number[] = [];
      const seq2: number[] = [];

      for (let i = 0; i < 100; i++) {
        seq1.push(rng1());
        seq2.push(rng2());
      }

      expect(seq1).toEqual(seq2);
    });

    it('diverges when initialized with different seeds', () => {
      const rng1 = createPRNG(12345);
      const rng2 = createPRNG(54321);

      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());

      expect(seq1).not.toEqual(seq2);
    });

    it('generates values within bounds [0, 1)', () => {
      const seeds = [0, 1, 42, 12345, 0x7fffffff, 0xffffffff];
      for (const seed of seeds) {
        const rng = createPRNG(seed);
        for (let i = 0; i < 1000; i++) {
          const val = rng();
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThan(1);
        }
      }
    });
  });

  describe('hashSeed', () => {
    it('returns consistent hash values for numeric strings and integer equivalents', () => {
      expect(hashSeed('12345')).toBe(hashSeed(12345));
      expect(hashSeed('0')).toBe(hashSeed(0));
      expect(hashSeed('4294967295')).toBe(hashSeed(4294967295));
    });

    it('returns distinct uint32 values for different inputs', () => {
      const hash1 = hashSeed('alpha');
      const hash2 = hashSeed('beta');
      expect(hash1).not.toBe(hash2);
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(hash1).toBeLessThanOrEqual(0xffffffff);
      expect(hash2).toBeGreaterThanOrEqual(0);
      expect(hash2).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(hash1)).toBe(true);
      expect(Number.isInteger(hash2)).toBe(true);
    });

    it('produces valid uint32 integer in [0, 4294967295]', () => {
      const inputs = ['', 'test', 'seed-123', 0, 99999999];
      for (const input of inputs) {
        const h = hashSeed(input);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(4294967295);
        expect(Number.isInteger(h)).toBe(true);
      }
    });
  });

  describe('randomSeed', () => {
    it('returns an integer within [1, 0xFFFFFFFF]', () => {
      for (let i = 0; i < 100; i++) {
        const s = randomSeed();
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(0xffffffff);
      }
    });
  });
});
