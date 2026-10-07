# Seeded Random Game Generation & Winnable Seed Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement deterministic seedable PRNG game generation for Klondike Solitaire, build a Thoughtful Klondike solver to determine game solvability, identify non-winnable seeds via automated testing, and provide a filtering mechanism to guarantee winnable game generation while supporting custom and shared seeds.

**Confirmed Design Decisions:**
1. **Winnable Generation**: Hybrid approach (precomputed verified winnable seed catalog for instant mobile deals <5ms, with runtime solver fallback and scanner script).
2. **Draw Mode Scope**: Draw 1 only (standard Klondike, ~82% solvable rate).
3. **Test Scope**: Curated fixtures of verified winnable and provably unwinnable seeds in Vitest (<1s total test suite runtime), plus a standalone script for batch seed discovery.
4. **UI/UX**: Full UI (HUD badge showing seed number, tap to copy share link `?seed=...`, and custom seed input modal).

**Architecture:**
- **PRNG Engine (`src/core/PRNG.ts`)**: Fast, lightweight Mulberry32 32-bit generator with FNV-1a string/number hash conversion.
- **Core Seeding (`src/core/Deck.ts`, `src/core/GameState.ts`)**: Seeded Fisher-Yates shuffle, storing `currentSeed` on `GameState` for replayability and seed querying.
- **Thoughtful Solitaire Solver (`src/core/solver/KlondikeSolver.ts`)**: Headless search engine utilizing Priority A*, canonical state transposition tables, dominance pruning (safe foundation plays), and stock cycle detection.
- **Seed Catalog & Generator (`src/core/GameGenerator.ts`)**: High-performance seed dispenser pairing a precomputed, verified winnable seed pool with a blacklist filter and bounded solver fallback.
- **UI & Seed Control (`src/main.ts`, `src/ui/HUD.ts`)**: Display active seed badge in HUD, URL query param hydration (`?seed=...`), clipboard share link, and custom seed modal.
- **Seed Discovery Script (`scripts/find_unwinnable_seeds.ts`)**: Node CLI script for batch analysis of seed ranges.

**Tech Stack:** TypeScript, Vitest, Three.js, Vite.

---

## File Structure & Responsibilities

| File | Responsibility |
|---|---|
| `src/core/PRNG.ts` | Mulberry32 algorithm, seed normalization/hashing, deterministic sequence generator. |
| `src/core/Deck.ts` | Updated `shuffleDeck` accepting custom RNG function or seed. |
| `src/core/GameState.ts` | Stores `currentSeed`, supports `{ seed?: number \| string }` in `initGame`. |
| `src/core/solver/SolverTypes.ts` | Data structures for solver: compact state, move types, search stats, solve status. |
| `src/core/solver/KlondikeSolver.ts` | Priority search solver with safe moves, transposition table, cycle detection for Draw 1. |
| `src/core/data/seedFixtures.ts` | Curated lists of verified winnable seeds and proven unwinnable seeds. |
| `src/core/GameGenerator.ts` | Generator orchestrating winnable deal generation, blacklist rejection, and seed pools. |
| `src/ui/HUD.ts` | HUD header seed badge, seed click handler, custom seed modal. |
| `src/ui/styles.css` | Styles for seed badge, seed modal, and copy toast notifications. |
| `src/main.ts` | Hydrates seed from URL params, handles HUD seed events, wires restart with same seed. |
| `scripts/find_unwinnable_seeds.ts` | Node CLI script for batch analysis of seed ranges. |
| `tests/prng.test.ts` | Unit tests for PRNG reproducibility, uniformity, and hashing. |
| `tests/solver.test.ts` | Unit tests verifying solver correctly solves winnable seeds and detects deadlocks/unwinnable seeds. |
| `tests/gamegenerator.test.ts` | Tests for seed generation, blacklist filtering, and winnable guarantees. |

---

## Review Focus & Critical Invariants

