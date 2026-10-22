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
  flushInterval: number;
  yieldMs: number;
  quiet: boolean;
  resume: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let start = 1;
  let count = 50;
  let output: string | undefined;
  let maxStates = 5000;
  let timeoutMs = 2000;
  let updateFixtures = false;
  let flushInterval = 50;
  let yieldMs = 0;
  let quiet = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--start' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed < 0) {
        console.error(`Error: Invalid value for --start: ${args[i]}`);
        process.exit(1);
      }
      start = parsed;
    } else if (arg === '--count' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error(`Error: Invalid value for --count: ${args[i]}`);
        process.exit(1);
      }
      count = parsed;
    } else if (arg === '--output' && i + 1 < args.length) {
      output = args[++i];
    } else if ((arg === '--max-states' || arg === '--maxStates') && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error(`Error: Invalid value for --max-states: ${args[i]}`);
        process.exit(1);
      }
      maxStates = parsed;
    } else if ((arg === '--timeout' || arg === '--timeout-ms' || arg === '--timeoutMs') && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error(`Error: Invalid value for --timeout: ${args[i]}`);
        process.exit(1);
      }
      timeoutMs = parsed;
    } else if ((arg === '--flush-interval' || arg === '--flushInterval') && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error(`Error: Invalid value for --flush-interval: ${args[i]}`);
        process.exit(1);
      }
      flushInterval = parsed;
    } else if ((arg === '--yield-ms' || arg === '--yieldMs') && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed < 0) {
        console.error(`Error: Invalid value for --yield-ms: ${args[i]}`);
        process.exit(1);
      }
      yieldMs = parsed;
    } else if (arg === '--quiet' || arg === '--silent') {
      quiet = true;
    } else if (arg === '--resume') {
      resume = true;
    } else if (arg === '--update-fixtures' || arg === '--updateFixtures') {
      updateFixtures = true;
    } else {
      console.error(`Error: Unrecognized or malformed argument "${arg}".`);
      console.error('Usage: tsx scripts/find_unwinnable_seeds.ts [--start <n>] [--count <n>] [--max-states <n>] [--timeout <ms>] [--flush-interval <n>] [--yield-ms <n>] [--resume] [--quiet] [--update-fixtures] [--output <path>]');
      process.exit(1);
    }
  }

  return { start, count, output, maxStates, timeoutMs, updateFixtures, flushInterval, yieldMs, quiet, resume };
}

