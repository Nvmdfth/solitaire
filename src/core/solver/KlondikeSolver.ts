import { GameState } from '../GameState';
import { Rank, Suit } from '../types';
import { getCardColor } from '../Card';
import { createDeck } from '../Deck';
import { createPRNG, hashSeed } from '../PRNG';
import {
  ISolver,
  SolverMove,
  SolverOptions,
  SolverResult
} from './SolverTypes';

interface SolverCard {
  id: string;
  suit: Suit;
  rank: Rank;
  isFaceUp: boolean;
}

interface SolverState {
  foundations: Record<Suit, number>;
  foundationSlots: (Suit | null)[];
  tableau: SolverCard[][];
  stock: SolverCard[];
  waste: SolverCard[];
  drawMode: 1 | 3;
  boardModifiedThisCycle: boolean;
}

interface SearchNode {
  state: SolverState;
  score: number;
  depth: number;
  order: number;
  moves: SolverMove[];
  parent?: SearchNode;
}

class MaxHeap {
  private data: SearchNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: SearchNode): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): SearchNode | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  private compare(a: SearchNode, b: SearchNode): number {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    // Prefer states that achieved score in fewer moves
    if (a.depth !== b.depth) {
      return b.depth - a.depth;
    }
    // Deterministic FIFO fallback
    return b.order - a.order;
  }

  private bubbleUp(index: number): void {
    const item = this.data[index];
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      const parent = this.data[parentIdx];
      if (this.compare(item, parent) > 0) {
        this.data[index] = parent;
        index = parentIdx;
      } else {
        break;
      }
    }
    this.data[index] = item;
  }

  private bubbleDown(index: number): void {
    const length = this.data.length;
    const item = this.data[index];
    const halfLength = length >> 1;

    while (index < halfLength) {
      let bestIdx = (index << 1) + 1;
      const rightIdx = bestIdx + 1;

      if (rightIdx < length && this.compare(this.data[rightIdx], this.data[bestIdx]) > 0) {
        bestIdx = rightIdx;
      }

      if (this.compare(this.data[bestIdx], item) > 0) {
        this.data[index] = this.data[bestIdx];
        index = bestIdx;
      } else {
        break;
      }
    }
    this.data[index] = item;
  }
}

function cloneCard(card: SolverCard): SolverCard {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    isFaceUp: card.isFaceUp
  };
}

function cloneState(state: SolverState): SolverState {
  return {
    foundations: { ...state.foundations },
    foundationSlots: [...state.foundationSlots],
    tableau: [
      state.tableau[0].map(cloneCard),
      state.tableau[1].map(cloneCard),
      state.tableau[2].map(cloneCard),
      state.tableau[3].map(cloneCard),
      state.tableau[4].map(cloneCard),
      state.tableau[5].map(cloneCard),
      state.tableau[6].map(cloneCard)
    ],
    stock: state.stock.map(cloneCard),
    waste: state.waste.map(cloneCard),
    drawMode: state.drawMode,
    boardModifiedThisCycle: state.boardModifiedThisCycle
  };
}

function getCanonicalKey(state: SolverState): string {
  const fStr = `${state.foundations.hearts},${state.foundations.diamonds},${state.foundations.clubs},${state.foundations.spades}`;

  const colStrings = new Array<string>(7);
  for (let i = 0; i < 7; i++) {
    const col = state.tableau[i];
    let downCount = 0;
    const upCards: string[] = [];
    for (let j = 0; j < col.length; j++) {
      if (!col[j].isFaceUp) {
        downCount++;
      } else {
        upCards.push(col[j].id);
      }
    }
    colStrings[i] = `${downCount}:${upCards.join(',')}`;
  }
  colStrings.sort();
  const tableauStr = colStrings.join(';');

  const stockStr = state.stock.map(c => c.id).join(',');
  const wasteStr = state.waste.map(c => c.id).join(',');

  return `${fStr}|${tableauStr}|${stockStr}|${wasteStr}|${state.boardModifiedThisCycle ? 1 : 0}`;
}

