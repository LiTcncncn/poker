import { Card, Rank, Suit } from '../shared/types/poker';
import { DeckRule } from '../types/profile';

const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** 生成 rank 对应的牌面分值（同原项目 getScoreValue） */
function scoreValue(rank: Rank): number {
  return rank >= 10 ? 10 : rank;
}

function makeCard(suit: Suit, rank: Rank, idSuffix = ''): Card {
  return {
    id: `${suit}_${rank}${idSuffix}`,
    suit,
    rank,
    quality: 'white',
    effects: [],
    baseValue: scoreValue(rank),
    multiplier: 0,
  };
}

/** 建立标准 52 张基础牌池 */
export function buildBaseDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(suit, rank));
    }
  }
  return deck;
}

/**
 * 按局规则构建变体牌堆：
 *
 * two_suits_hs  - 花色归并 ♦→♥、♣→♠；保留 52 张，形成 26♥ + 26♠，
 *                 同点数各有两张（原生 + 归并），因此 id 加 _m 后缀区分。
 * two_suits_sc  - 花色归并 ♥→♠、♦→♣；形成 26♠ + 26♣。
 * two_suits_hd  - 花色归并 ♠→♥、♣→♦；形成 26♥ + 26♦。
 * a_to_10       - 仅保留 A(14)、2-10，移除 J(11)/Q(12)/K(13)。
 * seven_to_a    - 仅保留 7-10, J, Q, K, A(14)，移除 2-6。
 * odd_only      - 仅保留奇数点数：A(14)、3、5、7、9、J(11)、K(13)。
 * even_only     - 仅保留偶数点数：2、4、6、8、10、Q(12)。
 * standard      - 同 buildBaseDeck()。
 */
export function buildDeckForRule(rule: DeckRule): Card[] {
  switch (rule) {
    case 'two_suits_hs': {
      // ♦→♥、♣→♠；原生牌保留原 id，归并牌加 _m 后缀
      const deck: Card[] = [];
      for (const rank of RANKS) {
        deck.push(makeCard('spades', rank));
        deck.push(makeCard('hearts', rank));
        deck.push(makeCard('spades', rank, '_m'));   // 原♣归并
        deck.push(makeCard('hearts', rank, '_m'));   // 原♦归并
      }
      return deck;
    }
    case 'two_suits_sc': {
      // ♥→♠、♦→♣
      const deck: Card[] = [];
      for (const rank of RANKS) {
        deck.push(makeCard('spades', rank));
        deck.push(makeCard('clubs', rank));
        deck.push(makeCard('spades', rank, '_m'));
        deck.push(makeCard('clubs', rank, '_m'));
      }
      return deck;
    }
    case 'two_suits_hd': {
      // ♠→♥、♣→♦
      const deck: Card[] = [];
      for (const rank of RANKS) {
        deck.push(makeCard('hearts', rank));
        deck.push(makeCard('diamonds', rank));
        deck.push(makeCard('hearts', rank, '_m'));
        deck.push(makeCard('diamonds', rank, '_m'));
      }
      return deck;
    }
    case 'a_to_10': {
      // A(14), 2-10，移除 J(11)/Q(12)/K(13)
      const allowed = RANKS.filter(r => r <= 10 || r === 14);
      const deck: Card[] = [];
      for (const suit of SUITS) {
        for (const rank of allowed) {
          deck.push(makeCard(suit, rank));
        }
      }
      return deck;
    }
    case 'seven_to_a': {
      // 7,8,9,10,J(11),Q(12),K(13),A(14)，移除 2-6
      const allowed = RANKS.filter(r => r >= 7);
      const deck: Card[] = [];
      for (const suit of SUITS) {
        for (const rank of allowed) {
          deck.push(makeCard(suit, rank));
        }
      }
      return deck;
    }
    case 'odd_only': {
      // A(14)=偶，按实际牌义：A=1奇，所以保留 A；
      // 点数 rank 值：A=14，3,5,7,9,J=11,K=13 为奇数 rank
      const allowed = RANKS.filter(r => r % 2 === 1 || r === 14);
      const deck: Card[] = [];
      for (const suit of SUITS) {
        for (const rank of allowed) {
          deck.push(makeCard(suit, rank));
        }
      }
      return deck;
    }
    case 'even_only': {
      // 偶数 rank：2,4,6,8,10,Q=12
      const allowed = RANKS.filter(r => r % 2 === 0 && r !== 14);
      const deck: Card[] = [];
      for (const suit of SUITS) {
        for (const rank of allowed) {
          deck.push(makeCard(suit, rank));
        }
      }
      return deck;
    }
    case 'standard':
    default:
      return buildBaseDeck();
  }
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