async function run(): Promise<void> {
  const options = parseArgs();
  let { start, count, output, maxStates, timeoutMs, updateFixtures, flushInterval, yieldMs, quiet, resume } = options;
  // Progress is always recorded against the original range so repeated resumes stay anchored
  const originalStart = start;
  const originalCount = count;
  const solver = new KlondikeSolver();

  const results: SeedEvaluation[] = [];
  const winnableSeeds = new Set<number>(KNOWN_WINNABLE_SEEDS);
  const unwinnableSeeds = new Set<number>(KNOWN_UNWINNABLE_SEEDS);

  let winnableCount = 0;
  let unwinnableCount = 0;
  let timeoutCount = 0;
  let totalDurationMs = 0;
  let previousEvaluatedCount = 0;

  // If output file already exists, pre-load existing winnable and unwinnable sets
  let resolvedOutputPath: string | undefined;
  if (output) {
    resolvedOutputPath = path.resolve(process.cwd(), output);
    if (fs.existsSync(resolvedOutputPath)) {
      try {
        const raw = fs.readFileSync(resolvedOutputPath, 'utf-8');
        const existingData = JSON.parse(raw);
        if (Array.isArray(existingData.winnable)) {
          for (const s of existingData.winnable) {
            if (typeof s === 'number' && Number.isInteger(s)) winnableSeeds.add(s);
          }
        }
        if (Array.isArray(existingData.unwinnable)) {
          for (const s of existingData.unwinnable) {
            if (typeof s === 'number' && Number.isInteger(s)) unwinnableSeeds.add(s);
          }
        }
        if (
          resume &&
          existingData.progress &&
          typeof existingData.progress.current === 'number' &&
          existingData.progress.start === originalStart
        ) {
          previousEvaluatedCount = Math.min(Math.max(0, existingData.progress.current), originalCount);
          winnableCount = existingData.progress.winnable || 0;
          unwinnableCount = existingData.progress.unwinnable || 0;
          timeoutCount = existingData.progress.timedOut || 0;
          const advance = previousEvaluatedCount;
          start = start + advance;
          count = Math.max(0, count - advance);
          if (!quiet) {
            console.log(`Resuming scan at seed ${start} (${count} remaining of original target)...`);
          }
        }
      } catch {
        // Ignore corrupt existing file
      }
    }
  }

  if (!quiet && count > 0) {
    console.log(`Scanning seeds ${start} to ${start + count - 1} (maxStates=${maxStates}, timeoutMs=${timeoutMs}, yieldMs=${yieldMs})...`);
  }

  const flushOutput = () => {
    if (!resolvedOutputPath) return;
    try {
      fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
      const evaluated = previousEvaluatedCount + results.length;
      const avgDuration = results.length > 0 ? (totalDurationMs / results.length).toFixed(1) : '0';
      const winnablePct = evaluated > 0 ? ((winnableCount / evaluated) * 100).toFixed(1) : '0';
      const unwinnablePct = evaluated > 0 ? ((unwinnableCount / evaluated) * 100).toFixed(1) : '0';
      const timeoutPct = evaluated > 0 ? ((timeoutCount / evaluated) * 100).toFixed(1) : '0';

      const payload = {
        lastUpdated: new Date().toISOString(),
        progress: {
          start: originalStart,
          current: evaluated,
          total: originalCount,
          winnable: winnableCount,
          winnablePercent: Number(winnablePct),
          unwinnable: unwinnableCount,
          unwinnablePercent: Number(unwinnablePct),
          timedOut: timeoutCount,
          timeoutPercent: Number(timeoutPct),
          avgDurationMs: Number(avgDuration)
        },
        winnable: Array.from(winnableSeeds).sort((a, b) => a - b),
        unwinnable: Array.from(unwinnableSeeds).sort((a, b) => a - b)
      };

      const tmpPath = `${resolvedOutputPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tmpPath, resolvedOutputPath);
    } catch (err) {
      if (!quiet) {
        console.error('Failed to flush seed output:', err);
      }
    }
  };

  const handleExit = () => {
    flushOutput();
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // Initial flush to make seeds.json immediately accessible
  flushOutput();

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
      winnableSeeds.add(seed);
      unwinnableSeeds.delete(seed);
    } else if (res.status === 'UNWINNABLE') {
      unwinnableCount++;
      unwinnableSeeds.add(seed);
      winnableSeeds.delete(seed);
    } else {
      timeoutCount++;
    }

    if (!quiet && ((i + 1) % 10 === 0 || i + 1 === count)) {
      process.stdout.write(`Evaluated ${i + 1}/${count} seeds...\r`);
    }

    if ((i + 1) % flushInterval === 0 || i + 1 === count) {
      flushOutput();
    }

    if (yieldMs > 0 && i + 1 < count) {
      await new Promise(resolve => setTimeout(resolve, yieldMs));
    }
  }

  if (!quiet) {
    process.stdout.write('\n');
    const evaluated = previousEvaluatedCount + results.length;
    const avgDuration = results.length > 0 ? (totalDurationMs / results.length).toFixed(1) : '0';
    const winnablePct = evaluated > 0 ? ((winnableCount / evaluated) * 100).toFixed(1) : '0';
    const unwinnablePct = evaluated > 0 ? ((unwinnableCount / evaluated) * 100).toFixed(1) : '0';
    const timeoutPct = evaluated > 0 ? ((timeoutCount / evaluated) * 100).toFixed(1) : '0';

    console.log('\n================== SEED SCAN SUMMARY ==================');
    console.log(`Total: ${evaluated} | Winnable: ${winnableCount} (${winnablePct}%) | Unwinnable: ${unwinnableCount} (${unwinnablePct}%) | Timed Out: ${timeoutCount} (${timeoutPct}%) | Avg Duration: ${avgDuration} ms`);
    console.log('========================================================\n');
  }

  if (resolvedOutputPath && !quiet) {
    console.log(`Saved evaluation details to ${resolvedOutputPath}`);
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
    if (!quiet) {
      console.log(`Updated fixtures in ${fixturesPath}:`);
      console.log(`  - Winnable seeds: +${newlyAddedWinnable} (total: ${sortedWinnable.length})`);
      console.log(`  - Unwinnable seeds: +${newlyAddedUnwinnable} (total: ${sortedUnwinnable.length})`);
    }
  }
}

run().catch(err => {
  console.error('Seed scanner failed:', err);
  process.exit(1);
});
