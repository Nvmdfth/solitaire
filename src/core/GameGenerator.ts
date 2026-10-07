import { randomSeed } from './PRNG';
import { KNOWN_WINNABLE_SEEDS, KNOWN_UNWINNABLE_SEEDS } from './data/seedFixtures';
import { ISolver } from './solver/SolverTypes';
import { KlondikeSolver } from './solver/KlondikeSolver';

export class GameGenerator {
  public winnableCatalog: number[];
  public unwinnableBlacklist: Set<number>;
  private solver?: ISolver;

  constructor(
    solver?: ISolver,
    initialCatalog?: number[],
    initialBlacklist?: number[] | Set<number>
  ) {
    this.solver = solver ?? new KlondikeSolver();
    this.winnableCatalog = initialCatalog ? [...initialCatalog] : [...KNOWN_WINNABLE_SEEDS];
    this.unwinnableBlacklist = initialBlacklist
      ? new Set(initialBlacklist)
      : new Set(KNOWN_UNWINNABLE_SEEDS);
  }

  /**
   * Sets the solver instance used for seed verification fallback.
   */
  public setSolver(solver: ISolver): void {
    this.solver = solver;
  }

  /**
   * Returns current solver instance if configured.
   */
  public getSolver(): ISolver | undefined {
    return this.solver;
  }

  /**
   * Checks whether a seed is present in the unwinnable blacklist.
   */
  public isBlacklisted(seed: number): boolean {
    return this.unwinnableBlacklist.has(seed);
  }

  /**
   * Adds a seed to the unwinnable blacklist and removes it from the winnable catalog.
   */
  public addToBlacklist(seed: number): void {
    this.unwinnableBlacklist.add(seed);
    this.winnableCatalog = this.winnableCatalog.filter(s => s !== seed);
  }

  /**
   * Adds a verified winnable seed to the catalog.
   */
  public addToCatalog(seed: number): void {
    if (!this.winnableCatalog.includes(seed)) {
      this.winnableCatalog.push(seed);
    }
    this.unwinnableBlacklist.delete(seed);
  }

  /**
   * Retrieves a winnable seed.
   * 1. Picks a random seed from winnableCatalog if available.
   * 2. If catalog is empty or bypassed:
   *    - If fallbackToSolver is true and solver is provided, runs solver up to 5 attempts.
   *    - Otherwise, generates a random candidate seed not in unwinnableBlacklist.
   */
  public getWinnableSeed(fallbackToSolver: boolean = true, bypassCatalog: boolean = false): number {
    if (!bypassCatalog) {
      const available = this.winnableCatalog.filter(s => !this.isBlacklisted(s));
      if (available.length > 0) {
        const index = Math.floor(Math.random() * available.length);
        return available[index];
      }
    }

    // Catalog empty, exhausted, or bypassed
    if (fallbackToSolver && this.solver) {
      const MAX_SOLVER_ATTEMPTS = 5;
      let lastCandidate: number | null = null;

      for (let attempt = 0; attempt < MAX_SOLVER_ATTEMPTS; attempt++) {
        let candidate = randomSeed();
        let retries = 0;
        while (this.isBlacklisted(candidate) && retries < 100) {
          candidate = randomSeed();
          retries++;
        }

        lastCandidate = candidate;
        if (this.isBlacklisted(candidate)) {
          continue;
        }

        try {
          const result = this.solver.solve(candidate, { maxStates: 3000, timeoutMs: 50 });
          if (result && result.status === 'WINNABLE') {
            this.addToCatalog(candidate);
            return candidate;
          } else if (result && result.status === 'UNWINNABLE') {
            this.addToBlacklist(candidate);
          }
          // On TIMEOUT or indeterminate result, retry next attempt without blacklisting
        } catch {
          // If solver errors, skip without blacklisting
        }
      }

      // Exhausted attempts: return verified safe seed
      const safeSeed = KNOWN_WINNABLE_SEEDS.find(s => !this.isBlacklisted(s)) ?? 100;
      return safeSeed;
    }

    // Solver not available or fallback disabled: generate candidate not in blacklist
    let candidate = randomSeed();
    let retries = 0;
    while (this.isBlacklisted(candidate) && retries < 1000) {
      candidate = randomSeed();
      retries++;
    }

    if (!this.isBlacklisted(candidate)) {
      return candidate;
    }

    return KNOWN_WINNABLE_SEEDS.find(s => !this.isBlacklisted(s)) ?? 100;
  }
}
