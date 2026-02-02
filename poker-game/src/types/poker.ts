export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export type CardQuality = 'white' | 'green' | 'blue' | 'purple' | 'orange';

export type GreenCardType = 'high_score' | 'multiplier' | 'double_suit' | 'cross_value';

export interface CardEffect {
  type: GreenCardType;
  value?: number; // e.g. +3 for high_score, +2 for multiplier
  suits?: Suit[]; // for double_suit
  ranks?: Rank[]; // for cross_value
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  quality: CardQuality;
  effects: CardEffect[];
  baseValue: number;
  multiplier: number;
}

export type HandType = 
  | 'high_card' 
  | 'one_pair' 
  | 'two_pairs' 
  | 'three_of_a_kind' 
  | 'straight'
  | 'flush' 
  | 'full_house' 
  | 'four_of_a_kind' 
  | 'straight_flush' 
  | 'royal_flush';

export interface HandResult {
  type: HandType;
  cards: Card[];
  score: number;
  baseMultiplier: number;
  bonusMultiplier: number;
  name: string;
}










