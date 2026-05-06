/**
 * 扩展的牌型判断逻辑，支持特殊规则
 */

import { Card, HandResult, HandType, Rank, Suit } from '../types/poker';
import { calculateHandScore, getScoreValue } from './pokerLogic';

/** 同花判定用：双花牌可取 effect 中的花色，否则为牌面 suit */
function getPossibleSuitsForFlush(card: Card): Suit[] {
  const doubleSuit = card.effects.find(e => e.type === 'double_suit');
  if (doubleSuit && doubleSuit.suits?.length) {
    return doubleSuit.suits as Suit[];
  }
  return [card.suit];
}

// 检查是否是n张顺子（n < 5），支持Joker
// 返回组成顺子的牌，如果不存在则返回null
export function findNCardStraight(cards: Card[], n: number): Card[] | null {
  if (cards.length < n) return null;
  
  // 分离Joker和非Joker牌
  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const jokerCount = jokerCards.length;
  
  // 如果没有Joker，使用原来的逻辑
  if (jokerCount === 0) {
    // 为每张牌收集所有可能的rank（包括跨数值牌的所有可能rank）
    const cardPossibleRanks: Map<Card, Rank[]> = new Map();
    nonJokerCards.forEach(card => {
      const crossValueEffect = card.effects.find(e => e.type === 'cross_value');
      if (crossValueEffect && crossValueEffect.ranks) {
        // 跨数值牌：使用所有可能的rank
        cardPossibleRanks.set(card, [...crossValueEffect.ranks]);
      } else {
        // 普通牌：使用原始rank
        cardPossibleRanks.set(card, [card.rank]);
      }
    });
    
    // 尝试所有可能的n张连续序列
    for (let startRank = 2; startRank <= 14 - n + 1; startRank++) {
      const straightRanks: Rank[] = [];
      for (let i = 0; i < n; i++) {
        straightRanks.push((startRank + i) as Rank);
      }
      
      // 检查这个序列是否可以用现有牌组成（每张牌只能使用一次）
      const usedCards: Card[] = [];
      const usedRanks = new Set<Rank>();
      
      for (const targetRank of straightRanks) {
        // 查找能提供这个rank的牌（优先使用普通牌，避免跨数值牌被重复使用）
        let found = false;
        
        // 先尝试普通牌（非跨数值牌）
        for (const card of nonJokerCards) {
          if (usedCards.includes(card)) continue;
          const possibleRanks = cardPossibleRanks.get(card) || [];
          if (possibleRanks.length === 1 && possibleRanks[0] === targetRank) {
            usedCards.push(card);
            usedRanks.add(targetRank);
            found = true;
            break;
          }
        }
        
        // 如果普通牌没找到，尝试跨数值牌
        if (!found) {
          for (const card of nonJokerCards) {
            if (usedCards.includes(card)) continue;
            const possibleRanks = cardPossibleRanks.get(card) || [];
            if (possibleRanks.includes(targetRank)) {
              usedCards.push(card);
              usedRanks.add(targetRank);
              found = true;
              break;
            }
          }
        }
        
        if (!found) break;
      }
      
      // 如果找到了n张牌，返回结果
      if (usedCards.length === n && usedRanks.size === n) {
        return usedCards;
      }
    }
    
    // 特殊情况 A234（A可以当1用）- 需要检查跨数值牌
    if (n === 4) {
      const a234Ranks: Rank[] = [14, 2, 3, 4];
      const usedCards: Card[] = [];
      for (const targetRank of a234Ranks) {
        let found = false;
        for (const card of nonJokerCards) {
          if (usedCards.includes(card)) continue;
          const possibleRanks = cardPossibleRanks.get(card) || [];
          if (possibleRanks.includes(targetRank)) {
            usedCards.push(card);
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      if (usedCards.length === 4) {
        return usedCards;
      }
    }
    if (n === 3) {
      const a23Ranks: Rank[] = [14, 2, 3];
      const usedCards: Card[] = [];
      for (const targetRank of a23Ranks) {
        let found = false;
        for (const card of nonJokerCards) {
          if (usedCards.includes(card)) continue;
          const possibleRanks = cardPossibleRanks.get(card) || [];
          if (possibleRanks.includes(targetRank)) {
            usedCards.push(card);
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      if (usedCards.length === 3) {
        return usedCards;
      }
    }
    
    return null;
  }
  
  // 有Joker的情况：尝试所有可能的n张连续序列
  // 例如：4张成顺，尝试 2-3-4-5, 3-4-5-6, ..., 10-11-12-13, 11-12-13-14
  for (let startRank = 2; startRank <= 14 - n + 1; startRank++) {
    const straightRanks: Rank[] = [];
    for (let i = 0; i < n; i++) {
      straightRanks.push((startRank + i) as Rank);
    }
    
    // 检查这个序列是否可以用现有牌+Joker组成
    let neededJokers = 0;
    const usedCards: Card[] = [];
    for (const rank of straightRanks) {
      const card = nonJokerCards.find(c => c.rank === rank);
      if (card) {
        usedCards.push(card);
      } else {
        neededJokers++;
      }
    }
    
    if (neededJokers <= jokerCount) {
      // 返回组成顺子的牌（非Joker牌 + 需要的Joker）
      const result = [...usedCards];
      for (let i = 0; i < neededJokers; i++) {
        result.push(jokerCards[i]);
      }
      return result.length === n ? result : null;
    }
  }
  
  // 特殊情况：A234（A可以当1用，即14-2-3-4）
  if (n === 4) {
    const a234Ranks: Rank[] = [14, 2, 3, 4];
    let neededJokers = 0;
    const usedCards: Card[] = [];
    for (const rank of a234Ranks) {
      const card = nonJokerCards.find(c => c.rank === rank);
      if (card) {
        usedCards.push(card);
      } else {
        neededJokers++;
      }
    }
    if (neededJokers <= jokerCount) {
      const result = [...usedCards];
      for (let i = 0; i < neededJokers; i++) {
        result.push(jokerCards[i]);
      }
      return result.length === n ? result : null;
    }
  }
  
  // 特殊情况：A23（A可以当1用，即14-2-3）
  if (n === 3) {
    const a23Ranks: Rank[] = [14, 2, 3];
    let neededJokers = 0;
    const usedCards: Card[] = [];
    for (const rank of a23Ranks) {
      const card = nonJokerCards.find(c => c.rank === rank);
      if (card) {
        usedCards.push(card);
      } else {
        neededJokers++;
      }
    }
    if (neededJokers <= jokerCount) {
      const result = [...usedCards];
      for (let i = 0; i < neededJokers; i++) {
        result.push(jokerCards[i]);
      }
      return result.length === n ? result : null;
    }
  }
  
  return null;
}

// 兼容性函数：检查是否是n张顺子
export function isNCardStraight(cards: Card[], n: number): boolean {
  return findNCardStraight(cards, n) !== null;
}

// 检查是否是n张同花（n < 5），支持Joker、双花牌（可选两种花色之一计入同花）
// 返回组成同花的牌，如果不存在则返回null
export function findNCardFlush(cards: Card[], n: number): Card[] | null {
  if (cards.length < n) return null;
  
  // 分离Joker和非Joker牌
  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const jokerCount = jokerCards.length;
  
  // 如果全是Joker，可以组成任意同花（选择第一个花色）
  if (nonJokerCards.length === 0 && jokerCount >= n) {
    return jokerCards.slice(0, n);
  }

  const allSuits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  let bestSuit: Suit | null = null;
  let maxNonJokerForBest = -1;

  // 对每个目标花色：统计「可视为该花色」的牌（含双花牌的两种可能）
  for (const suit of allSuits) {
    const suitCards = nonJokerCards.filter(c => getPossibleSuitsForFlush(c).includes(suit));
    const totalCount = suitCards.length + jokerCount;
    if (totalCount >= n && suitCards.length > maxNonJokerForBest) {
      maxNonJokerForBest = suitCards.length;
      bestSuit = suit;
    }
  }

  if (bestSuit === null) return null;

  const maxCards = nonJokerCards.filter(c => getPossibleSuitsForFlush(c).includes(bestSuit!));

  if (maxCards.length >= n) {
    return maxCards.slice(0, n);
  }
  const result = [...maxCards];
  const neededJokers = n - result.length;
  for (let i = 0; i < neededJokers && i < jokerCards.length; i++) {
    result.push(jokerCards[i]);
  }
  return result.length === n ? result : null;
}

// 兼容性函数：检查是否是n张同花
export function isNCardFlush(cards: Card[], n: number): boolean {
  return findNCardFlush(cards, n) !== null;
}

// 检查是否是奇数顺子（所有牌都是奇数），支持Joker
// 返回组成奇数顺子的牌，如果不存在则返回null
export function findOddStraight(cards: Card[]): Card[] | null {
  if (cards.length !== 5) return null;
  
  // 分离Joker和非Joker牌
  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const jokerCount = jokerCards.length;
  const nonJokerRanks = nonJokerCards.map(c => c.rank);
  
  // 检查所有非Joker牌是否都是奇数（A视为奇数）
  const isOdd = (r: Rank) => {
    if (r === 14) return true; // A视为奇数
    return r % 2 === 1;
  };
  const allOdd = nonJokerRanks.every(isOdd);
  if (!allOdd) return null;
  
  // 检查是否可以用这些奇数rank+Joker组成顺子
  // 奇数顺子可能的序列：
  // 1. 标准顺子（如 23456）- 但需要都是奇数，所以只有 3579J 或 579JK 等
  // 2. 纯奇数顺子（间隔为2，如 3579J）
  // 3. A3579（A当1用）
  
  // 首先检查是否是标准顺子（但要求都是奇数）
  for (let startRank = 2; startRank <= 14 - 5 + 1; startRank++) {
    const straightRanks: Rank[] = [];
    for (let i = 0; i < 5; i++) {
      straightRanks.push((startRank + i) as Rank);
    }
    
    // 检查这个序列是否都是奇数
    const allOddInStraight = straightRanks.every(r => {
      if (r === 14) return true; // A视为奇数
      return r % 2 === 1;
    });
    
    if (allOddInStraight) {
      let neededJokers = 0;
      const usedCards: Card[] = [];
      for (const rank of straightRanks) {
        const card = nonJokerCards.find(c => c.rank === rank);
        if (card) {
          usedCards.push(card);
        } else {
          neededJokers++;
        }
      }
      if (neededJokers <= jokerCount) {
        // 返回组成顺子的牌（非Joker牌 + 需要的Joker）
        const result = [...usedCards];
        for (let i = 0; i < neededJokers; i++) {
          result.push(jokerCards[i]);
        }
        return result.length === 5 ? result : null;
      }
    }
  }
  
  // 特殊情况：A3579（A当1用，即1-3-5-7-9，但1在系统中是14）
  // 检查 A(14)-3-5-7-9 序列
  const a3579Ranks: Rank[] = [14, 3, 5, 7, 9];
  let neededJokers = 0;
  const usedCards: Card[] = [];
  for (const rank of a3579Ranks) {
    const card = nonJokerCards.find(c => c.rank === rank);
    if (card) {
      usedCards.push(card);
    } else {
      neededJokers++;
    }
  }
  if (neededJokers <= jokerCount) {
    const result = [...usedCards];
    for (let i = 0; i < neededJokers; i++) {
      result.push(jokerCards[i]);
    }
    return result.length === 5 ? result : null;
  }
  
  // 检查纯奇数顺子（间隔为2）：3-5-7-9-J, 5-7-9-J-K
  const oddRanks1: Rank[] = [3, 5, 7, 9, 11]; // 3-5-7-9-J
  neededJokers = 0;
  const usedCards1: Card[] = [];
  for (const rank of oddRanks1) {
    const card = nonJokerCards.find(c => c.rank === rank);
    if (card) {
      usedCards1.push(card);
    } else {
      neededJokers++;
    }
  }
  if (neededJokers <= jokerCount) {
    const result = [...usedCards1];
    for (let i = 0; i < neededJokers; i++) {
      result.push(jokerCards[i]);
    }
    return result.length === 5 ? result : null;
  }
  
  const oddRanks2: Rank[] = [5, 7, 9, 11, 13]; // 5-7-9-J-K
  neededJokers = 0;
  const usedCards2: Card[] = [];
  for (const rank of oddRanks2) {
    const card = nonJokerCards.find(c => c.rank === rank);
    if (card) {
      usedCards2.push(card);
    } else {
      neededJokers++;
    }
  }
  if (neededJokers <= jokerCount) {
    const result = [...usedCards2];
    for (let i = 0; i < neededJokers; i++) {
      result.push(jokerCards[i]);
    }
    return result.length === 5 ? result : null;
  }
  
  return null;
}

// 兼容性函数：检查是否是奇数顺子
export function isOddStraight(cards: Card[]): boolean {
  return findOddStraight(cards) !== null;
}

/** 每张牌可能的 rank（含跨数值牌），用于偶数顺子匹配 */
function buildCardPossibleRanksForStraight(nonJokerCards: Card[]): Map<Card, Rank[]> {
  const map = new Map<Card, Rank[]>();
  nonJokerCards.forEach(card => {
    const cross = card.effects.find(e => e.type === 'cross_value');
    if (cross && cross.ranks?.length) {
      map.set(card, [...cross.ranks]);
    } else {
      map.set(card, [card.rank]);
    }
  });
  return map;
}

/**
 * 按目标 rank 序列匹配手牌（优先单 rank 牌，再跨数值牌），不足用 Joker 补
 * 要求 targetRanks 全为偶数且不含 A（偶数成顺规则）
 */
function tryMatchEvenStraightSequence(
  nonJokerCards: Card[],
  cardPossibleRanks: Map<Card, Rank[]>,
  targetRanks: Rank[],
  jokerCards: Card[]
): Card[] | null {
  if (targetRanks.length !== 5) return null;
  if (!targetRanks.every(r => r !== 14 && r % 2 === 0)) return null;

  const jokerCount = jokerCards.length;
  let neededJokers = 0;
  const usedCards: Card[] = [];

  for (const targetRank of targetRanks) {
    let found = false;
    for (const card of nonJokerCards) {
      if (usedCards.includes(card)) continue;
      const pr = cardPossibleRanks.get(card) || [];
      if (pr.length === 1 && pr[0] === targetRank) {
        usedCards.push(card);
        found = true;
        break;
      }
    }
    if (!found) {
      for (const card of nonJokerCards) {
        if (usedCards.includes(card)) continue;
        const pr = cardPossibleRanks.get(card) || [];
        if (pr.includes(targetRank)) {
          usedCards.push(card);
          found = true;
          break;
        }
      }
    }
    if (!found) neededJokers++;
  }

  if (neededJokers > jokerCount) return null;
  const result = [...usedCards];
  for (let i = 0; i < neededJokers; i++) {
    result.push(jokerCards[i]);
  }
  return result.length === 5 ? result : null;
}

// 检查是否是偶数顺子（所有牌都是偶数），支持Joker、跨数值牌
// 返回组成偶数顺子的牌，如果不存在则返回null
export function findEvenStraight(cards: Card[]): Card[] | null {
  if (cards.length !== 5) return null;

  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const cardPossibleRanks = buildCardPossibleRanksForStraight(nonJokerCards);

  // 偶数顺子可能的序列：2-4-6-8-10、4-6-8-10-Q(12)；A 不参与
  // 标准连续 5 张不可能全为偶数，仍保留循环以便规则扩展
  for (let startRank = 2; startRank <= 12 - 5 + 1; startRank++) {
    const straightRanks: Rank[] = [];
    for (let i = 0; i < 5; i++) {
      straightRanks.push((startRank + i) as Rank);
    }
    const allEvenInStraight = straightRanks.every(r => r !== 14 && r % 2 === 0);
    if (allEvenInStraight) {
      const matched = tryMatchEvenStraightSequence(
        nonJokerCards,
        cardPossibleRanks,
        straightRanks,
        jokerCards
      );
      if (matched) return matched;
    }
  }

  const evenRanks1: Rank[] = [2, 4, 6, 8, 10];
  const m1 = tryMatchEvenStraightSequence(nonJokerCards, cardPossibleRanks, evenRanks1, jokerCards);
  if (m1) return m1;

  const evenRanks2: Rank[] = [4, 6, 8, 10, 12];
  const m2 = tryMatchEvenStraightSequence(nonJokerCards, cardPossibleRanks, evenRanks2, jokerCards);
  if (m2) return m2;

  return null;
}

// 兼容性函数：检查是否是偶数顺子
export function isEvenStraight(cards: Card[]): boolean {
  return findEvenStraight(cards) !== null;
}

/**
 * N 张偶数成顺（用于与“四张成顺”组合）。
 * - n=4：允许 4/6/8/10（或 2/4/6/8 等）这种“间隔为2”的偶数序列
 * - 支持 Joker、跨数值牌（cross_value）
 */
export function findNCardEvenStraight(cards: Card[], n: number): Card[] | null {
  if (n < 2 || cards.length < n) return null;

  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const cardPossibleRanks = buildCardPossibleRanksForStraight(nonJokerCards);

  const sequences: Rank[][] = [
    [2, 4, 6, 8, 10],
    [4, 6, 8, 10, 12],
  ];

  for (const seq of sequences) {
    // 滑窗取 n 张
    for (let i = 0; i <= seq.length - n; i++) {
      const target = seq.slice(i, i + n) as Rank[];

      const used: Card[] = [];
      let neededJokers = 0;

      for (const tr of target) {
        let found = false;
        // 先找“唯一匹配”的牌（避免抢占）
        for (const card of nonJokerCards) {
          if (used.includes(card)) continue;
          const pr = cardPossibleRanks.get(card) || [];
          if (pr.length === 1 && pr[0] === tr) {
            used.push(card);
            found = true;
            break;
          }
        }
        if (!found) {
          for (const card of nonJokerCards) {
            if (used.includes(card)) continue;
            const pr = cardPossibleRanks.get(card) || [];
            if (pr.includes(tr)) {
              used.push(card);
              found = true;
              break;
            }
          }
        }
        if (!found) neededJokers++;
      }

      if (neededJokers <= jokerCards.length) {
        const result = [...used, ...jokerCards.slice(0, neededJokers)];
        if (result.length === n) return result;
      }
    }
  }

  return null;
}

/**
 * N 张奇数成顺（用于与“四张成顺”组合）。
 * - n=4：允许 A/3/5/7、3/5/7/9、5/7/9/J(11) 这种“间隔为2”的奇数序列
 * - 支持 Joker、跨数值牌（cross_value）
 */
export function findNCardOddStraight(cards: Card[], n: number): Card[] | null {
  if (n < 2 || cards.length < n) return null;

  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const cardPossibleRanks = buildCardPossibleRanksForStraight(nonJokerCards);

  const sequences: Rank[][] = [
    [14, 3, 5, 7, 9],     // A 视为奇数（1），序列给一个 A 版本
    [3, 5, 7, 9, 11],     // 3-5-7-9-J
    [5, 7, 9, 11, 13],    // 5-7-9-J-K
  ];

  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - n; i++) {
      const target = seq.slice(i, i + n) as Rank[];

      const used: Card[] = [];
      let neededJokers = 0;

      for (const tr of target) {
        let found = false;
        // 先找“唯一匹配”的牌（避免抢占）
        for (const card of nonJokerCards) {
          if (used.includes(card)) continue;
          const pr = cardPossibleRanks.get(card) || [];
          if (pr.length === 1 && pr[0] === tr) {
            used.push(card);
            found = true;
            break;
          }
        }
        if (!found) {
          for (const card of nonJokerCards) {
            if (used.includes(card)) continue;
            const pr = cardPossibleRanks.get(card) || [];
            if (pr.includes(tr)) {
              used.push(card);
              found = true;
              break;
            }
          }
        }
        if (!found) neededJokers++;
      }

      if (neededJokers <= jokerCards.length) {
        const result = [...used, ...jokerCards.slice(0, neededJokers)];
        if (result.length === n) return result;
      }
    }
  }

  return null;
}

// 检查是否满足花色限制，支持Joker
// 返回组成颜色同花的牌，如果不存在则返回null
export function findColorFlush(cards: Card[], color: 'red' | 'black'): Card[] | null {
  if (cards.length !== 5) return null;
  
  const redSuits: Suit[] = ['hearts', 'diamonds'];
  const blackSuits: Suit[] = ['spades', 'clubs'];
  
  const targetSuits = color === 'red' ? redSuits : blackSuits;
  
  // 分离Joker和非Joker牌
  const jokerCards = cards.filter(c => c.isJoker);
  const nonJokerCards = cards.filter(c => !c.isJoker);
  const jokerCount = jokerCards.length;
  
  // 如果全是Joker，可以组成任意颜色同花
  if (nonJokerCards.length === 0 && jokerCount === 5) {
    return jokerCards;
  }
  
  // 检查所有非Joker牌是否都“可被视为”目标颜色
  // 兼容双花牌（double_suit）：只要它的可选花色里存在目标颜色即可
  const canBeTargetColor = (card: Card): boolean => {
    const doubleSuit = card.effects.find(e => e.type === 'double_suit');
    const possibleSuits: Suit[] =
      doubleSuit && doubleSuit.suits?.length ? (doubleSuit.suits as Suit[]) : [card.suit];
    return possibleSuits.some(s => targetSuits.includes(s));
  };
  const allTargetColor = nonJokerCards.every(canBeTargetColor);
  if (!allTargetColor) return null;
  
  // 颜色同花：只要所有牌都是目标颜色即可，不需要同一花色
  // 例如：3张♥️ + 2张♦️ = 红色同花 ✓
  // 例如：5张♥️ = 红色同花 ✓
  // 例如：4张♥️ + 1张♦️ = 红色同花 ✓
  if (nonJokerCards.length + jokerCount >= 5) {
    // 返回所有非Joker牌 + 需要的Joker（Joker 可视为任意花色）
    const result = [...nonJokerCards];
    const neededJokers = 5 - nonJokerCards.length;
    for (let i = 0; i < neededJokers && i < jokerCards.length; i++) {
      result.push(jokerCards[i]);
    }
    return result.length === 5 ? result : null;
  }
  
  return null;
}

// 兼容性函数：检查是否满足花色限制
export function isColorFlush(cards: Card[], color: 'red' | 'black'): boolean {
  return findColorFlush(cards, color) !== null;
}

// 检查是否成顺子（标准规则）
function isStandardStraight(ranks: Rank[]): boolean {
  if (ranks.length !== 5) return false;
  
  const sorted = [...ranks].sort((a, b) => a - b);
  
  // 特殊情况 A2345
  if (sorted[4] === 14 && sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5) {
    return true;
  }
  
  // 普通顺子
  for (let i = 0; i < 4; i++) {
    if (sorted[i + 1] !== sorted[i] + 1) return false;
  }
  return true;
}

// 辅助函数：单张牌计分基数（与 pokerLogic 一致，跨数值牌取最大可能数值）
function getCardScoreBase(card: Card): number {
  if (card.quality === 'super') {
    return card.baseValue;
  }
  const crossValueEffect = card.effects.find(e => e.type === 'cross_value');
  if (crossValueEffect?.ranks?.length) {
    // 跨数值牌：计分时取可选数值中的最大者（与标准评估中 resolved rank 取最优一致）
    const maxRank = Math.max(...crossValueEffect.ranks) as Rank;
    return getScoreValue(maxRank);
  }
  return getScoreValue(card.rank);
}

/** 按参与计分的牌汇总钻石奖励（与 pokerLogic.calculateHandScore 规则一致；`diamondBonus` 缺省按 20） */
export function diamondRewardForScoringCardIds(allCards: Card[], scoringCardIds: string[]): number {
  if (!scoringCardIds.length) return 0;
  const idSet = new Set(scoringCardIds);
  let sum = 0;
  for (const card of allCards) {
    if (!idSet.has(card.id)) continue;
    if (card.isDiamondCard) {
      sum += card.diamondBonus ?? 20;
    }
  }
  return sum;
}

// 辅助函数：重新计算分数（当牌型被特殊规则改变时）
function recalculateScore(cards: Card[], baseMultiplier: number, bonusMultiplier: number): number {
  let cardScoreSum = 0;
  cards.forEach(card => {
    let rankValue = getCardScoreBase(card);
    if (card.quality !== 'super') {
      const highScoreEffect = card.effects.find(e => e.type === 'high_score');
      if (highScoreEffect?.value) {
        rankValue += highScoreEffect.value;
      }
    }
    cardScoreSum += rankValue;
  });
  return cardScoreSum * (baseMultiplier + bonusMultiplier);
}
