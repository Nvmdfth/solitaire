#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { KlondikeSolver } from '../src/core/solver/KlondikeSolver';
import { SolverResult } from '../src/core/solver/SolverTypes';
import { KNOWN_WINNABLE_SEEDS, KNOWN_UNWINNABLE_SEEDS } from '../src/core/data/seedFixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedEvaluation {
  seed: number;
  status: 'WINNABLE' | 'UNWINNABLE' | 'TIMEOUT';
  movesCount: number;
  visitedStates: number;
  durationMs: number;
}

interface CliOptions {
  start: number;
  count: number;
  output?: string;
  maxStates: number;
  timeoutMs: number;
  updateFixtures: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let start = 1;
  let count = 50;
  let output: string | undefined;
  let maxStates = 5000;
  let timeoutMs = 2000;
  let updateFixtures = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed) && parsed >= 0) start = parsed;
    } else if (args[i] === '--count' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed) && parsed > 0) count = parsed;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      output = args[++i];
    } else if (args[i] === '--max-states' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed) && parsed > 0) maxStates = parsed;
    } else if (args[i] === '--timeout' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed) && parsed > 0) timeoutMs = parsed;
    } else if (args[i] === '--update-fixtures') {
      updateFixtures = true;
    }
  }

  return { start, count, output, maxStates, timeoutMs, updateFixtures };
}

async function run(): Promise<void> {
  const { start, count, output, maxStates, timeoutMs, updateFixtures } = parseArgs();
  const solver = new KlondikeSolver();

  console.log(`Scanning seeds ${start} to ${start + count - 1} (maxStates=${maxStates}, timeoutMs=${timeoutMs})...`);

  const results: SeedEvaluation[] = [];
  let winnableCount = 0;
  let unwinnableCount = 0;
  let timeoutCount = 0;
  let totalDurationMs = 0;

  for (let i = 0; i < count; i++) {
    const seed = start + i;
    const res: SolverResult = solver.solve(seed, { maxStates, timeoutMs });

    results.push({
      seed,
      status: res.status,
      movesCount: res.movesCount,
      visitedStates: res.visitedStates,
      durationMs: res.durationMs
    });

    totalDurationMs += res.durationMs;

    if (res.status === 'WINNABLE') {
      winnableCount++;
    } else if (res.status === 'UNWINNABLE') {
      unwinnableCount++;
    } else {
      timeoutCount++;
    }

    if ((i + 1) % 10 === 0 || i + 1 === count) {
      process.stdout.write(`Evaluated ${i + 1}/${count} seeds...\r`);
    }
  }
  process.stdout.write('\n');

  const avgDuration = count > 0 ? (totalDurationMs / count).toFixed(1) : '0';
  const winnablePct = count > 0 ? ((winnableCount / count) * 100).toFixed(1) : '0';
  const unwinnablePct = count > 0 ? ((unwinnableCount / count) * 100).toFixed(1) : '0';
  const timeoutPct = count > 0 ? ((timeoutCount / count) * 100).toFixed(1) : '0';

  console.log('\n================== SEED SCAN SUMMARY ==================');
  console.log(`Total: ${count} | Winnable: ${winnableCount} (${winnablePct}%) | Unwinnable: ${unwinnableCount} (${unwinnablePct}%) | Timed Out: ${timeoutCount} (${timeoutPct}%) | Avg Duration: ${avgDuration} ms`);
  console.log('========================================================\n');

  if (output) {
    const resolvedPath = path.resolve(process.cwd(), output);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    const payload = {
      summary: {
        total: count,
        winnable: winnableCount,
        winnablePercent: Number(winnablePct),
        unwinnable: unwinnableCount,
        unwinnablePercent: Number(unwinnablePct),
        timedOut: timeoutCount,
        timeoutPercent: Number(timeoutPct),
        avgDurationMs: Number(avgDuration)
      },
      results
    };
    fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`Saved evaluation details to ${resolvedPath}`);
  }

  if (updateFixtures) {
    const fixturesPath = path.resolve(__dirname, '../src/core/data/seedFixtures.ts');
    const existingWinnable = new Set<number>(KNOWN_WINNABLE_SEEDS);
    const existingUnwinnable = new Set<number>(KNOWN_UNWINNABLE_SEEDS);

    let newlyAddedWinnable = 0;
    let newlyAddedUnwinnable = 0;

    for (const res of results) {
      if (res.status === 'WINNABLE') {
        existingUnwinnable.delete(res.seed);
        if (!existingWinnable.has(res.seed)) {
          existingWinnable.add(res.seed);
          newlyAddedWinnable++;
        }
      } else if (res.status === 'UNWINNABLE') {
        existingWinnable.delete(res.seed);
        if (!existingUnwinnable.has(res.seed)) {
          existingUnwinnable.add(res.seed);
          newlyAddedUnwinnable++;
        }
      }
    }

    const sortedWinnable = Array.from(existingWinnable).sort((a, b) => a - b);
    const sortedUnwinnable = Array.from(existingUnwinnable).sort((a, b) => a - b);

    const fixturesContent = `/**
 * Known seed fixtures for Klondike Solitaire testing and catalog generation.
 */

export const KNOWN_WINNABLE_SEEDS: number[] = [
  ${sortedWinnable.join(',\n  ')}
];

export const KNOWN_UNWINNABLE_SEEDS: number[] = [
  ${sortedUnwinnable.join(',\n  ')}
];
`;

    fs.writeFileSync(fixturesPath, fixturesContent, 'utf-8');
    console.log(`Updated fixtures in ${fixturesPath}:`);
    console.log(`  - Winnable seeds: +${newlyAddedWinnable} (total: ${sortedWinnable.length})`);
    console.log(`  - Unwinnable seeds: +${newlyAddedUnwinnable} (total: ${sortedUnwinnable.length})`);
  }
}

run().catch(err => {
  console.error('Seed scanner failed:', err);
  process.exit(1);
});
