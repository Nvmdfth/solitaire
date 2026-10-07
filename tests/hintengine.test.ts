import { describe, it, expect } from 'vitest';
import { GameState } from '../src/core/GameState';
import { findBestMove } from '../src/core/HintEngine';

describe('HintEngine solver', () => {
  it('prioritizes moving cards to foundations when available', () => {
    const game = new GameState();
    game.initGame(1);

    const aceHearts = { id: 'ah', suit: 'hearts' as const, rank: 1 as const, isFaceUp: true };
    game.tableau[0] = [aceHearts];

    const hint = findBestMove(game);
    expect(hint).not.toBeNull();
    expect(hint?.target.type).toBe('foundation');
    expect(hint?.source.type).toBe('tableau');
    expect(hint?.source.index).toBe(0);
  });

  it('suggests moving tableau cards that uncover face-down cards', () => {
    const game = new GameState();
    game.initGame(1);

    // Foundation empty, no Aces available for foundation
    game.foundations = [[], [], [], []];
    // Tableau 0: face down card + red 7
    game.tableau[0] = [
      { id: 'hd1', suit: 'clubs' as const, rank: 10 as const, isFaceUp: false },
      { id: 'r7', suit: 'hearts' as const, rank: 7 as const, isFaceUp: true }
    ];
    // Tableau 1: black 8
    game.tableau[1] = [
      { id: 'b8', suit: 'spades' as const, rank: 8 as const, isFaceUp: true }
    ];
    // Empty other tableaus
    for (let c = 2; c < 7; c++) game.tableau[c] = [];
    game.stock = [];
    game.waste = [];

    const hint = findBestMove(game);
    expect(hint).not.toBeNull();
    expect(hint?.source.type).toBe('tableau');
    expect(hint?.source.index).toBe(0);
    expect(hint?.target.type).toBe('tableau');
    expect(hint?.target.index).toBe(1);
  });

  it('suggests drawing from stock when no tableau or foundation moves exist', () => {
    const game = new GameState();
    game.initGame(1);

    // Setup board with no tableau moves
    game.tableau = [
      [{ id: 'c1', suit: 'clubs' as const, rank: 2 as const, isFaceUp: true }],
      [{ id: 'c2', suit: 'spades' as const, rank: 2 as const, isFaceUp: true }],
      [], [], [], [], []
    ];
    game.stock = [{ id: 's1', suit: 'hearts' as const, rank: 1 as const, isFaceUp: false }];
    game.waste = [];
    game.foundations = [[], [], [], []];

    const hint = findBestMove(game);
    expect(hint).not.toBeNull();
    expect(hint?.action).toBe('draw_stock');
  });

  it('returns null when no moves exist on tableau and stock/waste cannot produce any playable cards', () => {
    const game = new GameState();
    game.initGame(1);

    // Board with no valid moves
    game.foundations = [[], [], [], []];
    // Fill all 7 tableau columns with unmovable cards (no empty columns for Kings, no moves between them)
    game.tableau = [
      [{ id: 't0', suit: 'clubs' as const, rank: 2 as const, isFaceUp: true }],
      [{ id: 't1', suit: 'spades' as const, rank: 2 as const, isFaceUp: true }],
      [{ id: 't2', suit: 'clubs' as const, rank: 4 as const, isFaceUp: true }],
      [{ id: 't3', suit: 'spades' as const, rank: 4 as const, isFaceUp: true }],
      [{ id: 't4', suit: 'clubs' as const, rank: 6 as const, isFaceUp: true }],
      [{ id: 't5', suit: 'spades' as const, rank: 6 as const, isFaceUp: true }],
      [{ id: 't6', suit: 'clubs' as const, rank: 8 as const, isFaceUp: true }]
    ];
    // Stock and waste contain cards that cannot be placed on foundation (need Aces) or tableau (need red odd cards 1, 3, 5, 7)
    // Here we give stock/waste cards that are black 10 and black King (cannot go to tableau because all columns are black and no empty columns)
    game.stock = [{ id: 's1', suit: 'clubs' as const, rank: 10 as const, isFaceUp: false }];
    game.waste = [{ id: 'w1', suit: 'spades' as const, rank: 13 as const, isFaceUp: true }];

    const hint = findBestMove(game);
    expect(hint).toBeNull();
  });

  it('suggests recycling waste if stock is empty but waste contains a playable card after recycle', () => {
    const game = new GameState();
    game.initGame(1);

    game.foundations = [[], [], [], []];
    game.tableau = [
      [{ id: 't0', suit: 'clubs' as const, rank: 2 as const, isFaceUp: true }],
      [], [], [], [], [], []
    ];
    game.stock = [];
    // Waste has Ace at index 0 (bottom of waste) and an unplayable 5 of diamonds on top
    game.waste = [
      { id: 'w_ace', suit: 'hearts' as const, rank: 1 as const, isFaceUp: true },
      { id: 'w_top', suit: 'diamonds' as const, rank: 5 as const, isFaceUp: true }
    ];

    const hint = findBestMove(game);
    expect(hint).not.toBeNull();
    expect(hint?.action).toBe('recycle_waste');
  });

  it('returns null when waste is full but cycling will not produce any playable moves', () => {
    const game = new GameState();
    game.initGame(1);

    game.foundations = [[], [], [], []];
    game.tableau = [
      [{ id: 't0', suit: 'clubs' as const, rank: 2 as const, isFaceUp: true }],
      [{ id: 't1', suit: 'spades' as const, rank: 2 as const, isFaceUp: true }],
      [{ id: 't2', suit: 'clubs' as const, rank: 4 as const, isFaceUp: true }],
      [{ id: 't3', suit: 'spades' as const, rank: 4 as const, isFaceUp: true }],
      [{ id: 't4', suit: 'clubs' as const, rank: 6 as const, isFaceUp: true }],
      [{ id: 't5', suit: 'spades' as const, rank: 6 as const, isFaceUp: true }],
      [{ id: 't6', suit: 'clubs' as const, rank: 8 as const, isFaceUp: true }]
    ];
    game.stock = [];
    game.waste = [
      { id: 'w1', suit: 'clubs' as const, rank: 10 as const, isFaceUp: true },
      { id: 'w2', suit: 'spades' as const, rank: 13 as const, isFaceUp: true }
    ];

    const hint = findBestMove(game);
    expect(hint).toBeNull();
  });
});
