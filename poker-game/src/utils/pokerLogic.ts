import { Card, HandResult, HandType, Rank, Suit } from '../types/poker';

// 基础分值表
const HAND_MULTIPLIERS: Record<HandType, number> = {
  high_card: 1,
  one_pair: 2,
  two_pairs: 3,
  three_of_a_kind: 5,
  straight: 8,
  flush: 10,
  full_house: 12,
  four_of_a_kind: 20,
  straight_flush: 50,
  royal_flush: 100,
};

const HAND_NAMES: Record<HandType, string> = {
  high_card: '高牌',
  one_pair: '一对',
  two_pairs: '两对',
  three_of_a_kind: '三条',
  straight: '顺子',
  flush: '同花',
  full_house: '葫芦',
  four_of_a_kind: '四条',
  straight_flush: '同花顺',
  royal_flush: '皇家同花顺',
};

// 工具函数：获取牌面显示数值（2-9, 10, J, Q, K, A）
export const getRankDisplay = (rank: Rank): string => {
  if (rank <= 10) return rank.toString();
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return rank.toString();
};

// 工具函数：获取牌面计分数值 (10, J, Q, K, A 都是 10 分)
export const getScoreValue = (rank: Rank): number => {
  if (rank >= 10) return 10;
  return rank;
};

// 检查是否是顺子
const isStraight = (ranks: number[]): boolean => {
  if (ranks.length !== 5) return false;
  const sorted = [...ranks].sort((a, b) => a - b);
  
  // 特殊情况 A2345 (A=14, 但在这里可以当1用)
  // 如果是 A, 2, 3, 4, 5 -> 14, 2, 3, 4, 5
  if (sorted[4] === 14 && sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5) {
    return true;
  }

  // 普通顺子
  for (let i = 0; i < 4; i++) {
    if (sorted[i + 1] !== sorted[i] + 1) return false;
  }
  return true;
};

// 基础牌型判定（不处理特殊牌逻辑，假设传入的是已经确定的 rank 和 suit）
// 这里我们需要一种临时的卡牌结构，包含确定的 rank 和 suit
interface ResolvedCard {
  originalCard: Card;
  rank: Rank;
  suit: Suit;
}

const evaluateResolvedHand = (resolvedCards: ResolvedCard[]): { type: HandType; score: number; resolvedCards: ResolvedCard[] } => {
  const cards = resolvedCards;
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const rankCounts = new Map<number, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  
  const isFlush = suits.every(s => s === suits[0]);
  const isStraightHand = isStraight(ranks);

  let type: HandType = 'high_card';

  if (isFlush && isStraightHand) {
    if (ranks.includes(14) && ranks.includes(13)) { // A and K present in straight flush
        type = 'royal_flush';
    } else {
        type = 'straight_flush';
    }
  } else if (Array.from(rankCounts.values()).includes(4)) {
    type = 'four_of_a_kind';
  } else if (Array.from(rankCounts.values()).includes(3) && Array.from(rankCounts.values()).includes(2)) {
    type = 'full_house';
  } else if (isFlush) {
    type = 'flush';
  } else if (isStraightHand) {
    type = 'straight';
  } else if (Array.from(rankCounts.values()).includes(3)) {
    type = 'three_of_a_kind';
  } else {
    const pairs = Array.from(rankCounts.entries()).filter(([_, count]) => count === 2);
    if (pairs.length === 2) {
      type = 'two_pairs';
    } else if (pairs.length === 1) {
      type = 'one_pair';
    } else {
      type = 'high_card';
    }
  }

  return { type, score: 0, resolvedCards }; // Score calculated later
};

