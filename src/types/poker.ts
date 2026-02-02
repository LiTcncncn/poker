export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export type CardQuality = 'white' | 'green' | 'blue' | 'purple' | 'orange' | 'super';

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
  isJoker?: boolean; // 是否为 Joker 牌（通配牌）
  isDiamondCard?: boolean; // 是否为钻石牌（紫色品质，参与计分时每张额外奖励20钻石）
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
  | 'five_of_a_kind'  // 5条
  | 'six_of_a_kind'   // 6条
  | 'seven_of_a_kind' // 7条
  | 'straight_flush' 
  | 'royal_flush';

export interface HandResult {
  type: HandType;
  cards: Card[];
  score: number;
  baseMultiplier: number;
  bonusMultiplier: number;
  name: string;
  scoringCardIds: string[]; // 参与计分的卡牌ID
  diamondReward?: number; // 钻石奖励（钻石牌参与计分时每张额外奖励20钻石）
}

