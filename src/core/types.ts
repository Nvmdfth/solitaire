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
