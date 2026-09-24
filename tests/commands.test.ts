import { describe, it, expect } from 'vitest';
import { GameState } from '../src/core/GameState';
import { CommandManager, MoveCardsCommand, DrawStockCommand, RecycleWasteCommand } from '../src/core/Commands';
import { ScoreManager } from '../src/core/Scoring';

describe('Undo / Redo Commands and Scoring', () => {
  it('records and undoes card moves between piles, restoring face-up state and score', () => {
    const game = new GameState();
    game.initGame(1);
    const scoreManager = new ScoreManager();
    const commandManager = new CommandManager();

    // Setup: tableau 0 has hidden card + top card, tableau 1 has target
    game.tableau[0] = [
      { id: 'c1', suit: 'clubs', rank: 5, isFaceUp: false },
      { id: 'c2', suit: 'hearts', rank: 4, isFaceUp: true }
    ];
    game.tableau[1] = [
      { id: 'target', suit: 'spades', rank: 5, isFaceUp: true }
    ];

    const moveCmd = new MoveCardsCommand(
      game,
      scoreManager,
      { type: 'tableau', index: 0 },
      { type: 'tableau', index: 1 },
      1,
      false // previous face-down state before flip
    );

    commandManager.execute(moveCmd);
    expect(game.tableau[0].length).toBe(1);
    expect(game.tableau[0][0].isFaceUp).toBe(true); // Flipped face up
    expect(game.tableau[1].length).toBe(2);
    expect(scoreManager.getMoves()).toBe(1);

    // Now Undo
    expect(commandManager.canUndo()).toBe(true);
    commandManager.undo();

    expect(game.tableau[0].length).toBe(2);
    expect(game.tableau[0][0].isFaceUp).toBe(false); // Restored to face-down
    expect(game.tableau[0][1].isFaceUp).toBe(true);
    expect(game.tableau[1].length).toBe(1);
  });

  it('records and undoes stock draws', () => {
    const game = new GameState();
    game.initGame(1);
    const scoreManager = new ScoreManager();
    const commandManager = new CommandManager();

    const drawCmd = new DrawStockCommand(game, scoreManager);
    commandManager.execute(drawCmd);

    expect(game.stock.length).toBe(23);
    expect(game.waste.length).toBe(1);
    expect(game.waste[0].isFaceUp).toBe(true);

    commandManager.undo();
    expect(game.stock.length).toBe(24);
    expect(game.waste.length).toBe(0);
    expect(game.stock[23].isFaceUp).toBe(false);
  });

  it('records and undoes waste recycles', () => {
    const game = new GameState();
    game.initGame(1);
    const scoreManager = new ScoreManager();
    const commandManager = new CommandManager();

    while (game.stock.length > 0) {
      game.drawStock();
    }

    const recycleCmd = new RecycleWasteCommand(game, scoreManager);
    commandManager.execute(recycleCmd);

    expect(game.stock.length).toBe(24);
    expect(game.waste.length).toBe(0);

    commandManager.undo();
    expect(game.stock.length).toBe(0);
    expect(game.waste.length).toBe(24);
    expect(game.waste.every(c => c.isFaceUp)).toBe(true);
  });
});