1. **Determinism**: The same seed must ALWAYS produce the exact same 52-card deal sequence across all browsers and platforms.
2. **Zero Mobile Deal Latency**: Standard "New Game" deal must execute in < 5ms without blocking Three.js rendering or animating loops.
3. **Solver Soundness**: Solver must never report `WINNABLE` unless a valid, legal sequence of moves clears all 52 cards to foundations.
4. **Backward Compatibility**: `initGame()` and `shuffleDeck()` must maintain full backward compatibility with existing tests and calls.
5. **Draw 1 Rules**: Solver operates on Klondike Draw 1 rules with full thoughtful knowledge of dealt stock and face-down tableau cards.

---

### Task 1: Deterministic PRNG Engine
`DEPENDS_ON: []`

**Files:**
- Create: `src/core/PRNG.ts`
- Create: `tests/prng.test.ts`

**Details:**
- Implement `createPRNG(seed: number): () => number` using Mulberry32:
  ```ts
  export function createPRNG(seed: number): () => number {
    let s = seed >>> 0;
    return function(): number {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  ```
- Implement `hashSeed(seed: string | number): number` converting numeric or string seeds into uint32 `[0, 4294967295]` using FNV-1a.
- Implement `randomSeed(): number` returning a uniform random integer between 1 and `0xFFFFFFFF`.
- In `tests/prng.test.ts`:
  - Test reproducibility: 100 sequential calls from `createPRNG(12345)` match identical calls from a second generator with seed `12345`.
  - Test divergence: different seeds produce different outputs.
  - Test bounds: all generated values satisfy `0 <= v < 1`.
  - Test `hashSeed`: numeric strings `"12345"` vs integer `12345` return consistent hash values.

**Verification:**
Run `npx vitest run tests/prng.test.ts` — all tests pass.

---

### Task 2: Deck Shuffling & GameState Seeding Integration
`DEPENDS_ON: [Task 1]`

**Files:**
- Modify: `src/core/Deck.ts`
- Modify: `src/core/GameState.ts`
- Modify: `tests/deck.test.ts`
- Modify: `tests/gamestate.test.ts`

**Details:**
- In `src/core/Deck.ts`:
  - Update `shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[]` to accept an optional RNG function.
  - Preserve modern Fisher-Yates algorithm using `rng()`.
- In `src/core/GameState.ts`:
  - Add `public currentSeed: number | null = null;`
  - Update `initGame` signature:
    ```ts
    public initGame(
      drawMode: 1 | 3 = 1,
      optionsOrDeck?: { seed?: number | string; customDeck?: Card[] } | Card[]
    ): void
    ```
  - Parse options:
    - If `Array.isArray(optionsOrDeck)`: treat as `customDeck`, set `this.currentSeed = null`.
    - If `optionsOrDeck && 'customDeck' in optionsOrDeck`: use `customDeck`.
    - If `optionsOrDeck && 'seed' in optionsOrDeck && optionsOrDeck.seed !== undefined`: hash seed with `hashSeed()`, initialize PRNG, and set `this.currentSeed = numericSeed`.
    - Else (no seed provided): call `randomSeed()`, initialize PRNG, and set `this.currentSeed = generatedSeed`.
  - Use seeded PRNG for `shuffleDeck(createDeck(), rng)`.
  - Add getter `getSeed(): number | null { return this.currentSeed; }`.
- In `tests/deck.test.ts`:
  - Verify `shuffleDeck` with identical PRNG produces identical card sequences.
  - Verify card integrity (52 unique cards preserved).
- In `tests/gamestate.test.ts`:
  - Verify initializing with same seed deals identical tableau and stock cards.
  - Verify `currentSeed` is correctly set and matches seed argument.
  - Verify backwards compatibility: calling `initGame(1)` sets a valid numeric seed; passing custom deck preserves custom deck.

**Verification:**
Run `npx vitest run tests/deck.test.ts tests/gamestate.test.ts` — all tests pass.

---

### Task 3: Thoughtful Klondike Solver Engine
`DEPENDS_ON: [Task 2]`

**Files:**
- Create: `src/core/solver/SolverTypes.ts`
- Create: `src/core/solver/KlondikeSolver.ts`

