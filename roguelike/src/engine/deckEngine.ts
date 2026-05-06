import { Card, Rank, Suit } from '../shared/types/poker';

const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** 生成 rank 对应的牌面分值（同原项目 getScoreValue） */
function scoreValue(rank: Rank): number {
  return rank >= 10 ? 10 : rank;
}

/** 建立标准 52 张基础牌池 */
export function buildBaseDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}_${rank}`,
        suit,
        rank,
        quality: 'white',
        effects: [],
        baseValue: scoreValue(rank),
        multiplier: 0,
      });
    }
  }
  return deck;
}

/** 可选：按配置概率插入 Joker */
export function injectJokers(deck: Card[], jokerProbability: number): Card[] {
  if (jokerProbability <= 0) return deck;
  const total = Math.round(deck.length * jokerProbability / (1 - jokerProbability));
  const jokers: Card[] = Array.from({ length: total }, (_, i) => ({
    id: `joker_${i}`,
    suit: 'spades' as Suit,
    rank: 2 as Rank,
    quality: 'white' as const,
    effects: [],
    baseValue: 0,
    multiplier: 0,
    isJoker: true,
  }));
  return [...deck, ...jokers];
}

/** Fisher-Yates 洗牌 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 从牌池顶取 n 张 */
export function dealCards(deck: Card[], n: number): { hand: Card[]; remaining: Card[] } {
  const hand = deck.slice(0, n);
  const remaining = deck.slice(n);
  return { hand, remaining };
}

/**
 * 每手最多保留 `maxJokers` 张 Joker（默认 1；「JOKER 成双」技能下为 2）。
 * 多余的 Joker 放回 remaining，用 remaining 中首张非 Joker 替补。
 */
export function capJokersInHand(
  hand: Card[],
  remaining: Card[],
  maxJokers: number = 1,
): { hand: Card[]; remaining: Card[] } {
  const cap = Math.max(0, Math.min(5, Math.floor(maxJokers)));
  const jokerIndices = hand.map((c, i) => (c.isJoker ? i : -1)).filter(i => i >= 0);
  if (jokerIndices.length <= cap) return { hand, remaining };

  const newHand = [...hand];
  const newRemaining = [...remaining];
  for (let k = cap; k < jokerIndices.length; k++) {
    const idx = jokerIndices[k];
    const replaceIdx = newRemaining.findIndex(c => !c.isJoker);
    if (replaceIdx >= 0) {
      newRemaining.push(newHand[idx]);           // 多余 Joker 放回牌池
      newHand[idx] = newRemaining.splice(replaceIdx, 1)[0]; // 普通牌补位
    }
  }
  return { hand: newHand, remaining: newRemaining };
}

/**
 * 补牌：把手牌中未 hold 的位置用牌池顶部替换。
 * 返回新手牌和剩余牌池。
 */
export function replaceUnheld(
  hand: Card[],
  heldIndices: number[],
  deck: Card[],
): { newHand: Card[]; remaining: Card[] } {
  const newHand = [...hand];
  let deckCursor = 0;
  const remaining = [...deck];
  for (let i = 0; i < newHand.length; i++) {
    if (!heldIndices.includes(i)) {
      if (deckCursor < remaining.length) {
        newHand[i] = remaining[deckCursor++];
      }
    }
  }
  return { newHand, remaining: remaining.slice(deckCursor) };
}
