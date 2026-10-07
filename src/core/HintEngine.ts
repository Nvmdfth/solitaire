import { Card, PileLocation } from './types';
import { GameState } from './GameState';

export interface HintMove {
  action: 'move_card' | 'draw_stock' | 'recycle_waste';
  source: PileLocation;
  target: PileLocation;
  card: Card;
  count: number;
  description: string;
}

/**
 * Finds the most strategic move currently available on the board.
 */
export function findBestMove(game: GameState): HintMove | null {
  // 1. Move card to Foundation (Waste or Tableau)
  // Check Waste first
  if (game.waste.length > 0) {
    const wasteCard = game.waste[game.waste.length - 1];
    for (let f = 0; f < 4; f++) {
      if (game.canPlaceOnFoundation(wasteCard, f)) {
        return {
          action: 'move_card',
          source: { type: 'waste', index: 0 },
          target: { type: 'foundation', index: f },
          card: wasteCard,
          count: 1,
          description: `Move ${wasteCard.rank} of ${wasteCard.suit} from waste to foundation.`
        };
      }
    }
  }

  // Check Tableau to Foundation
  for (let col = 0; col < 7; col++) {
    const column = game.tableau[col];
    if (column.length === 0) continue;
    const topCard = column[column.length - 1];
    for (let f = 0; f < 4; f++) {
      if (game.canPlaceOnFoundation(topCard, f)) {
        return {
          action: 'move_card',
          source: { type: 'tableau', index: col },
          target: { type: 'foundation', index: f },
          card: topCard,
          count: 1,
          description: `Move ${topCard.rank} of ${topCard.suit} to foundation.`
        };
      }
    }
  }

  // 2. Tableau to Tableau moves that expose a face-down card
  for (let srcCol = 0; srcCol < 7; srcCol++) {
    const srcColumn = game.tableau[srcCol];
    if (srcColumn.length === 0) continue;

    const firstFaceUpIdx = srcColumn.findIndex(c => c.isFaceUp);
    if (firstFaceUpIdx > 0) {
      // There are face-down cards underneath!
      const movingStack = srcColumn.slice(firstFaceUpIdx);
      const baseMovingCard = movingStack[0];

      for (let tgtCol = 0; tgtCol < 7; tgtCol++) {
        if (srcCol === tgtCol) continue;
        if (game.canPlaceOnTableau(movingStack, tgtCol)) {
          return {
            action: 'move_card',
            source: { type: 'tableau', index: srcCol },
            target: { type: 'tableau', index: tgtCol },
            card: baseMovingCard,
            count: movingStack.length,
            description: `Move ${baseMovingCard.rank} of ${baseMovingCard.suit} to uncover hidden card.`
          };
        }
      }
    }
  }

  // 3. Move King to an empty tableau column if it exposes cards or clears waste
  if (game.waste.length > 0) {
    const wasteCard = game.waste[game.waste.length - 1];
    if (wasteCard.rank === 13) {
      for (let tgtCol = 0; tgtCol < 7; tgtCol++) {
        if (game.tableau[tgtCol].length === 0) {
          return {
            action: 'move_card',
            source: { type: 'waste', index: 0 },
            target: { type: 'tableau', index: tgtCol },
            card: wasteCard,
            count: 1,
            description: `Move King of ${wasteCard.suit} from waste to empty column.`
          };
        }
      }
    }
  }

  // 4. Any valid Waste to Tableau move
  if (game.waste.length > 0) {
    const wasteCard = game.waste[game.waste.length - 1];
    for (let tgtCol = 0; tgtCol < 7; tgtCol++) {
      if (game.canPlaceOnTableau([wasteCard], tgtCol)) {
        return {
          action: 'move_card',
          source: { type: 'waste', index: 0 },
          target: { type: 'tableau', index: tgtCol },
          card: wasteCard,
          count: 1,
          description: `Move ${wasteCard.rank} of ${wasteCard.suit} from waste to column ${tgtCol + 1}.`
        };
      }
    }
  }

  // 5. Any other Tableau to Tableau move (that doesn't just oscillate)
  for (let srcCol = 0; srcCol < 7; srcCol++) {
    const srcColumn = game.tableau[srcCol];
    if (srcColumn.length === 0) continue;

    const firstFaceUpIdx = srcColumn.findIndex(c => c.isFaceUp);
    if (firstFaceUpIdx === 0 && srcColumn[0].rank === 13) {
      // Don't move a King from one empty space to another empty space
      continue;
    }

    const movingStack = srcColumn.slice(firstFaceUpIdx);
    const baseMovingCard = movingStack[0];

    for (let tgtCol = 0; tgtCol < 7; tgtCol++) {
      if (srcCol === tgtCol) continue;
      if (game.canPlaceOnTableau(movingStack, tgtCol)) {
        return {
          action: 'move_card',
          source: { type: 'tableau', index: srcCol },
          target: { type: 'tableau', index: tgtCol },
          card: baseMovingCard,
          count: movingStack.length,
          description: `Move ${baseMovingCard.rank} of ${baseMovingCard.suit} to column ${tgtCol + 1}.`
        };
      }
    }
  }

  // 6. Draw from stock or recycle waste if there is a reachable move
  if (hasPlayableStockOrWasteMove(game)) {
    if (game.stock.length > 0) {
      return {
        action: 'draw_stock',
        source: { type: 'stock', index: 0 },
        target: { type: 'waste', index: 0 },
        card: game.stock[game.stock.length - 1],
        count: 1,
        description: 'Draw card from stock.'
      };
    }

    if (game.waste.length > 0) {
      return {
        action: 'recycle_waste',
        source: { type: 'waste', index: 0 },
        target: { type: 'stock', index: 0 },
        card: game.waste[0],
        count: game.waste.length,
        description: 'Recycle waste back into stock.'
      };
    }
  }

  return null;
}

/**
 * Simulates cycling through the stock and waste pile to determine if any card
 * reachable by drawing from stock or recycling waste can be played to a tableau or foundation pile.
 */
export function hasPlayableStockOrWasteMove(game: GameState): boolean {
  if (game.stock.length === 0 && game.waste.length === 0) {
    return false;
  }

  const simStock = game.stock.map(c => ({ ...c }));
  const simWaste = game.waste.map(c => ({ ...c }));
  const seenStates = new Set<string>();

  while (true) {
    const stateKey = simStock.map(c => c.id).join(',') + '|' + simWaste.map(c => c.id).join(',');
    if (seenStates.has(stateKey)) {
      break;
    }
    seenStates.add(stateKey);

    if (simStock.length > 0) {
      const count = Math.min(game.drawMode, simStock.length);
      for (let i = 0; i < count; i++) {
        const card = simStock.pop()!;
        card.isFaceUp = true;
        simWaste.push(card);
      }

      const topCard = simWaste[simWaste.length - 1];
      // Check foundation moves
      for (let f = 0; f < 4; f++) {
        if (game.canPlaceOnFoundation(topCard, f)) {
          return true;
        }
      }
      // Check tableau moves
      for (let col = 0; col < 7; col++) {
        if (game.canPlaceOnTableau([topCard], col)) {
          return true;
        }
      }
    } else if (simWaste.length > 0) {
      // Recycle waste back into stock face-down
      while (simWaste.length > 0) {
        const card = simWaste.pop()!;
        card.isFaceUp = false;
        simStock.push(card);
      }
    } else {
      break;
    }
  }

  return false;
}