**Details:**
- In `SolverTypes.ts`:
  - Define `SolverStatus = 'WINNABLE' | 'UNWINNABLE' | 'TIMEOUT'`.
  - Define `SolverMove`: `{ type: 'tableau_to_foundation' | 'waste_to_foundation' | 'tableau_to_tableau' | 'waste_to_tableau' | 'draw_stock' | 'recycle_waste'; fromCol?: number; toCol?: number; foundationIndex?: number; cardId: string; count?: number; }`.
  - Define `SolverResult`: `{ status: SolverStatus; movesCount: number; visitedStates: number; durationMs: number; solution?: SolverMove[]; }`.
  - Define `SolverOptions`: `{ maxStates?: number; timeoutMs?: number; }`.
- In `KlondikeSolver.ts`:
  - Implement class `KlondikeSolver`:
    - `public solve(gameStateOrSeed: GameState | number, options?: SolverOptions): SolverResult`
  - Compact state representation for hashing:
    - Foundation levels: `f: [h, d, c, s]` (top rank of each suit 0..13).
    - Tableau columns: array of strings encoding face-down count + face-up card labels.
    - Stock & Waste: string encoding remaining stock and waste cards.
    - Canonical state string `key = foundations + '|' + tableau.sort() + '|' + stock + '|' + waste`. (Sorting empty/equivalent tableau columns prunes symmetric permutations).
  - Search Logic (Priority A* / Best-First):
    - Priority queue based on heuristic:
      `score = (foundationsTotal * 120) + (faceUpCardsCount * 12) + (emptyColumnsWithKings * 8) - (hiddenCardsCount * 10)`.
    - Dominance Pruning (Strict Safe Foundation Moves):
      - Moving Ace or 2 to Foundation is unconditionally executed (does not branch).
      - Moving rank `R` to Foundation is safe if both foundations of the opposite color have rank `>= R - 1`.
    - Stock Cycle Pruning:
      - Track whether any board state modification occurred during a complete pass of the stock. If a full cycle completes with 0 tableau or foundation moves, terminate that branch.
    - Bounds: default `maxStates = 10,000`, `timeoutMs = 250ms`.

**Verification:**
Run `npx tsc --noEmit` — no type errors.

---

### Task 4: Seed Fixtures & Solver Test Suite
`DEPENDS_ON: [Task 3]`

**Files:**
- Create: `src/core/data/seedFixtures.ts`
- Create: `tests/solver.test.ts`

**Details:**
- In `src/core/data/seedFixtures.ts`:
  - Export `KNOWN_WINNABLE_SEEDS: number[]` (curated verified seeds that solve in < 1,500 states, e.g. `[100, 105, 112, 118, 125, 142]`).
  - Export `KNOWN_UNWINNABLE_SEEDS: number[]` (curated seeds that deadlock early or completely exhaust search space, e.g. early deadlocks where cards are mutually blocked).
- In `tests/solver.test.ts`:
  - Test 1: Solves known winnable seeds and asserts `status === 'WINNABLE'`, `movesCount > 0`, and solution is non-empty.
  - Test 2: Identifies known unwinnable seeds and asserts `status === 'UNWINNABLE'`.
  - Test 3: Solver respects `maxStates` limit and returns `TIMEOUT` when budget is exceeded.
  - Test 4: Solver is deterministic: running `solve(seed)` twice returns identical `status`, `movesCount`, and visited states.

**Verification:**
Run `npx vitest run tests/solver.test.ts` — all tests pass in < 1.0s.

---

### Task 5: Winnable Game Generator & Seed Exclusion Filter
`DEPENDS_ON: [Task 4]`

**Files:**
- Create: `src/core/GameGenerator.ts`
- Create: `tests/gamegenerator.test.ts`

**Details:**
- In `src/core/GameGenerator.ts`:
  - Class `GameGenerator`:
    - Holds `winnableCatalog: number[]` initialized with fixtures and pre-verified seeds.
    - Holds `unwinnableBlacklist: Set<number>` initialized with known unwinnable seeds.
    - `getWinnableSeed(fallbackToSolver: boolean = true): number`:
      - First, picks a random seed from `winnableCatalog`.
      - If catalog is bypassed or empty, generates candidate seed via `randomSeed()`. If candidate is in `unwinnableBlacklist`, rejects and retries.
      - If `fallbackToSolver` is true, runs `solver.solve(seed, { maxStates: 3000, timeoutMs: 50 })`. If `WINNABLE`, returns it; else adds to blacklist and retries up to 5 attempts.
    - `isBlacklisted(seed: number): boolean`
    - `addToBlacklist(seed: number): void`
    - `addToCatalog(seed: number): void`
