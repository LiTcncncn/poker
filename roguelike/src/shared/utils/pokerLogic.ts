import { Card, HandResult, HandType, Rank, Suit } from '../types/poker';
// shared layer — copied from original project, do not modify original

// 基础分值表
const HAND_MULTIPLIERS: Record<HandType, number> = {
  high_card: 1,
  one_pair: 2,
  two_pairs: 3,
  three_of_a_kind: 3,
  straight: 5,
  flush: 7,
  full_house: 10,
  four_of_a_kind: 20,
  five_of_a_kind: 60,   // 5条
  six_of_a_kind: 300,   // 6条
  seven_of_a_kind: 300, // 7条
  straight_flush: 100,
  royal_flush: 200,
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
  five_of_a_kind: '五条',
  six_of_a_kind: '六条',
  seven_of_a_kind: '七条',
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

const evaluateResolvedHand = (resolvedCards: ResolvedCard[], cardCount: number = 5): { 
  type: HandType; 
  score: number; 
  resolvedCards: ResolvedCard[];
  scoringCards: ResolvedCard[]; // 参与计分的牌
} => {
  const cards = resolvedCards;
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const rankCounts = new Map<number, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  
  // 1-4张牌时，跳过需要5张的牌型判定
  const canHaveFlushOrStraight = cardCount === 5;
  const canHaveFourOfAKind = cardCount >= 4; // 超级4张、5张均可判定四条
  const canHaveFiveOfAKind = cardCount === 5; // 5条需要5张牌
  const canHaveSixOfAKind = cardCount === 6; // 6条需要6张牌
  const canHaveSevenOfAKind = cardCount === 7; // 7条需要7张牌
  
  const isFlush = canHaveFlushOrStraight && suits.every(s => s === suits[0]);
  const isStraightHand = canHaveFlushOrStraight && isStraight(ranks);

  let type: HandType = 'high_card';
  let scoringCards: ResolvedCard[] = resolvedCards; // 默认全部参与计分

  // 优先判断多条（7条 > 6条 > 5条 > 四条）
  if (canHaveSevenOfAKind && Array.from(rankCounts.values()).includes(7)) {
    type = 'seven_of_a_kind';
    // 7条：只计算7张相同的牌
    const sevenRank = Array.from(rankCounts.entries()).find(([_, count]) => count === 7)?.[0];
    scoringCards = resolvedCards.filter(rc => rc.rank === sevenRank);
  } else if (canHaveSixOfAKind && Array.from(rankCounts.values()).includes(6)) {
    type = 'six_of_a_kind';
    // 6条：只计算6张相同的牌
    const sixRank = Array.from(rankCounts.entries()).find(([_, count]) => count === 6)?.[0];
    scoringCards = resolvedCards.filter(rc => rc.rank === sixRank);
  } else if (canHaveFiveOfAKind && Array.from(rankCounts.values()).includes(5)) {
    type = 'five_of_a_kind';
    // 5条：只计算5张相同的牌
    const fiveRank = Array.from(rankCounts.entries()).find(([_, count]) => count === 5)?.[0];
    scoringCards = resolvedCards.filter(rc => rc.rank === fiveRank);
  } else if (canHaveFlushOrStraight && isFlush && isStraightHand) {
    if (ranks.includes(14) && ranks.includes(13)) {
        type = 'royal_flush';
    } else {
        type = 'straight_flush';
    }
    // 同花顺和皇家同花顺：全部5张参与计分
    scoringCards = resolvedCards;
  } else if (canHaveFourOfAKind && Array.from(rankCounts.values()).includes(4)) {
    type = 'four_of_a_kind';
    // 四条：只计算4张相同的牌
    const fourRank = Array.from(rankCounts.entries()).find(([_, count]) => count === 4)?.[0];
    scoringCards = resolvedCards.filter(rc => rc.rank === fourRank);
  } else if (canHaveFlushOrStraight && Array.from(rankCounts.values()).includes(3) && Array.from(rankCounts.values()).includes(2)) {
    type = 'full_house';
    // 葫芦：全部5张（三条+对子）
    scoringCards = resolvedCards;
  } else if (canHaveFlushOrStraight && isFlush) {
    type = 'flush';
    // 同花：全部5张
    scoringCards = resolvedCards;
  } else if (canHaveFlushOrStraight && isStraightHand) {
    type = 'straight';
    // 顺子：全部5张
    scoringCards = resolvedCards;
  } else if (Array.from(rankCounts.values()).includes(3)) {
    type = 'three_of_a_kind';
    // 三条：只计算3张相同的牌
    const threeRank = Array.from(rankCounts.entries()).find(([_, count]) => count === 3)?.[0];
    scoringCards = resolvedCards.filter(rc => rc.rank === threeRank);
  } else {
    const pairs = Array.from(rankCounts.entries()).filter(([_, count]) => count === 2);
    if (pairs.length === 2) {
      type = 'two_pairs';
      // 两对：只计算4张对子牌
      const pairRanks = pairs.map(([rank]) => rank);
      scoringCards = resolvedCards.filter(rc => pairRanks.includes(rc.rank));
    } else if (pairs.length === 1) {
      type = 'one_pair';
      // 一对：只计算2张对子牌
      const pairRank = pairs[0][0];
      scoringCards = resolvedCards.filter(rc => rc.rank === pairRank);
    } else {
      type = 'high_card';
      // 高牌：只计算最高的1张
      const maxRank = Math.max(...ranks);
      scoringCards = [resolvedCards.find(rc => rc.rank === maxRank)!];
    }
  }

  return { type, score: 0, resolvedCards, scoringCards };
};

// 递归生成所有可能的牌组合
const generateCombinations = (cards: Card[], index: number, currentResolved: ResolvedCard[], results: ResolvedCard[][]) => {
  if (index === cards.length) {
    results.push([...currentResolved]);
    return;
  }

  const card = cards[index];
  
  // 处理 Joker 牌：可以是任意 rank 和 suit
  if (card.isJoker) {
    // Joker 可以是任意 rank (2-14) 和任意 suit
    const allRanks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const allSuits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
    
    for (const r of allRanks) {
      for (const s of allSuits) {
        currentResolved.push({ originalCard: card, rank: r, suit: s });
        generateCombinations(cards, index + 1, currentResolved, results);
        currentResolved.pop();
      }
    }
    return;
  }
  
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

export const calculateHandScore = (cards: Card[], cardCount?: number): HandResult => {
  // 如果没有指定cardCount，使用cards.length
  const actualCardCount = cardCount ?? cards.length;
  
  // 1. 生成所有可能的已解析手牌组合
  const allPossibleResolvedHands: ResolvedCard[][] = [];
  
  if (actualCardCount > 5) {
    // 对于超过5张的情况，需要尝试所有可能的组合（5张、6张、7张）
    // 6张牌：尝试5张和6张的组合
    // 7张牌：尝试5张、6张和7张的组合
    const targetCounts: number[] = [];
    if (actualCardCount >= 5) targetCounts.push(5);
    if (actualCardCount >= 6) targetCounts.push(6);
    if (actualCardCount >= 7) targetCounts.push(7);
    
    for (const targetCount of targetCounts) {
      const allCombinations: Card[][] = [];
      const selectCards = (remaining: Card[], selected: Card[], startIndex: number) => {
        if (selected.length === targetCount) {
          allCombinations.push([...selected]);
          return;
        }
        // 如果剩余牌数不足以凑够目标张数，提前返回
        if (remaining.length - startIndex < targetCount - selected.length) {
          return;
        }
        for (let i = startIndex; i < remaining.length; i++) {
          selected.push(remaining[i]);
          selectCards(remaining, selected, i + 1);
          selected.pop();
        }
      };
      selectCards(cards, [], 0);
      
      // 对每个组合生成所有可能状态
      for (const combo of allCombinations) {
        generateCombinations(combo, 0, [], allPossibleResolvedHands);
      }
    }
  } else {
    // 5张或更少，直接生成所有可能状态
    generateCombinations(cards, 0, [], allPossibleResolvedHands);
  }

  // 2. 评估每一种组合，找到最优解
  let bestResult: { type: HandType; score: number; resolvedCards: ResolvedCard[]; scoringCards: ResolvedCard[] } | null = null;
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
    five_of_a_kind: 9,   // 5条（需要5张牌）
    six_of_a_kind: 10,   // 6条（需要6张牌）
    seven_of_a_kind: 11, // 7条（需要7张牌）
    straight_flush: 12,
    royal_flush: 13,
  };

  // 辅助函数：比较两个相同牌型的rank（不考虑效果，只比较rank本身）
  const compareRanks = (hand1: ResolvedCard[], hand2: ResolvedCard[], type: HandType): number => {
    const ranks1 = hand1.map(c => c.rank).sort((a, b) => b - a);
    const ranks2 = hand2.map(c => c.rank).sort((a, b) => b - a);
    
    const rankCounts1 = new Map<number, number>();
    ranks1.forEach(r => rankCounts1.set(r, (rankCounts1.get(r) || 0) + 1));
    const rankCounts2 = new Map<number, number>();
    ranks2.forEach(r => rankCounts2.set(r, (rankCounts2.get(r) || 0) + 1));
    
    // 根据牌型比较rank
    if (type === 'seven_of_a_kind') {
      // 7条：全部7张相同，直接比较rank
      return ranks1[0] - ranks2[0];
    } else if (type === 'six_of_a_kind') {
      // 6条：全部6张相同，直接比较rank
      return ranks1[0] - ranks2[0];
    } else if (type === 'five_of_a_kind') {
      // 5条：全部5张相同，直接比较rank
      return ranks1[0] - ranks2[0];
    } else if (type === 'four_of_a_kind') {
      const four1 = Array.from(rankCounts1.entries()).find(([_, c]) => c === 4)?.[0] || 0;
      const four2 = Array.from(rankCounts2.entries()).find(([_, c]) => c === 4)?.[0] || 0;
      if (four1 !== four2) return four1 - four2;
      // 比较单张
      const kicker1 = ranks1.find(r => r !== four1) || 0;
      const kicker2 = ranks2.find(r => r !== four2) || 0;
      return kicker1 - kicker2;
    } else if (type === 'full_house') {
      const three1 = Array.from(rankCounts1.entries()).find(([_, c]) => c === 3)?.[0] || 0;
      const three2 = Array.from(rankCounts2.entries()).find(([_, c]) => c === 3)?.[0] || 0;
      if (three1 !== three2) return three1 - three2;
      const pair1 = Array.from(rankCounts1.entries()).find(([_, c]) => c === 2)?.[0] || 0;
      const pair2 = Array.from(rankCounts2.entries()).find(([_, c]) => c === 2)?.[0] || 0;
      return pair1 - pair2;
    } else if (type === 'three_of_a_kind') {
      const three1 = Array.from(rankCounts1.entries()).find(([_, c]) => c === 3)?.[0] || 0;
      const three2 = Array.from(rankCounts2.entries()).find(([_, c]) => c === 3)?.[0] || 0;
      if (three1 !== three2) return three1 - three2;
      // 比较剩余两张
      const kickers1 = ranks1.filter(r => r !== three1).sort((a, b) => b - a);
      const kickers2 = ranks2.filter(r => r !== three2).sort((a, b) => b - a);
      for (let i = 0; i < kickers1.length; i++) {
        if (kickers1[i] !== kickers2[i]) return kickers1[i] - kickers2[i];
      }
      return 0;
    } else if (type === 'two_pairs') {
      const pairs1 = Array.from(rankCounts1.entries()).filter(([_, c]) => c === 2).map(([r]) => r).sort((a, b) => b - a);
      const pairs2 = Array.from(rankCounts2.entries()).filter(([_, c]) => c === 2).map(([r]) => r).sort((a, b) => b - a);
      for (let i = 0; i < pairs1.length; i++) {
        if (pairs1[i] !== pairs2[i]) return pairs1[i] - pairs2[i];
      }
      // 比较单张
      const kicker1 = ranks1.find(r => !pairs1.includes(r)) || 0;
      const kicker2 = ranks2.find(r => !pairs2.includes(r)) || 0;
      return kicker1 - kicker2;
    } else if (type === 'one_pair') {
      const pair1 = Array.from(rankCounts1.entries()).find(([_, c]) => c === 2)?.[0] || 0;
      const pair2 = Array.from(rankCounts2.entries()).find(([_, c]) => c === 2)?.[0] || 0;
      if (pair1 !== pair2) return pair1 - pair2;
      // 比较剩余三张
      const kickers1 = ranks1.filter(r => r !== pair1).sort((a, b) => b - a);
      const kickers2 = ranks2.filter(r => r !== pair2).sort((a, b) => b - a);
      for (let i = 0; i < kickers1.length; i++) {
        if (kickers1[i] !== kickers2[i]) return kickers1[i] - kickers2[i];
      }
      return 0;
    } else {
      // 高牌、同花、顺子等：直接比较所有rank
      for (let i = 0; i < ranks1.length; i++) {
        if (ranks1[i] !== ranks2[i]) return ranks1[i] - ranks2[i];
      }
      return 0;
    }
  };

  // 辅助函数：计算特定组合的分数（只在核算$时使用，不考虑在牌型比较中）
  const calculateSpecificScore = (resHand: { 
    type: HandType; 
    resolvedCards: ResolvedCard[];
    scoringCards: ResolvedCard[];
  }) => {
     let cardScoreSum = 0;
     let totalMultiplier = 0; // 累加倍数

     // 基础牌型倍数
     totalMultiplier += HAND_MULTIPLIERS[resHand.type];

     // 只计算参与计分的牌（scoringCards）的分数和倍数
     resHand.scoringCards.forEach(rc => {
        const card = rc.originalCard;
        
        // 超级品质直接使用 baseValue（已包含+15加成）
        let rankValue: number;
        if (card.quality === 'super') {
          rankValue = card.baseValue;
        } else {
          rankValue = getScoreValue(rc.rank); // 使用解析后的数值
          
          // 应用高分牌效果 (+5 绿色 / +10 蓝色)
          const highScoreEffect = card.effects.find(e => e.type === 'high_score');
          if (highScoreEffect && highScoreEffect.value) {
              rankValue += highScoreEffect.value;
          }
        }
        
        cardScoreSum += rankValue;

        // 应用倍数牌效果 (+2 绿色 / +4 蓝色) - 只计算参与牌型的牌的倍数
        const multiplierEffect = card.effects.find(e => e.type === 'multiplier');
        if (multiplierEffect && multiplierEffect.value) {
            totalMultiplier += multiplierEffect.value;
        }
     });

     return cardScoreSum * totalMultiplier;
  };

  for (const resolvedHand of allPossibleResolvedHands) {
    // 限制：最多只允许一张 Joker 参与计分
    const jokerCount = resolvedHand.filter(rc => rc.originalCard.isJoker).length;
    if (jokerCount > 1) {
      continue; // 跳过包含多张 Joker 的组合
    }
    
    // 评估时使用实际解析的牌数（可能是5、6或7张）
    const evalCardCount = resolvedHand.length;
    const evalResult = evaluateResolvedHand(resolvedHand, evalCardCount);
    const score = calculateSpecificScore(evalResult);

    // 比较逻辑：优先牌型大，其次rank高（不考虑效果），最后才计算分数
    if (!bestResult) {
        bestResult = { ...evalResult, score };
        maxScore = score;
    } else {
        const currentPriority = handTypePriority[evalResult.type];
        const bestPriority = handTypePriority[bestResult.type];

        if (currentPriority > bestPriority) {
            // 牌型更大，直接选择
            bestResult = { ...evalResult, score };
            maxScore = score;
        } else if (currentPriority === bestPriority) {
            // 牌型相同，比较rank（不考虑效果）
            const rankComparison = compareRanks(evalResult.resolvedCards, bestResult.resolvedCards, evalResult.type);
            if (rankComparison > 0) {
                // rank更高，选择当前组合
                bestResult = { ...evalResult, score };
                maxScore = score;
            } else if (rankComparison === 0) {
                // rank完全相同，比较分数（这种情况很少见，但保留作为最终判断）
                if (score > maxScore) {
                    bestResult = { ...evalResult, score };
                    maxScore = score;
                }
            }
            // 如果rankComparison < 0，保持bestResult不变
        }
    }
  }
  
  if (!bestResult) throw new Error("Should be at least one result");

  // 重新计算一遍最佳结果的详细数据以便返回
  // (实际上上面已经算过了，这里整理一下)
  
  let baseMultiplier = HAND_MULTIPLIERS[bestResult.type];
  let bonusMultiplier = 0;
  
  // 只计算参与牌型的牌的倍数加成和钻石奖励
  let diamondReward = 0;
  bestResult.scoringCards.forEach(rc => {
      const multiplierEffect = rc.originalCard.effects.find(e => e.type === 'multiplier');
      if (multiplierEffect && multiplierEffect.value) {
          bonusMultiplier += multiplierEffect.value;
      }
      // 钻石牌奖励：每张参与计分的钻石牌额外奖励20钻石
      if (rc.originalCard.isDiamondCard) {
          diamondReward += rc.originalCard.diamondBonus ?? 20;
      }
  });

  return {
    type: bestResult.type,
    cards: bestResult.resolvedCards.map(rc => rc.originalCard), // 返回原始卡牌
    score: bestResult.score,
    baseMultiplier,
    bonusMultiplier,
    name: HAND_NAMES[bestResult.type],
    scoringCardIds: bestResult.scoringCards.map(rc => rc.originalCard.id), // 参与计分的卡牌ID
    diamondReward: diamondReward > 0 ? diamondReward : undefined // 如果有钻石奖励则返回，否则不返回
  };
};

