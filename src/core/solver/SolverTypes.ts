export type SolverStatus = 'WINNABLE' | 'UNWINNABLE' | 'TIMEOUT';

export interface SolverMove {
  type:
    | 'tableau_to_foundation'
    | 'waste_to_foundation'
    | 'tableau_to_tableau'
    | 'waste_to_tableau'
    | 'draw_stock'
    | 'recycle_waste';
  fromCol?: number;
  toCol?: number;
  foundationIndex?: number;
  cardId: string;
  count?: number;
}

export interface SolverResult {
  status: SolverStatus;
  movesCount: number;
  visitedStates: number;
  durationMs: number;
  solution?: SolverMove[];
}

export interface SolverOptions {
  maxStates?: number;
  timeoutMs?: number;
}

export interface ISolver {
  solve(gameStateOrSeed: any, options?: SolverOptions): SolverResult;
}
