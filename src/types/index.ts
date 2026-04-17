export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A
export type CardQuality = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'orange';

export interface CardEffect {
  type: 'high_score' | 'multiplier' | 'double_suit' | 'cross_value';
  value: number; // For high_score: +3, multiplier: +2
}

export interface Card {
  id: string;
  // Core properties for evaluation
  suits: Suit[]; // Normal cards have 1. Dual have 2.
  ranks: Rank[]; // Normal cards have 1. Cross-value have multiple.
  
  // Visual properties
  displaySuit: Suit | 'dual_black' | 'dual_red'; 
  displayRank: string; // "2", "10", "A", "234"
  
  quality: CardQuality;
  effects: CardEffect[];
  
  // Base stats (calculated from rank + effects)
  baseValue: number; // e.g. Rank 10 -> 10. With high_score -> 13.
  multiplier: number; // Base 0 (or 1?), adds up. Spec: "牌面倍数" is likely 1, plus bonuses.
                      // Wait, spec says "牌面倍数 is 2, 牌型倍数 is 5, total 7".
                      // So cards might have inherent multiplier. Normal cards have 0 bonus multiplier.
}

export type HandRank = 
  | 'high_card' 
  | 'pair' 
  | 'two_pair' 
  | 'three_of_a_kind' 
  | 'straight' 
  | 'flush' 
  | 'full_house' 
  | 'four_of_a_kind' 
  | 'straight_flush' 
  | 'royal_flush';

export interface HandResult {
  rank: HandRank;
  score: number;
  baseScore: number; // Sum of card values
  rankMultiplier: number;
  qualityMultiplier: number; // Sum of card multipliers
  cards: Card[]; // The cards involved (might be all 5)
  name: string; // Display name
}

export interface PlayerStats {
  totalFlips: number;
  bestHand: HandResult | null;
  totalEarnings: number;
  handCounts: Record<HandRank, number>;
}

