import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameGenerator } from '../src/core/GameGenerator';
import { KNOWN_WINNABLE_SEEDS, KNOWN_UNWINNABLE_SEEDS } from '../src/core/data/seedFixtures';
import { ISolver, SolverResult } from '../src/core/solver/SolverTypes';

describe('GameGenerator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default catalog and blacklist fixtures', () => {
    const generator = new GameGenerator();
    expect(generator.winnableCatalog).toEqual(KNOWN_WINNABLE_SEEDS);
    for (const seed of KNOWN_UNWINNABLE_SEEDS) {
      expect(generator.isBlacklisted(seed)).toBe(true);
    }
  });

  it('initializes with custom Set for blacklist', () => {
    const customBlacklist = new Set<number>([42, 43]);
    const generator = new GameGenerator(undefined, [100], customBlacklist);
    expect(generator.isBlacklisted(42)).toBe(true);
    expect(generator.isBlacklisted(43)).toBe(true);
    expect(generator.isBlacklisted(44)).toBe(false);
  });

  it('returns a seed not present in unwinnableBlacklist', () => {
    const generator = new GameGenerator();
    for (let i = 0; i < 50; i++) {
      const seed = generator.getWinnableSeed();
      expect(generator.isBlacklisted(seed)).toBe(false);
      expect(generator.winnableCatalog.includes(seed)).toBe(true);
    }
  });

  it('executes catalog picks extremely quickly (< 10ms avg)', () => {
    const generator = new GameGenerator();
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      generator.getWinnableSeed();
    }
    const elapsed = performance.now() - start;
    const avgPerPick = elapsed / 100;
    expect(avgPerPick).toBeLessThan(10);
  });

  it('prevents generation of dynamically blacklisted seeds', () => {
    const customCatalog = [10, 20, 30];
    const generator = new GameGenerator(undefined, customCatalog, []);

    generator.addToBlacklist(20);
    expect(generator.isBlacklisted(20)).toBe(true);
    expect(generator.winnableCatalog).toEqual([10, 30]);

    // Only 10 and 30 should ever be picked
    const picked = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const seed = generator.getWinnableSeed();
      expect(seed).not.toBe(20);
      picked.add(seed);
    }
    expect(Array.from(picked).every(s => s === 10 || s === 30)).toBe(true);
  });

  it('supports addToCatalog and un-blacklisting', () => {
    const generator = new GameGenerator(undefined, [], [999]);
    expect(generator.isBlacklisted(999)).toBe(true);

    generator.addToCatalog(999);
    expect(generator.isBlacklisted(999)).toBe(false);
    expect(generator.winnableCatalog.includes(999)).toBe(true);
    expect(generator.getWinnableSeed()).toBe(999);
  });

  it('honors bypassCatalog option to force fallback generation', () => {
    const generator = new GameGenerator(undefined, [100], []);
    // Even though 100 is in catalog, bypassCatalog=true generates candidate
    const seed = generator.getWinnableSeed(false, true);
    expect(typeof seed).toBe('number');
    expect(generator.isBlacklisted(seed)).toBe(false);
  });

  describe('solver fallback path', () => {
    it('uses solver when catalog is empty and returns winnable seed', () => {
      const mockSolver: ISolver = {
        solve: vi.fn((seed: number): SolverResult => {
          return {
            status: seed === 555 ? 'WINNABLE' : 'UNWINNABLE',
            movesCount: 10,
            visitedStates: 100,
            durationMs: 5
          };
        })
      };

      const generator = new GameGenerator(mockSolver, []);
      vi.spyOn(Math, 'random').mockReturnValue((555 - 0.5) / 0xFFFFFFFF);

      const seed = generator.getWinnableSeed(true);
      expect(seed).toBe(555);
      expect(generator.winnableCatalog.includes(555)).toBe(true);
      expect(mockSolver.solve).toHaveBeenCalledWith(555, { maxStates: 3000, timeoutMs: 50 });
    });

    it('blacklists candidates that solver determines are unwinnable', () => {
      const testedCandidates: number[] = [];
      const mockSolver: ISolver = {
        solve: vi.fn((candidate: number): SolverResult => {
          testedCandidates.push(candidate);
          return {
            status: 'UNWINNABLE',
            movesCount: 0,
            visitedStates: 50,
            durationMs: 2
          };
        })
      };

      const generator = new GameGenerator(mockSolver, []);
      const seed = generator.getWinnableSeed(true);

      // Solver should have been called 5 times (max attempts)
      expect(mockSolver.solve).toHaveBeenCalledTimes(5);
      expect(testedCandidates.length).toBe(5);
      for (const candidate of testedCandidates) {
        expect(generator.isBlacklisted(candidate)).toBe(true);
      }
      // Fallback safe seed returned
      expect(seed).toBeDefined();
      expect(generator.isBlacklisted(seed)).toBe(false);
    });

    it('does not blacklist candidates that TIMEOUT', () => {
      const timedOutCandidates: number[] = [];
      const mockSolver: ISolver = {
        solve: vi.fn((candidate: number): SolverResult => {
          timedOutCandidates.push(candidate);
          return {
            status: 'TIMEOUT',
            movesCount: 0,
            visitedStates: 3000,
            durationMs: 50
          };
        })
      };

      const generator = new GameGenerator(mockSolver, []);
      generator.getWinnableSeed(true);

      expect(mockSolver.solve).toHaveBeenCalledTimes(5);
      for (const candidate of timedOutCandidates) {
        expect(generator.isBlacklisted(candidate)).toBe(false);
      }
    });

    it('falls back to random candidate without solver when fallbackToSolver is false', () => {
      const generator = new GameGenerator(undefined, [], [1, 2, 3]);
      const seed = generator.getWinnableSeed(false);

      expect(typeof seed).toBe('number');
      expect(generator.isBlacklisted(seed)).toBe(false);
    });

    it('supports setter and getter for solver', () => {
      const generator = new GameGenerator();
      expect(generator.getSolver()).toBeDefined();

      const dummySolver: ISolver = {
        solve: vi.fn((): SolverResult => ({
          status: 'WINNABLE',
          movesCount: 0,
          visitedStates: 0,
          durationMs: 0
        }))
      };

      generator.setSolver(dummySolver);
      expect(generator.getSolver()).toBe(dummySolver);
    });
  });
});
