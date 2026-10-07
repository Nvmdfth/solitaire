import { Card, Rank, Suit } from './types';
import { getCardColor, getCardLabel, getRankSymbol, getSuitSymbol } from './Card';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}_${rank}`,
        suit,
        rank,
        isFaceUp: false,
      });
    }
  }
  return deck;
}

/**
 * Modern Fisher-Yates shuffle algorithm
 */
export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export { getCardColor, getCardLabel, getRankSymbol, getSuitSymbol };
