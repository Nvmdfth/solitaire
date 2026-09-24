import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck, getCardColor, getCardLabel } from '../src/core/Deck';
import { Card } from '../src/core/types';

describe('Deck and Card utilities', () => {
  it('creates standard 52-card deck with 4 suits and 13 ranks', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    expect(suits.has('hearts')).toBe(true);
    expect(suits.has('diamonds')).toBe(true);
    expect(suits.has('clubs')).toBe(true);
    expect(suits.has('spades')).toBe(true);

    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
    for (let r = 1; r <= 13; r++) {
      expect(ranks.has(r as any)).toBe(true);
    }
  });

  it('correctly identifies red and black card colors', () => {
    expect(getCardColor('hearts')).toBe('red');
    expect(getCardColor('diamonds')).toBe('red');
    expect(getCardColor('clubs')).toBe('black');
    expect(getCardColor('spades')).toBe('black');
  });

  it('formats card labels correctly', () => {
    const card1: Card = { id: 'test1', suit: 'hearts', rank: 1, isFaceUp: true };
    const card2: Card = { id: 'test2', suit: 'spades', rank: 13, isFaceUp: true };
    const card3: Card = { id: 'test3', suit: 'diamonds', rank: 11, isFaceUp: true };
    const card4: Card = { id: 'test4', suit: 'clubs', rank: 12, isFaceUp: true };
    const card5: Card = { id: 'test5', suit: 'clubs', rank: 10, isFaceUp: true };

    expect(getCardLabel(card1)).toBe('A♥');
    expect(getCardLabel(card2)).toBe('K♠');
    expect(getCardLabel(card3)).toBe('J♦');
    expect(getCardLabel(card4)).toBe('Q♣');
    expect(getCardLabel(card5)).toBe('10♣');
  });

  it('shuffles deck using Fisher-Yates without mutating card count or losing cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck([...deck]);
    expect(shuffled.length).toBe(52);
    const ids = new Set(shuffled.map(c => c.id));
    expect(ids.size).toBe(52);
  });
});
