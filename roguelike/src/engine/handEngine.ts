import { Card, HandType } from '../shared/types/poker';
import { calculateHandScore } from '../shared/utils/pokerLogic';
import { HandResult, HandTypeUpgradeMap } from '../types/run';
import upgradeConfig from '../config/runHandTypeUpgrades.json';

type BaseStats = { baseScore: number; multiplier: number };
type GrowthStats = { baseScoreDelta: number; multiplierDelta: number };

const baseStatsMap = upgradeConfig.baseStats as Record<HandType, BaseStats>;
const growthMap = upgradeConfig.perLevelGrowth as Record<HandType, GrowthStats>;

export const HAND_NAMES: Record<HandType, string> = {
  high_card:        '高牌',
  one_pair:         '一对',
  two_pairs:        '两对',
  three_of_a_kind:  '三条',
  straight:         '顺子',
  flush:            '同花',
  full_house:       '葫芦',
  four_of_a_kind:   '四条',
  five_of_a_kind:   '五条',
  six_of_a_kind:    '六条',
  seven_of_a_kind:  '七条',
  straight_flush:   '同花顺',
  royal_flush:      '皇家同花顺',
};

/** 根据当前升级等级获取牌型基础$ 和 倍率 */
export function getHandTypeStats(
  handType: HandType,
  upgradeMap: HandTypeUpgradeMap,
): BaseStats {
  const level = (upgradeMap[handType] ?? 1) - 1; // level 1 = index 0 growth
  const base = baseStatsMap[handType] ?? { baseScore: 5, multiplier: 1 };
  const growth = growthMap[handType] ?? { baseScoreDelta: 5, multiplierDelta: 0 };
  return {
    baseScore:  base.baseScore  + growth.baseScoreDelta  * level,
    multiplier: base.multiplier + growth.multiplierDelta * level,
  };
}

/**
 * 一期基础结算（无技能），供不需要技能上下文的场景使用。
 * 二期请优先用 skillEngine.evaluateHandWithSkills。
 */
export function evaluateHand(
  hand: Card[],
  upgradeMap: HandTypeUpgradeMap,
): HandResult {
  const raw = calculateHandScore(hand, hand.length);
  const { type: handType, scoringCardIds } = raw;

  const stats = getHandTypeStats(handType, upgradeMap);

  const scoringCards = hand.filter(c => scoringCardIds.includes(c.id));
  const cardScoreSum = scoringCards.reduce((s, c) => s + c.baseValue, 0)
    + stats.baseScore;

  const finalGold = Math.round(cardScoreSum * stats.multiplier);

  return {
    handType,
    handName: HAND_NAMES[handType] ?? handType,
    scoringCardIds,
    cardScoreSum,
    multiplierTotal: stats.multiplier,
    skillAddedScore: 0,
    skillAddedMultiplier: 0,
    independentMultiplier: 1,
    finalGold,
    skillLog: [],
  };
}
