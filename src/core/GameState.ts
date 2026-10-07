import { Card, PileLocation } from './types';
import { createDeck, shuffleDeck, getCardColor } from './Deck';
import { createPRNG, hashSeed, randomSeed } from './PRNG';

export interface GameEventCallbacks {
  onCardMoved?: (source: PileLocation, target: PileLocation, cards: Card[]) => void;
  onCardFlipped?: (card: Card, isFaceUp: boolean, location: PileLocation) => void;
  onStockDrawn?: (drawnCards: Card[]) => void;
  onWasteRecycled?: () => void;
  onGameWon?: () => void;
}

export class GameState {
  public stock: Card[] = [];
  public waste: Card[] = [];
  public foundations: Card[][] = [[], [], [], []]; // 4 piles (Hearts, Diamonds, Clubs, Spades or any order)
  public tableau: Card[][] = [[], [], [], [], [], [], []]; // 7 columns
  public drawMode: 1 | 3 = 1;
  public currentSeed: number | null = null;
  public callbacks: GameEventCallbacks = {};

  constructor(callbacks?: GameEventCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Initializes and deals a new game of Klondike Solitaire
   */
  public initGame(
    drawMode: 1 | 3 = 1,
    optionsOrDeck?: { seed?: number | string; customDeck?: Card[] } | Card[]
  ): void {
    this.drawMode = drawMode;
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [[], [], [], [], [], [], []];

    let deck: Card[];

    if (Array.isArray(optionsOrDeck)) {
      this.currentSeed = null;
      deck = [...optionsOrDeck];
    } else if (optionsOrDeck && optionsOrDeck.customDeck) {
      this.currentSeed = null;
      deck = [...optionsOrDeck.customDeck];
    } else {
      let rawSeed: number | string;
      if (optionsOrDeck && optionsOrDeck.seed !== undefined) {
        rawSeed = optionsOrDeck.seed;
      } else {
        rawSeed = randomSeed();
      }
      const numericSeed =
        typeof rawSeed === 'number'
          ? (rawSeed >>> 0)
          : (/^\d+$/.test(rawSeed) ? (Number(rawSeed) >>> 0) : hashSeed(rawSeed));
      this.currentSeed = numericSeed;
      const rng = createPRNG(hashSeed(numericSeed));
      deck = shuffleDeck(createDeck(), rng);
    }

    // Deal to 7 tableau columns (1 to 7 cards)
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        if (card) {
          card.isFaceUp = row === col; // Only top card face up
          this.tableau[col].push(card);
        }
      }
    }