function isSafeFoundationMove(card: SolverCard, foundations: Record<Suit, number>): boolean {
  if (card.rank !== foundations[card.suit] + 1) {
    return false;
  }

  // Ace or 2 is unconditionally safe
  if (card.rank === 1 || card.rank === 2) {
    return true;
  }

  // Rank R safe if both foundations of opposite color have rank >= R - 1
  const opp1: Suit = card.suit === 'hearts' || card.suit === 'diamonds' ? 'clubs' : 'hearts';
  const opp2: Suit = card.suit === 'hearts' || card.suit === 'diamonds' ? 'spades' : 'diamonds';

  return foundations[opp1] >= card.rank - 1 && foundations[opp2] >= card.rank - 1;
}

function executeFoundationMove(
  state: SolverState,
  card: SolverCard,
  source: 'tableau' | 'waste',
  fromCol?: number
): SolverMove {
  let slotIndex = state.foundationSlots.indexOf(card.suit);
  if (slotIndex === -1) {
    slotIndex = state.foundationSlots.indexOf(null);
    if (slotIndex === -1) slotIndex = 0;
    state.foundationSlots[slotIndex] = card.suit;
  }

  state.foundations[card.suit]++;

  if (source === 'tableau') {
    const col = state.tableau[fromCol!];
    col.pop();
    if (col.length > 0 && !col[col.length - 1].isFaceUp) {
      col[col.length - 1].isFaceUp = true;
    }
    state.boardModifiedThisCycle = true;
    return {
      type: 'tableau_to_foundation',
      fromCol,
      foundationIndex: slotIndex,
      cardId: card.id,
      count: 1
    };
  } else {
    state.waste.pop();
    state.boardModifiedThisCycle = true;
    return {
      type: 'waste_to_foundation',
      foundationIndex: slotIndex,
      cardId: card.id,
      count: 1
    };
  }
}

function applySafeFoundationMoves(state: SolverState, movesAccumulator: SolverMove[]): boolean {
  let anyMoved = false;
  let progress = true;

  while (progress) {
    progress = false;

    // Check tableau columns in deterministic order (0 to 6)
    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;
      const topCard = col[col.length - 1];
      if (topCard.isFaceUp && isSafeFoundationMove(topCard, state.foundations)) {
        const move = executeFoundationMove(state, topCard, 'tableau', c);
        movesAccumulator.push(move);
        progress = true;
        anyMoved = true;
        break;
      }
    }

    if (progress) continue;

    // Check waste
    if (state.waste.length > 0) {
      const wasteCard = state.waste[state.waste.length - 1];
      if (wasteCard.isFaceUp && isSafeFoundationMove(wasteCard, state.foundations)) {
        const move = executeFoundationMove(state, wasteCard, 'waste');
        movesAccumulator.push(move);
        progress = true;
        anyMoved = true;
      }
    }
  }

  return anyMoved;
}

function computeScore(state: SolverState): number {
  const foundationsTotal =
    state.foundations.hearts +
    state.foundations.diamonds +
    state.foundations.clubs +
    state.foundations.spades;

  let faceUpCardsCount = 0;
  let hiddenCardsCount = 0;
  let emptyColumnsWithKings = 0;

  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    if (col.length === 0) {
      emptyColumnsWithKings++;
    } else {
      if (col[0].isFaceUp && col[0].rank === 13) {
        emptyColumnsWithKings++;
      }
      for (let i = 0; i < col.length; i++) {
        if (col[i].isFaceUp) {
          faceUpCardsCount++;
        } else {
          hiddenCardsCount++;
        }
      }
    }
  }

  return (
    foundationsTotal * 120 +
    faceUpCardsCount * 12 +
    emptyColumnsWithKings * 8 -
    hiddenCardsCount * 10
  );
}

