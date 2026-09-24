import { Card, PileLocation } from './types';
import { GameState } from './GameState';
import { ScoreManager } from './Scoring';

export interface Command {
  execute(): boolean;
  undo(): boolean;
}

export class MoveCardsCommand implements Command {
  private movedCards: Card[] = [];
  private uncoveredCardWasFaceDown: boolean = false;
  private scoreDelta: number = 0;

  constructor(
    private game: GameState,
    private scoreManager: ScoreManager,
    public source: PileLocation,
    public target: PileLocation,
    public count: number,
    uncoveredCardWasFaceDown?: boolean
  ) {
    this.uncoveredCardWasFaceDown = uncoveredCardWasFaceDown ?? false;
  }

  public execute(): boolean {
    const sourcePile = this.game.getPile(this.source);
    if (sourcePile.length < this.count) return false;

    // Check if the card below the moving stack was face down
    if (this.source.type === 'tableau' && sourcePile.length > this.count) {
      const cardBelow = sourcePile[sourcePile.length - this.count - 1];
      this.uncoveredCardWasFaceDown = !cardBelow.isFaceUp;
    }

    // Calculate score
    if (this.target.type === 'foundation') {
      this.scoreDelta = 10;
    } else if (this.source.type === 'waste' && this.target.type === 'tableau') {
      this.scoreDelta = 5;
    } else if (this.source.type === 'foundation' && this.target.type === 'tableau') {
      this.scoreDelta = -15;
    }

    if (this.uncoveredCardWasFaceDown) {
      this.scoreDelta += 5;
    }

    const success = this.game.moveCards(this.source, this.target, this.count);
    if (success) {
      this.scoreManager.addScore(this.scoreDelta);
      this.scoreManager.recordMove();
    }
    return success;
  }

  public undo(): boolean {
    const targetPile = this.game.getPile(this.target);
    const sourcePile = this.game.getPile(this.source);

    if (targetPile.length < this.count) return false;

    // If source tableau had a card flipped, flip it back down
    if (this.source.type === 'tableau' && this.uncoveredCardWasFaceDown && sourcePile.length > 0) {
      const topSource = sourcePile[sourcePile.length - 1];
      topSource.isFaceUp = false;
      if (this.game.callbacks.onCardFlipped) {
        this.game.callbacks.onCardFlipped(topSource, false, this.source);
      }
    }

    // Move cards back from target to source
    const returningCards = targetPile.splice(targetPile.length - this.count, this.count);
    sourcePile.push(...returningCards);

    if (this.game.callbacks.onCardMoved) {
      this.game.callbacks.onCardMoved(this.target, this.source, returningCards);
    }

    this.scoreManager.addScore(-this.scoreDelta);
    return true;
  }
}

export class DrawStockCommand implements Command {
  private drawnCards: Card[] = [];

  constructor(
    private game: GameState,
    private scoreManager: ScoreManager
  ) {}

  public execute(): boolean {
    const countBefore = this.game.waste.length;
    const success = this.game.drawStock();
    if (success) {
      const countAfter = this.game.waste.length;
      this.drawnCards = this.game.waste.slice(countBefore, countAfter);
      this.scoreManager.recordMove();
    }
    return success;
  }

  public undo(): boolean {
    if (this.drawnCards.length === 0) return false;
    for (let i = 0; i < this.drawnCards.length; i++) {
      const card = this.game.waste.pop();
      if (card) {
        card.isFaceUp = false;
        this.game.stock.push(card);
      }
    }
    return true;
  }
}

export class RecycleWasteCommand implements Command {
  private count: number = 0;

  constructor(
    private game: GameState,
    private scoreManager: ScoreManager
  ) {}

  public execute(): boolean {
    this.count = this.game.waste.length;
    const success = this.game.recycleWaste();
    if (success) {
      this.scoreManager.recordMove();
      if (this.game.drawMode === 1) {
        this.scoreManager.addScore(-20);
      }
    }
    return success;
  }

  public undo(): boolean {
    if (this.count === 0) return false;
    while (this.game.stock.length > 0) {
      const card = this.game.stock.pop()!;
      card.isFaceUp = true;
      this.game.waste.push(card);
    }
    if (this.game.drawMode === 1) {
      this.scoreManager.addScore(20);
    }
    return true;
  }
}

export class CommandManager {
  private history: Command[] = [];
  private redoHistory: Command[] = [];

  public execute(cmd: Command): boolean {
    const ok = cmd.execute();
    if (ok) {
      this.history.push(cmd);
      this.redoHistory = [];
    }
    return ok;
  }

  public undo(): boolean {
    const cmd = this.history.pop();
    if (!cmd) return false;
    const ok = cmd.undo();
    if (ok) {
      this.redoHistory.push(cmd);
    }
    return ok;
  }

  public redo(): boolean {
    const cmd = this.redoHistory.pop();
    if (!cmd) return false;
    const ok = cmd.execute();
    if (ok) {
      this.history.push(cmd);
    }
    return ok;
  }

  public canUndo(): boolean {
    return this.history.length > 0;
  }

  public canRedo(): boolean {
    return this.redoHistory.length > 0;
  }

  public clear(): void {
    this.history = [];
    this.redoHistory = [];
  }
}