    // Remaining 24 cards go into the stock pile face down
    while (deck.length > 0) {
      const card = deck.pop();
      if (card) {
        card.isFaceUp = false;
        this.stock.push(card);
      }
    }
  }

  public getSeed(): number | null {
    return this.currentSeed;
  }

  /**
   * Restores a previously saved game state
   */
  public restoreState(saved: {
    stock: Card[];
    waste: Card[];
    foundations: Card[][];
    tableau: Card[][];
    drawMode: 1 | 3;
    seed?: number | null;
  }): void {
    this.drawMode = saved.drawMode;
    if (saved.seed !== undefined) {
      this.currentSeed = saved.seed;
    }
    this.stock = saved.stock.map(c => ({ ...c }));
    this.waste = saved.waste.map(c => ({ ...c }));
    this.foundations = saved.foundations.map(f => f.map(c => ({ ...c })));
    this.tableau = saved.tableau.map(col => col.map(c => ({ ...c })));
  }

  public getPile(location: PileLocation): Card[] {
    switch (location.type) {
      case 'stock':
        return this.stock;
      case 'waste':
        return this.waste;
      case 'foundation':
        return this.foundations[location.index];
      case 'tableau':
        return this.tableau[location.index];
    }
  }

  /**
   * Draws 1 or 3 cards from stock into waste
   */
  public drawStock(): boolean {
    if (this.stock.length === 0) {
      return false;
    }

    const count = Math.min(this.drawMode, this.stock.length);
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.stock.pop()!;
      card.isFaceUp = true;
      this.waste.push(card);
      drawn.push(card);
    }

    if (this.callbacks.onStockDrawn) {
      this.callbacks.onStockDrawn(drawn);
    }
    return true;
  }

  /**
   * Recycles waste back into stock face-down when stock is empty
   */
  public recycleWaste(): boolean {
    if (this.stock.length > 0 || this.waste.length === 0) {
      return false;
    }

    while (this.waste.length > 0) {
      const card = this.waste.pop()!;
      card.isFaceUp = false;
      this.stock.push(card);
    }

    if (this.callbacks.onWasteRecycled) {
      this.callbacks.onWasteRecycled();
    }
    return true;
  }

  /**
   * Checks if cards can be placed onto a tableau column
   */
  public canPlaceOnTableau(cards: Card[], colIndex: number): boolean {
    if (!cards || cards.length === 0) return false;
    const movingBaseCard = cards[0];
    if (!movingBaseCard.isFaceUp) return false;

    const targetColumn = this.tableau[colIndex];
    if (targetColumn.length === 0) {
      // Empty tableau column accepts only King (Rank 13)
      return movingBaseCard.rank === 13;
    }

    const targetTopCard = targetColumn[targetColumn.length - 1];
    if (!targetTopCard.isFaceUp) return false;

    const isOppositeColor = getCardColor(movingBaseCard.suit) !== getCardColor(targetTopCard.suit);
    const isDescendingSequential = targetTopCard.rank === (movingBaseCard.rank + 1);

    return isOppositeColor && isDescendingSequential;
  }

  /**
   * Checks if a card can be placed onto a foundation pile
   */
  public canPlaceOnFoundation(card: Card, foundationIndex: number): boolean {
    if (!card || !card.isFaceUp) return false;
    const foundation = this.foundations[foundationIndex];

    if (foundation.length === 0) {
      // Empty foundation accepts only Ace (Rank 1)
      return card.rank === 1;
    }

    const topCard = foundation[foundation.length - 1];
    const isSameSuit = card.suit === topCard.suit;
    const isAscendingSequential = card.rank === (topCard.rank + 1);

    return isSameSuit && isAscendingSequential;
  }

  /**
   * Validates if a move is legal from source to target
   */
  public canMoveCards(source: PileLocation, target: PileLocation, count: number): boolean {
    const sourcePile = this.getPile(source);
    if (sourcePile.length < count || count <= 0) return false;

    const cardsToMove = sourcePile.slice(sourcePile.length - count);
    if (cardsToMove.some(c => !c.isFaceUp)) return false;

    // Foundation only accepts 1 card at a time
    if (target.type === 'foundation') {
      if (count !== 1) return false;
      return this.canPlaceOnFoundation(cardsToMove[0], target.index);
    }

    if (target.type === 'tableau') {
      return this.canPlaceOnTableau(cardsToMove, target.index);
    }

    return false;
  }

  /**
   * Executes a move from source to target, auto-flipping exposed tableau cards
   */
  public moveCards(source: PileLocation, target: PileLocation, count: number): boolean {
    if (!this.canMoveCards(source, target, count)) {
      return false;
    }

    const sourcePile = this.getPile(source);
    const targetPile = this.getPile(target);

    const movedCards = sourcePile.splice(sourcePile.length - count, count);
    targetPile.push(...movedCards);

    if (this.callbacks.onCardMoved) {
      this.callbacks.onCardMoved(source, target, movedCards);
    }

    // Auto-flip exposed tableau card if face-down
    if (source.type === 'tableau' && sourcePile.length > 0) {
      const newTopCard = sourcePile[sourcePile.length - 1];
      if (!newTopCard.isFaceUp) {
        newTopCard.isFaceUp = true;
        if (this.callbacks.onCardFlipped) {
          this.callbacks.onCardFlipped(newTopCard, true, source);
        }
      }
    }

    // Check for win condition
    if (this.isGameWon() && this.callbacks.onGameWon) {
      this.callbacks.onGameWon();
    }

    return true;
  }

  /**
   * Finds the best auto-move target for a given card (e.g. on single-tap)
   */
  public findAutoMoveTarget(source: PileLocation, card: Card): PileLocation | null {
    if (!card.isFaceUp) return null;
    const sourcePile = this.getPile(source);
    const cardIndex = sourcePile.indexOf(card);
    if (cardIndex === -1) return null;
    const count = sourcePile.length - cardIndex;

    // 1. Try Foundations first (single card only)
    if (count === 1) {
      for (let f = 0; f < 4; f++) {
        if (this.canPlaceOnFoundation(card, f)) {
          return { type: 'foundation', index: f };
        }
      }
    }

    // 2. Try Tableau columns
    const cardsToMove = sourcePile.slice(cardIndex);
    for (let col = 0; col < 7; col++) {
      if (source.type === 'tableau' && source.index === col) continue;
      if (this.canPlaceOnTableau(cardsToMove, col)) {
        return { type: 'tableau', index: col };
      }
    }

    return null;
  }

  /**
   * Checks if all 52 cards are on Foundations (13 per foundation)
   */
  public isGameWon(): boolean {
    return this.foundations.every(f => f.length === 13);
  }

  /**
   * Checks if the game can be auto-completed (all stock/waste empty and all tableau cards face-up)
   */
  public canAutoComplete(): boolean {
    if (this.stock.length > 0 || this.waste.length > 0) return false;
    for (const col of this.tableau) {
      if (col.some(c => !c.isFaceUp)) return false;
    }
    return !this.isGameWon();
  }

  /**
   * Executes a single auto-complete step by moving the lowest valid tableau card to a foundation
   */
  public autoCompleteStep(): boolean {
    if (!this.canAutoComplete()) return false;

    for (let col = 0; col < 7; col++) {
      const column = this.tableau[col];
      if (column.length === 0) continue;
      const topCard = column[column.length - 1];
      for (let f = 0; f < 4; f++) {
        if (this.canPlaceOnFoundation(topCard, f)) {
          return this.moveCards({ type: 'tableau', index: col }, { type: 'foundation', index: f }, 1);
        }
      }
    }
    return false;
  }
}
