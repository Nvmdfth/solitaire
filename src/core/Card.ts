import { Card, CardColor, Rank, Suit } from './types';

export function getCardColor(suit: Suit): CardColor {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

export function getRankSymbol(rank: Rank): string {
  switch (rank) {
    case 1: return 'A';
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    default: return rank.toString();
  }
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}

export function getCardLabel(card: Card): string {
  return `${getRankSymbol(card.rank)}${getSuitSymbol(card.suit)}`;
}