- In `tests/gamegenerator.test.ts`:
  - Verify `getWinnableSeed()` always returns a seed not present in `unwinnableBlacklist`.
  - Verify fast execution (< 5ms for catalog pick).
  - Verify custom blacklisting prevents generation of blacklisted seeds.

**Verification:**
Run `npx vitest run tests/gamegenerator.test.ts` — all tests pass.

---

### Task 6: UI HUD Integration, Seed Modal & URL Share Link
`DEPENDS_ON: [Task 2, Task 5]`

**Files:**
- Modify: `src/ui/HUD.ts`
- Modify: `src/ui/styles.css`
- Modify: `src/main.ts`

**Details:**
- In `src/ui/HUD.ts`:
  - Add Seed Badge to header:
    `<button class="hud-pill-btn" id="hud-seed-btn" title="Game Seed (Click to share/change)">#<span id="hud-seed-val">---</span></button>`
  - Add `updateSeed(seed: number | string): void` method.
  - Add modal markup for Seed Dialog:
    - Input field for custom seed (number or text).
    - "Play Seed" button.
    - "Copy Share Link" button.
    - "New Winnable Game" button.
    - Close button.
  - Extend `HUDCallbacks`:
    - `onSelectSeed: (seed: number | string) => void;`
    - `onNewWinnableGame: () => void;`
- In `src/ui/styles.css`:
  - Add styles for `.hud-seed-modal`, `.hud-modal-overlay`, `.hud-input`, and toast notifications.
- In `src/main.ts`:
  - On startup: check `window.location.search` for `?seed=...`. If present, pass seed to `initGame()`.
  - Wire `onRestart`: restarts with current seed (`this.game.currentSeed`).
  - Wire `onNewWinnableGame`: gets winnable seed from `GameGenerator` and starts game.
  - Wire `onSelectSeed`: starts game with chosen seed and updates URL without page reload (`history.replaceState`).
  - Wire seed badge click: copies URL with `?seed=${this.game.currentSeed}` to clipboard and displays toast.

**Verification:**
Run `npm run build` and run `npx vitest run` to ensure no regressions.

---

### Task 7: Standalone Seed Discovery Script
`DEPENDS_ON: [Task 3, Task 4]`

**Files:**
- Create: `scripts/find_unwinnable_seeds.ts`
- Modify: `package.json` (add script `"seeds:scan": "tsx scripts/find_unwinnable_seeds.ts"`)

**Details:**
- Implement CLI tool accepting arguments:
  - `--start <number>` (start seed, default 1)
  - `--count <number>` (number of seeds to evaluate, default 50)
  - `--output <path>` (optional path to append/save JSON output)
- For each seed:
  - Deal game using `initGame(1, { seed })`.
  - Run `KlondikeSolver.solve()`.
  - Log progress and print summary table:
    `Total: X | Winnable: Y (Y%) | Unwinnable: Z (Z%) | Timed Out: W (W%) | Avg Duration: D ms`.
  - Save results to JSON file when `--output` is specified.

**Verification:**
Run `npx tsx scripts/find_unwinnable_seeds.ts --start 100 --count 10` — script runs and outputs summary table.

---

### Task 8: Full Test Suite Verification & Sanity Check
`DEPENDS_ON: [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]`

**Files:**
- Run full Vitest suite: `npx vitest run`
- Run TypeScript check: `npx tsc --noEmit`
- Run production build: `npm run build`
- Run Claude sanity check:
  `claude -p "Please double-check the seeded PRNG and Klondike solver implementation in src/core/PRNG.ts, src/core/solver/KlondikeSolver.ts, and src/core/GameGenerator.ts for edge cases, determinism, and correctness."`

**Verification:**
All tests pass, zero TypeScript errors, build succeeds, and Claude sanity review gives clean approval.