// 递归生成所有可能的牌组合
const generateCombinations = (cards: Card[], index: number, currentResolved: ResolvedCard[], results: ResolvedCard[][]) => {
  if (index === cards.length) {
    results.push([...currentResolved]);
    return;
  }

  const card = cards[index];
  const possibleRanks: Rank[] = [card.rank];
  const possibleSuits: Suit[] = [card.suit];

  // 处理跨数值牌
  const crossValueEffect = card.effects.find(e => e.type === 'cross_value');
  if (crossValueEffect && crossValueEffect.ranks) {
    // 如果是跨数值牌，它可以是原始数值（如果有），或者是效果中定义的数值
    // 这里假设跨数值牌本身可能没有有效的基础数值，或者基础数值也是可选项之一
    // 简单起见，如果定义了 ranks，我们就用这些 ranks。
    // 注意：通常卡牌本身有一个显示的数值，如果它也是可能的数值之一，应该包含在 effects.ranks 中
    possibleRanks.length = 0; // 清空默认
    possibleRanks.push(...crossValueEffect.ranks);
  }

  // 处理双花牌
  const doubleSuitEffect = card.effects.find(e => e.type === 'double_suit');
  if (doubleSuitEffect && doubleSuitEffect.suits) {
    possibleSuits.length = 0;
    possibleSuits.push(...doubleSuitEffect.suits);
  }

  // 笛卡尔积生成该卡牌的所有可能状态
  for (const r of possibleRanks) {
    for (const s of possibleSuits) {
      currentResolved.push({ originalCard: card, rank: r, suit: s });
      generateCombinations(cards, index + 1, currentResolved, results);
      currentResolved.pop();
    }
  }
};

export const calculateHandScore = (cards: Card[]): HandResult => {
  // 1. 生成所有可能的已解析手牌组合
  const allPossibleResolvedHands: ResolvedCard[][] = [];
  generateCombinations(cards, 0, [], allPossibleResolvedHands);

  // 2. 评估每一种组合，找到最优解
  let bestResult: { type: HandType; score: number; resolvedCards: ResolvedCard[] } | null = null;
  let maxScore = -1;

  // 牌型优先级数值（越大越好）
  const handTypePriority: Record<HandType, number> = {
    high_card: 1,
    one_pair: 2,
    two_pairs: 3,
    three_of_a_kind: 4,
    straight: 5,
    flush: 6,
    full_house: 7,
    four_of_a_kind: 8,
    straight_flush: 9,
    royal_flush: 10,
  };

  // 辅助函数：计算特定组合的分数
  const calculateSpecificScore = (resHand: { type: HandType; resolvedCards: ResolvedCard[] }) => {
     let cardScoreSum = 0;
     let totalMultiplier = 0; // 累加倍数

     // 基础牌型倍数
     totalMultiplier += HAND_MULTIPLIERS[resHand.type];

     resHand.resolvedCards.forEach(rc => {
        const card = rc.originalCard;
        let rankValue = getScoreValue(rc.rank); // 使用解析后的数值

        // 应用高分牌效果 (+3)
        if (card.effects.some(e => e.type === 'high_score')) {
            rankValue += 3;
        }
        
        cardScoreSum += rankValue;

        // 应用倍数牌效果 (+2)
        if (card.effects.some(e => e.type === 'multiplier')) {
            totalMultiplier += 2;
        }
     });

     return cardScoreSum * totalMultiplier;
  };

  for (const resolvedHand of allPossibleResolvedHands) {
    const evalResult = evaluateResolvedHand(resolvedHand);
    const score = calculateSpecificScore(evalResult);

    // 比较逻辑：优先牌型大，其次分数高
    if (!bestResult) {
        bestResult = { ...evalResult, score };
        maxScore = score;
    } else {
        const currentPriority = handTypePriority[evalResult.type];
        const bestPriority = handTypePriority[bestResult.type];

        if (currentPriority > bestPriority) {
            bestResult = { ...evalResult, score };
            maxScore = score;
        } else if (currentPriority === bestPriority) {
            if (score > maxScore) {
                bestResult = { ...evalResult, score };
                maxScore = score;
            }
        }
    }
  }
  
  if (!bestResult) throw new Error("Should be at least one result");

  // 重新计算一遍最佳结果的详细数据以便返回
  // (实际上上面已经算过了，这里整理一下)
  
  let baseMultiplier = HAND_MULTIPLIERS[bestResult.type];
  let bonusMultiplier = 0;
  
  bestResult.resolvedCards.forEach(rc => {
      if (rc.originalCard.effects.some(e => e.type === 'multiplier')) {
          bonusMultiplier += 2;
      }
  });

  return {
    type: bestResult.type,
    cards: bestResult.resolvedCards.map(rc => rc.originalCard), // 返回原始卡牌
    score: bestResult.score,
    baseMultiplier,
    bonusMultiplier,
    name: HAND_NAMES[bestResult.type]
  };
};










