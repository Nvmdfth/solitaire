import { describe, it, expect } from 'vitest';
import { GameState } from '../src/core/GameState';
import { Card } from '../src/core/types';

describe('GameState and Klondike Rules', () => {
  it('initializes game with correct 7 tableau piles, 24 stock cards, 0 waste, and 4 empty foundations', () => {
    const game = new GameState();
    game.initGame(1);

    expect(game.stock.length).toBe(24);
    expect(game.waste.length).toBe(0);
    expect(game.foundations.length).toBe(4);
    for (let f = 0; f < 4; f++) {
      expect(game.foundations[f].length).toBe(0);
    }
    expect(game.tableau.length).toBe(7);
    for (let col = 0; col < 7; col++) {
      expect(game.tableau[col].length).toBe(col + 1);
      // Only the top card in tableau should be face up initially
      for (let idx = 0; idx < game.tableau[col].length; idx++) {
        const isTop = idx === game.tableau[col].length - 1;
        expect(game.tableau[col][idx].isFaceUp).toBe(isTop);
      }
    }
  });

  it('draws 1 card from stock to waste in drawMode=1', () => {
    const game = new GameState();
    game.initGame(1);
    expect(game.stock.length).toBe(24);
    expect(game.waste.length).toBe(0);

    const drawn = game.drawStock();
    expect(drawn).toBe(true);
    expect(game.stock.length).toBe(23);
    expect(game.waste.length).toBe(1);
    expect(game.waste[0].isFaceUp).toBe(true);
  });

  it('draws up to 3 cards from stock to waste in drawMode=3', () => {
    const game = new GameState();
    game.initGame(3);
    const drawn = game.drawStock();
    expect(drawn).toBe(true);
    expect(game.stock.length).toBe(21);
    expect(game.waste.length).toBe(3);
    expect(game.waste.every(c => c.isFaceUp)).toBe(true);
  });

  it('recycles waste into stock when stock is empty', () => {
    const game = new GameState();
    game.initGame(1);
    // Draw all 24 cards
    while (game.stock.length > 0) {
      game.drawStock();
    }
    expect(game.stock.length).toBe(0);
    expect(game.waste.length).toBe(24);

    const recycled = game.recycleWaste();
    expect(recycled).toBe(true);
    expect(game.stock.length).toBe(24);
    expect(game.waste.length).toBe(0);
    expect(game.stock.every(c => !c.isFaceUp)).toBe(true);
  });

  it('validates tableau placement: alternating color and descending rank', () => {
    const game = new GameState();
    game.initGame(1);

    const blackEight: Card = { id: 'c8', suit: 'clubs', rank: 8, isFaceUp: true };
    const redSeven: Card = { id: 'h7', suit: 'hearts', rank: 7, isFaceUp: true };
    const blackSeven: Card = { id: 's7', suit: 'spades', rank: 7, isFaceUp: true };
    const redNine: Card = { id: 'd9', suit: 'diamonds', rank: 9, isFaceUp: true };
    const king: Card = { id: 'sk', suit: 'spades', rank: 13, isFaceUp: true };
    const queen: Card = { id: 'hq', suit: 'hearts', rank: 12, isFaceUp: true };

    // Setup tableau column 0 with blackEight
    game.tableau[0] = [blackEight];

    // Red 7 on Black 8 is valid
    expect(game.canPlaceOnTableau([redSeven], 0)).toBe(true);
    // Black 7 on Black 8 is invalid (same color)
    expect(game.canPlaceOnTableau([blackSeven], 0)).toBe(false);
    // Red 9 on Black 8 is invalid (not descending)
    expect(game.canPlaceOnTableau([redNine], 0)).toBe(false);

    // Empty tableau column: only King allowed
    game.tableau[1] = [];
    expect(game.canPlaceOnTableau([king], 1)).toBe(true);
    expect(game.canPlaceOnTableau([queen], 1)).toBe(false);
  });

  it('validates foundation placement: matching suit and ascending rank starting with Ace', () => {
    const game = new GameState();
    game.initGame(1);

    const aceHearts: Card = { id: 'ah', suit: 'hearts', rank: 1, isFaceUp: true };
    const twoHearts: Card = { id: '2h', suit: 'hearts', rank: 2, isFaceUp: true };
    const twoSpades: Card = { id: '2s', suit: 'spades', rank: 2, isFaceUp: true };
    const threeHearts: Card = { id: '3h', suit: 'hearts', rank: 3, isFaceUp: true };

    // Empty foundation 0 accepts Ace
    expect(game.canPlaceOnFoundation(aceHearts, 0)).toBe(true);
    expect(game.canPlaceOnFoundation(twoHearts, 0)).toBe(false);

    game.foundations[0] = [aceHearts];
    // 2 of Hearts on Ace of Hearts is valid
    expect(game.canPlaceOnFoundation(twoHearts, 0)).toBe(true);
    // 2 of Spades on Ace of Hearts is invalid (wrong suit)
    expect(game.canPlaceOnFoundation(twoSpades, 0)).toBe(false);
    // 3 of Hearts on Ace of Hearts is invalid (not sequential)
    expect(game.canPlaceOnFoundation(threeHearts, 0)).toBe(false);
  });

  it('automatically flips exposed tableau card when top card is removed', () => {
    const game = new GameState();
    game.initGame(1);

    const hiddenCard: Card = { id: 'c1', suit: 'clubs', rank: 5, isFaceUp: false };
    const topCard: Card = { id: 'c2', suit: 'hearts', rank: 4, isFaceUp: true };
    game.tableau[0] = [hiddenCard, topCard];
    game.tableau[1] = [{ id: 'target', suit: 'spades', rank: 5, isFaceUp: true }];

    const moved = game.moveCards({ type: 'tableau', index: 0 }, { type: 'tableau', index: 1 }, 1);
    expect(moved).toBe(true);
    expect(game.tableau[0].length).toBe(1);
    expect(game.tableau[0][0].isFaceUp).toBe(true); // Should auto-flip
  });

  it('detects game win when all 4 foundations have 13 cards', () => {
    const game = new GameState();
    game.initGame(1);
    expect(game.isGameWon()).toBe(false);

    for (let f = 0; f < 4; f++) {
      game.foundations[f] = Array.from({ length: 13 }, (_, i) => ({
        id: `f_${f}_${i + 1}`,
        suit: ['hearts', 'diamonds', 'clubs', 'spades'][f] as any,
        rank: (i + 1) as any,
        isFaceUp: true,
      }));
    }
    expect(game.isGameWon()).toBe(true);
  });

  it('detects auto-complete eligibility when all tableau cards are face-up and stock/waste are empty', () => {
    const game = new GameState();
    game.initGame(1);
    expect(game.canAutoComplete()).toBe(false);

    game.stock = [];
    game.waste = [];
    for (let col = 0; col < 7; col++) {
      game.tableau[col].forEach(c => (c.isFaceUp = true));
    }
    expect(game.canAutoComplete()).toBe(true);
  });
});
