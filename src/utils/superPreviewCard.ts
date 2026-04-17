import type { Card, Rank, Suit } from '../types/poker';

/** 用于弹窗/预览：从解锁回调的 suit、rank 拼出与牌池一致的超级牌 Card */
export function buildSuperPreviewCard(suit: string, rank: number): Card {
  const s = (['spades', 'hearts', 'clubs', 'diamonds'].includes(suit)
    ? suit
    : 'spades') as Suit;
  return {
    id: 'super-preview',
    suit: s,
    rank: rank as Rank,
    quality: 'super',
    effects: [],
    baseValue: 0,
    multiplier: 1,
  };
}