function reconstructSolution(node: SearchNode): SolverMove[] {
  const result: SolverMove[] = [];
  let curr: SearchNode | undefined = node;
  const chain: SearchNode[] = [];
  while (curr) {
    chain.push(curr);
    curr = curr.parent;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    result.push(...chain[i].moves);
  }
  return result;
}

export class KlondikeSolver implements ISolver {
  public solve(gameStateOrSeed: GameState | number, options?: SolverOptions): SolverResult {
    const startTime = performance.now();
    const maxStates = options?.maxStates ?? 10000;
    const timeoutMs = options?.timeoutMs ?? 250;

    let gameState: GameState;
    if (typeof gameStateOrSeed === 'number') {
      gameState = new GameState();
      const rng = createPRNG(hashSeed(gameStateOrSeed));
      const deck = createDeck();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      gameState.initGame(1, deck);
    } else {
      gameState = gameStateOrSeed;
    }

    const initialState = this.initStateFromGame(gameState);
    const initialMoves: SolverMove[] = [];

    // Initial safe dominance pruning
    applySafeFoundationMoves(initialState, initialMoves);

    const initialFoundationsTotal =
      initialState.foundations.hearts +
      initialState.foundations.diamonds +
      initialState.foundations.clubs +
      initialState.foundations.spades;

    if (initialFoundationsTotal === 52) {
      return {
        status: 'WINNABLE',
        movesCount: initialMoves.length,
        visitedStates: 1,
        durationMs: Math.max(0, Math.round(performance.now() - startTime)),
        solution: initialMoves
      };
    }

    const visited = new Set<string>();
    const queue = new MaxHeap();
    let orderCounter = 0;

    const initialKey = getCanonicalKey(initialState);
    visited.add(initialKey);

    const rootNode: SearchNode = {
      state: initialState,
      score: computeScore(initialState),
      depth: initialMoves.length,
      order: ++orderCounter,
      moves: initialMoves
    };
    queue.push(rootNode);

    let visitedStates = 0;

    while (queue.size > 0) {
      if (visitedStates >= maxStates) {
        return {
          status: 'TIMEOUT',
          movesCount: 0,
          visitedStates,
          durationMs: Math.max(0, Math.round(performance.now() - startTime)),
          solution: undefined
        };
      }

      if ((visitedStates & 63) === 0 && performance.now() - startTime >= timeoutMs) {
        return {
          status: 'TIMEOUT',
          movesCount: 0,
          visitedStates,
          durationMs: Math.max(0, Math.round(performance.now() - startTime)),
          solution: undefined
        };
      }

      const currentNode = queue.pop()!;
      visitedStates++;

      const current = currentNode.state;
      const currentFoundationsTotal =
        current.foundations.hearts +
        current.foundations.diamonds +
        current.foundations.clubs +
        current.foundations.spades;

      if (currentFoundationsTotal === 52) {
        const solution = reconstructSolution(currentNode);
        return {
          status: 'WINNABLE',
          movesCount: solution.length,
          visitedStates,
          durationMs: Math.max(0, Math.round(performance.now() - startTime)),
          solution
        };
      }

      const successors = this.generateSuccessors(currentNode);
      for (const nextNode of successors) {
        const key = getCanonicalKey(nextNode.state);
        if (!visited.has(key)) {
          visited.add(key);
          nextNode.order = ++orderCounter;
          queue.push(nextNode);
        }
      }
    }

    return {
      status: 'UNWINNABLE',
      movesCount: 0,
      visitedStates,
      durationMs: Math.max(0, Math.round(performance.now() - startTime)),
      solution: undefined
    };
  }

