import { describe, it, expect } from 'vitest';
import { KlondikeSolver } from '../src/core/solver/KlondikeSolver';
import { KNOWN_WINNABLE_SEEDS, KNOWN_UNWINNABLE_SEEDS } from '../src/core/data/seedFixtures';
import { GameState } from '../src/core/GameState';

describe('KlondikeSolver', () => {
  const solver = new KlondikeSolver();

  it('solves known winnable seeds', () => {
    const testSeeds = KNOWN_WINNABLE_SEEDS.slice(0, 4);
    for (const seed of testSeeds) {
      const result = solver.solve(seed, { maxStates: 3000, timeoutMs: 1000 });
      expect(result.status).toBe('WINNABLE');
      expect(result.movesCount).toBeGreaterThan(0);
      expect(result.solution).toBeDefined();
      expect(result.solution?.length).toBe(result.movesCount);
    }
  });

  it('identifies known unwinnable seeds', () => {
    const testSeeds = KNOWN_UNWINNABLE_SEEDS.slice(0, 4);
    for (const seed of testSeeds) {
      const result = solver.solve(seed, { maxStates: 3000, timeoutMs: 1000 });
      expect(result.status).toBe('UNWINNABLE');
      expect(result.movesCount).toBe(0);
      expect(result.solution).toBeUndefined();
    }
  });

  it('triggers TIMEOUT when maxStates budget is exceeded', () => {
    const result = solver.solve(KNOWN_WINNABLE_SEEDS[0], { maxStates: 10, timeoutMs: 5000 });
    expect(result.status).toBe('TIMEOUT');
    expect(result.visitedStates).toBe(10);
    expect(result.solution).toBeUndefined();
  });

  it('is deterministic: running solve(seed) twice returns identical status and movesCount', () => {
    const seed = KNOWN_WINNABLE_SEEDS[0];
    const run1 = solver.solve(seed, { maxStates: 3000, timeoutMs: 1000 });
    const run2 = solver.solve(seed, { maxStates: 3000, timeoutMs: 1000 });

    expect(run1.status).toBe(run2.status);
    expect(run1.movesCount).toBe(run2.movesCount);
    expect(run1.visitedStates).toBe(run2.visitedStates);
    expect(run1.solution).toEqual(run2.solution);
  });

  it('solves when passed a GameState instance directly', () => {
    const game = new GameState();
    game.initGame(1, { seed: KNOWN_WINNABLE_SEEDS[0] });
    const result = solver.solve(game, { maxStates: 3000, timeoutMs: 1000 });
    expect(result.status).toBe('WINNABLE');
    expect(result.movesCount).toBeGreaterThan(0);
  });
});
