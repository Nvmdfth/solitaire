export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardColor = 'red' | 'black';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';

export interface PileLocation {
  type: PileType;
  index: number; // 0 for stock/waste, 0..3 for foundations, 0..6 for tableau
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  isFaceUp: boolean;
}

export interface GameStats {
  score: number;
  moves: number;
  timeElapsed: number; // in seconds
  drawMode: 1 | 3;
}

export type CardBackSymbol = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface CardBackSettings {
  color: string;
  symbol: CardBackSymbol;
}

export const DEFAULT_CARD_BACK_SETTINGS: CardBackSettings = {
  color: '#0f2b5c',
  symbol: 'spades'
};

export const CARD_BACK_SUIT_SYMBOLS: Record<CardBackSymbol, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

