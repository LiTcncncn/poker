/**
 * 扩展的成就系统，添加5张牌限制
 */

import { HandType } from '../types/poker';
import { AchievementProgress, AchievementType, checkAchievementProgress as originalCheckAchievementProgress } from './achievements';

// 需要5张牌才能计入成就的牌型
const FIVE_CARD_ONLY_TYPES: HandType[] = [
  'straight',
  'flush',
  'full_house',
  'five_of_a_kind',
  'straight_flush',
  'royal_flush'
];

/**
 * 检查成就进度（带5张牌限制）
 * @param achievementType 成就类型
 * @param count 完成次数
 * @param currentProgress 当前进度
 * @param cardCount 翻牌数量（用于检查5张牌限制）
 * @returns 更新后的成就进度
 */
export function checkAchievementProgressWithCardLimit(
  achievementType: AchievementType,
  count: number,
  currentProgress: AchievementProgress,
  cardCount?: number,
  scoringCardCount?: number
): AchievementProgress {
  // 如果是需要5张牌的牌型成就，且cardCount不是5，直接不更新成就
  if (FIVE_CARD_ONLY_TYPES.includes(achievementType as HandType)) {
    if (cardCount !== 5) {
      return currentProgress;
    }
    // 如果scoringCardCount存在且不是5，也不更新成就
    if (scoringCardCount !== undefined && scoringCardCount !== 5) {
      return currentProgress;
    }
  }
  
  // 使用原有的成就检查逻辑
  return originalCheckAchievementProgress(achievementType, count, currentProgress);
}

/**
 * 检查手牌是否可以计入成就
 * @param handType 牌型
 * @param cardCount 翻牌数量
 * @returns 是否可以计入成就
 */
export function canCountTowardsAchievement(handType: HandType, cardCount: number, scoringCardCount?: number): boolean {
  // 如果是需要5张牌的牌型
  if (FIVE_CARD_ONLY_TYPES.includes(handType)) {
    if (cardCount !== 5) return false;
    if (typeof scoringCardCount === 'number' && scoringCardCount !== 5) return false;
    return true;
  }
  
  // 其他牌型不受限制
  return true;
}

/**
 * 获取成就限制说明
 * @param handType 牌型
 * @returns 限制说明文本
 */
export function getAchievementLimitDescription(handType: HandType): string | null {
  if (FIVE_CARD_ONLY_TYPES.includes(handType)) {
    return '该成就需要由5张牌构成（4张成顺/成花不计入）';
  }
  return null;
}