  private initStateFromGame(game: GameState): SolverState {
    const foundations: Record<Suit, number> = {
      hearts: 0,
      diamonds: 0,
      clubs: 0,
      spades: 0
    };
    const foundationSlots: (Suit | null)[] = [null, null, null, null];

    for (let f = 0; f < 4; f++) {
      const pile = game.foundations[f];
      if (pile && pile.length > 0) {
        const top = pile[pile.length - 1];
        foundations[top.suit] = top.rank;
        foundationSlots[f] = top.suit;
      }
    }

    const tableau: SolverCard[][] = game.tableau.map(col =>
      col.map(c => ({
        id: c.id,
        suit: c.suit,
        rank: c.rank,
        isFaceUp: c.isFaceUp
      }))
    );

    const stock: SolverCard[] = game.stock.map(c => ({
      id: c.id,
      suit: c.suit,
      rank: c.rank,
      isFaceUp: c.isFaceUp
    }));

    const waste: SolverCard[] = game.waste.map(c => ({
      id: c.id,
      suit: c.suit,
      rank: c.rank,
      isFaceUp: c.isFaceUp
    }));

    return {
      foundations,
      foundationSlots,
      tableau,
      stock,
      waste,
      drawMode: game.drawMode,
      boardModifiedThisCycle: true
    };
  }

  private generateSuccessors(parent: SearchNode): SearchNode[] {
    const successors: SearchNode[] = [];
    const current = parent.state;
    const firstEmptyCol = current.tableau.findIndex(c => c.length === 0);

    // 1. Non-safe Foundation moves from tableau
    for (let c = 0; c < 7; c++) {
      const col = current.tableau[c];
      if (col.length === 0) continue;
      const topCard = col[col.length - 1];
      if (
        topCard.isFaceUp &&
        topCard.rank === current.foundations[topCard.suit] + 1 &&
        !isSafeFoundationMove(topCard, current.foundations)
      ) {
        const next = cloneState(current);
        const nodeMoves: SolverMove[] = [];
        const move = executeFoundationMove(next, topCard, 'tableau', c);
        nodeMoves.push(move);
        applySafeFoundationMoves(next, nodeMoves);
        successors.push({
          state: next,
          score: computeScore(next),
          depth: parent.depth + nodeMoves.length,
          order: 0,
          moves: nodeMoves,
          parent
        });
      }
    }

    // 2. Non-safe Foundation moves from waste
    if (current.waste.length > 0) {
      const wasteCard = current.waste[current.waste.length - 1];
      if (
        wasteCard.isFaceUp &&
        wasteCard.rank === current.foundations[wasteCard.suit] + 1 &&
        !isSafeFoundationMove(wasteCard, current.foundations)
      ) {
        const next = cloneState(current);
        const nodeMoves: SolverMove[] = [];
        const move = executeFoundationMove(next, wasteCard, 'waste');
        nodeMoves.push(move);
        applySafeFoundationMoves(next, nodeMoves);
        successors.push({
          state: next,
          score: computeScore(next),
          depth: parent.depth + nodeMoves.length,
          order: 0,
          moves: nodeMoves,
          parent
        });
      }
    }

    // 3. Tableau to Tableau moves
    for (let srcCol = 0; srcCol < 7; srcCol++) {
      const srcColumn = current.tableau[srcCol];
      if (srcColumn.length === 0) continue;

      const firstFaceUpIdx = srcColumn.findIndex(c => c.isFaceUp);
      if (firstFaceUpIdx === -1) continue;

      for (let cardIdx = firstFaceUpIdx; cardIdx < srcColumn.length; cardIdx++) {
        const baseCard = srcColumn[cardIdx];
        const isColBase = cardIdx === 0;

        for (let tgtCol = 0; tgtCol < 7; tgtCol++) {
          if (srcCol === tgtCol) continue;
          const tgtColumn = current.tableau[tgtCol];

          if (tgtColumn.length === 0) {
            // Only King can move to empty column
            if (baseCard.rank !== 13) continue;
            // Prune moving King from column base with no hidden cards beneath
            if (isColBase) continue;
            // Prune redundant empty column targets
            if (tgtCol !== firstEmptyCol) continue;
          } else {
            const tgtTop = tgtColumn[tgtColumn.length - 1];
            if (!tgtTop.isFaceUp) continue;
            const isOppColor = getCardColor(baseCard.suit) !== getCardColor(tgtTop.suit);
            const isSequential = tgtTop.rank === baseCard.rank + 1;
            if (!isOppColor || !isSequential) continue;
          }

          const next = cloneState(current);
          const count = next.tableau[srcCol].length - cardIdx;
          const moved = next.tableau[srcCol].splice(cardIdx, count);
          next.tableau[tgtCol].push(...moved);

          if (next.tableau[srcCol].length > 0) {
            const newTop = next.tableau[srcCol][next.tableau[srcCol].length - 1];
            if (!newTop.isFaceUp) {
              newTop.isFaceUp = true;
            }
          }

          next.boardModifiedThisCycle = true;
          const nodeMoves: SolverMove[] = [
            {
              type: 'tableau_to_tableau',
              fromCol: srcCol,
              toCol: tgtCol,
              cardId: baseCard.id,
              count
            }
          ];

          applySafeFoundationMoves(next, nodeMoves);
          successors.push({
            state: next,
            score: computeScore(next),
            depth: parent.depth + nodeMoves.length,
            order: 0,
            moves: nodeMoves,
            parent
          });
        }
      }
    }

    // 4. Waste to Tableau moves
    if (current.waste.length > 0) {
      const wasteCard = current.waste[current.waste.length - 1];
      for (let tgtCol = 0; tgtCol < 7; tgtCol++) {
        const tgtColumn = current.tableau[tgtCol];

        if (tgtColumn.length === 0) {
          if (wasteCard.rank !== 13) continue;
          if (tgtCol !== firstEmptyCol) continue;
        } else {
          const tgtTop = tgtColumn[tgtColumn.length - 1];
          if (!tgtTop.isFaceUp) continue;
          const isOppColor = getCardColor(wasteCard.suit) !== getCardColor(tgtTop.suit);
          const isSequential = tgtTop.rank === wasteCard.rank + 1;
          if (!isOppColor || !isSequential) continue;
        }

        const next = cloneState(current);
        const moved = next.waste.pop()!;
        next.tableau[tgtCol].push(moved);
        next.boardModifiedThisCycle = true;
        const nodeMoves: SolverMove[] = [
          {
            type: 'waste_to_tableau',
            toCol: tgtCol,
            cardId: wasteCard.id,
            count: 1
          }
        ];

        applySafeFoundationMoves(next, nodeMoves);
        successors.push({
          state: next,
          score: computeScore(next),
          depth: parent.depth + nodeMoves.length,
          order: 0,
          moves: nodeMoves,
          parent
        });
      }
    }

    // 5. Draw Stock
    if (current.stock.length > 0) {
      const next = cloneState(current);
      const count = Math.min(next.drawMode, next.stock.length);
      let drawnCardId = '';
      for (let i = 0; i < count; i++) {
        const card = next.stock.pop()!;
        card.isFaceUp = true;
        next.waste.push(card);
        drawnCardId = card.id;
      }
      const nodeMoves: SolverMove[] = [
        {
          type: 'draw_stock',
          cardId: drawnCardId,
          count
        }
      ];

      applySafeFoundationMoves(next, nodeMoves);
      successors.push({
        state: next,
        score: computeScore(next),
        depth: parent.depth + nodeMoves.length,
        order: 0,
        moves: nodeMoves,
        parent
      });
    }

    // 6. Recycle Waste (Stock Cycle Pruning)
    if (current.stock.length === 0 && current.waste.length > 0) {
      if (current.boardModifiedThisCycle) {
        const next = cloneState(current);
        while (next.waste.length > 0) {
          const card = next.waste.pop()!;
          card.isFaceUp = false;
          next.stock.push(card);
        }
        next.boardModifiedThisCycle = false;
        const nodeMoves: SolverMove[] = [
          {
            type: 'recycle_waste',
            cardId: 'recycle'
          }
        ];

        applySafeFoundationMoves(next, nodeMoves);
        successors.push({
          state: next,
          score: computeScore(next),
          depth: parent.depth + nodeMoves.length,
          order: 0,
          moves: nodeMoves,
          parent
        });
      }
    }

    return successors;
  }
}
