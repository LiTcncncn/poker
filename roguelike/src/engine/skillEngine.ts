import { Card, HandType, Suit } from '../shared/types/poker';
import { SkillDef, SkillEffect, RuleModType } from '../types/skill';
import { HandResult, HandTypeUpgradeMap, SkillApplyLog } from '../types/run';
import {
  findColorFlush,
  findNCardFlush,
  findNCardStraight,
  findNCardEvenStraight,
  findNCardOddStraight,
  findOddStraight,
  findEvenStraight,
} from '../shared/utils/pokerLogicExtended';
import { calculateHandScore } from '../shared/utils/pokerLogic';
import { getHandTypeStats } from './handEngine';
import skillPoolData from '../config/runSkillPool.json';

export const ALL_SKILLS: SkillDef[] = skillPoolData as SkillDef[];

export function getSkillById(id: string): SkillDef | undefined {
  return ALL_SKILLS.find(s => s.id === id);
}

export function getSkillsByIds(ids: string[]): SkillDef[] {
  return ids
    .map(id => ALL_SKILLS.find(s => s.id === id))
    .filter(Boolean) as SkillDef[];
}

// ─── 牌型优先级 ─────────────────────────────────────────────────
const HAND_PRIORITY: Record<HandType, number> = {
  high_card: 1,
  one_pair: 2,
  two_pairs: 3,
  three_of_a_kind: 4,
  straight: 5,
  flush: 6,
  full_house: 7,
  four_of_a_kind: 8,
  five_of_a_kind: 9,
  six_of_a_kind: 10,
  seven_of_a_kind: 11,
  straight_flush: 12,
  royal_flush: 13,
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
const SKILL_COUNT_MULT_ID = 'skill_count_mult';
const RAINBOW_SUITS_X2_ID = 'rainbow_suits_x2';

function handPriority(ht: HandType): number {
  return HAND_PRIORITY[ht] ?? 0;
}

/** 提取已获取技能中所有激活的规则改写 */
export function getActiveRuleMods(skills: SkillDef[]): Set<RuleModType> {
  const mods = new Set<RuleModType>();
  for (const skill of skills) {
    for (const ef of skill.effects) {
      if (ef.type === 'modify_rule' && ef.ruleType) {
        mods.add(ef.ruleType);
      }
    }
  }
  return mods;
}

/** 检查 4 张牌是否同一花色 */
function isFourCardFlush(cards: Card[]): boolean {
  if (cards.length < 2) return true;
  const suit = cards[0].suit;
  return cards.every(c => c.isJoker || c.suit === suit);
}

/** 用 color-flush 规则归一化花色（保留原 ID）。
 *  双花属性牌（double_suit effect）：只要其中一个花色属于目标颜色组，就视为该颜色。
 *  注意：归一化后必须把 double_suit 收窄为单一花色，否则 calculateHandScore 仍会按双花展开，
 *  会与已写入的 suit（如统一为 ♠）冲突，导致 ♥+♣ 这类牌无法成黑色同花。
 */
function normalizeForColorFlush(cards: Card[], ruleMods: Set<RuleModType>): Card[] {
  return cards.map(c => {
    if (c.isJoker) return c;

    // 收集该牌所有可能的花色（普通牌仅 1 个，双花牌有 2 个）
    const doubleSuitEf = c.effects?.find(e => e.type === 'double_suit');
    const possibleSuits: Suit[] = (doubleSuitEf?.suits?.length)
      ? (doubleSuitEf.suits as Suit[])
      : [c.suit];

    let suit = c.suit;
    let effects = c.effects;

    if (ruleMods.has('color_flush_black') &&
        possibleSuits.some(s => s === 'spades' || s === 'clubs')) {
      suit = 'spades';
      if (doubleSuitEf?.suits?.length) {
        effects = (c.effects ?? []).map(e =>
          e.type === 'double_suit'
            ? { ...e, suits: [suit] as Suit[] }
            : e
        );
      }
    } else if (ruleMods.has('color_flush_red') &&
        possibleSuits.some(s => s === 'hearts' || s === 'diamonds')) {
      suit = 'hearts';
      if (doubleSuitEf?.suits?.length) {
        effects = (c.effects ?? []).map(e =>
          e.type === 'double_suit'
            ? { ...e, suits: [suit] as Suit[] }
            : e
        );
      }
    }
    return { ...c, suit, effects };
  });
}

/** 对一组牌判断是否为同花（用于 odd/even straight_flush 兼容） */
function isFlushHand(cards: Card[]): boolean {
  const nonJokers = cards.filter(c => !c.isJoker);
  if (nonJokers.length === 0) return true;
  const suit = nonJokers[0].suit;
  return nonJokers.every(c => c.suit === suit);
}

/** 带规则改写的牌型检测，返回最优结果 */
function detectHandType(
  hand: Card[],
  ruleMods: Set<RuleModType>,
): { handType: HandType; scoringCardIds: string[] } {
  // Step 1: 标准检测基准
  const stdRaw = calculateHandScore(hand, hand.length);
  let best: { handType: HandType; scoringCardIds: string[] } = {
    handType: stdRaw.type,
    scoringCardIds: stdRaw.scoringCardIds,
  };

  // Step 2: Color flush 规则 — 归一化花色后重新检测（兼容同花顺）
  // 约束：
  // - 黑/红成花只在 5 张牌型判定中生效
  // - 不与“四张成花”共同使用（同时拥有时以黑/红成花为准，四张成花不触发）
  if (hand.length === 5 && (ruleMods.has('color_flush_black') || ruleMods.has('color_flush_red')) && !ruleMods.has('n_card_flush_4')) {
    const normalized = normalizeForColorFlush(hand, ruleMods);
    const nr = calculateHandScore(normalized, normalized.length);
    // scoringCardIds 是归一化牌的 id，与原牌相同
    if (handPriority(nr.type) > handPriority(best.handType)) {
      best = { handType: nr.type, scoringCardIds: nr.scoringCardIds };
    }
  }

  // Step 3: 奇数成顺 / 偶数成顺（兼容同花顺）
  if (ruleMods.has('odd_straight')) {
    const oddCards = findOddStraight(hand);
    if (oddCards) {
      const ht: HandType = isFlushHand(oddCards) ? 'straight_flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: oddCards.map(c => c.id) };
      }
    }
  }
  if (ruleMods.has('even_straight')) {
    const evenCards = findEvenStraight(hand);
    if (evenCards) {
      const ht: HandType = isFlushHand(evenCards) ? 'straight_flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: evenCards.map(c => c.id) };
      }
    }
  }

  // Step 3.5: 偶数成顺 + 四张成顺 组合（支持 4/6/8/10 这种 4 张偶数序列）
  if (ruleMods.has('even_straight') && ruleMods.has('n_card_straight_4') && handPriority(best.handType) < handPriority('straight')) {
    const even4 = findNCardEvenStraight(hand, 4);
    if (even4) {
      const ht: HandType = isFourCardFlush(even4) ? 'flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: even4.map(c => c.id) };
      }
    }
  }

  // Step 3.6: 奇数成顺 + 四张成顺 组合（支持 A/3/5/7、3/5/7/9 等 4 张奇数序列）
  if (ruleMods.has('odd_straight') && ruleMods.has('n_card_straight_4') && handPriority(best.handType) < handPriority('straight')) {
    const odd4 = findNCardOddStraight(hand, 4);
    if (odd4) {
      const ht: HandType = isFourCardFlush(odd4) ? 'flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: odd4.map(c => c.id) };
      }
    }
  }

  // Step 4: 4 张成花（不兼容同花顺，只当当前不足 flush 时才检查）
  // 与黑/红成花互斥：若拥有黑/红成花，则不触发四张成花
  if (ruleMods.has('n_card_flush_4') &&
      !(ruleMods.has('color_flush_black') || ruleMods.has('color_flush_red')) &&
      handPriority(best.handType) < handPriority('flush')) {
    const fc = findNCardFlush(hand, 4);
    if (fc) {
      best = { handType: 'flush', scoringCardIds: fc.map(c => c.id) };
    }
  }

  // Step 5: 4 张成顺（不兼容同花顺）
  // 规则语义：
  // - 命中后只会在 straight / flush 之间择优（不会产生 straight_flush）
  // - 若这 4 张同时满足同花，则按 flush 结算（同花优先于顺子）
  if (ruleMods.has('n_card_straight_4')) {
    const sc = findNCardStraight(hand, 4);
    if (sc) {
      const ht: HandType = isFourCardFlush(sc) ? 'flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: sc.map(c => c.id) };
      }
    }
  }

  return best;
}

// ─── 辅助：判断牌是否满足 per-card 触发条件 ──────────────────
function cardMatchesCondition(card: Card, ef: SkillEffect): boolean {
  if (ef.triggerSuits && !ef.triggerSuits.includes(card.suit)) return false;
  if (ef.triggerRanks && !ef.triggerRanks.includes(card.rank)) return false;
  if (ef.triggerFaceCard && (card.rank < 11 || card.rank > 13)) return false;
  if (ef.triggerHighStreet && ![10, 11, 12, 13, 14].includes(card.rank)) return false;
  if (ef.triggerOdd) {
    // A(14) 视为奇数（1），其余看 rank % 2
    const isOdd = card.rank === 14 || card.rank % 2 === 1;
    if (!isOdd) return false;
  }
  if (ef.triggerEven) {
    const isEven = card.rank !== 14 && card.rank % 2 === 0;
    if (!isEven) return false;
  }
  return true;
}

/** 计分牌是否可覆盖四花色（支持 4/5 张；Joker 与双花牌均可补花色） */
function hasRainbowSuits(scoringCards: Card[]): boolean {
  if (scoringCards.length < 4) return false;
  const suits = new Set<Suit>();
  for (const card of scoringCards) {
    if (card.isJoker) {
      suits.add('spades');
      suits.add('hearts');
      suits.add('clubs');
      suits.add('diamonds');
      continue;
    }
    const doubleSuit = card.effects.find(e => e.type === 'double_suit');
    if (doubleSuit?.suits?.length) {
      for (const s of doubleSuit.suits as Suit[]) suits.add(s);
      continue;
    }
    suits.add(card.suit);
  }
  return suits.size === 4;
}

// ─── 主入口 ─────────────────────────────────────────────────────
export interface HandContext {
  hand: Card[];
  upgradeMap: HandTypeUpgradeMap;
  acquiredSkills: SkillDef[];
  skillAccumulation: Record<string, number>;
  bannedHandTypes: HandType[];
  /** 词缀：该花色牌的牌面分不计入 baseCardSum */
  bannedSuits: Suit[];
  /** 词缀：≤ 此点数的牌牌面分不计入 baseCardSum（0 = 不限制） */
  bannedRankMax: number;
  isLastHand: boolean;
  isFirstHandOfStage: boolean;
  /** 本手已用补牌次数（0 = 未补牌，用于技能触发条件） */
  drawsUsedThisHand: number;
}

export interface SkillHandResult extends HandResult {
  newAccumulation: Record<string, number>;
}

export function evaluateHandWithSkills(ctx: HandContext): SkillHandResult {
  const {
    hand,
    upgradeMap,
    acquiredSkills,
    skillAccumulation,
    bannedHandTypes,
    bannedSuits,
    bannedRankMax,
    isLastHand,
    isFirstHandOfStage,
    drawsUsedThisHand,
  } = ctx;

  const ruleMods = getActiveRuleMods(acquiredSkills);

  // ── 1. 牌型检测（带规则改写）──
  const detected = detectHandType(hand, ruleMods);
  let { handType, scoringCardIds } = detected;

  // ── 2. all_cards_score：强制全部 5 张参与计分 ──
  let expandedScoring = scoringCardIds;
  for (const skill of acquiredSkills) {
    for (const ef of skill.effects) {
      if (
        ef.type === 'all_cards_score' &&
        (!ef.triggerHandTypes || ef.triggerHandTypes.includes(handType))
      ) {
        expandedScoring = hand.map(c => c.id);
        break;
      }
    }
    if (expandedScoring.length === hand.length) break;
  }

  const scoringIdSet = new Set(expandedScoring);
  const scoringCards = hand.filter(c => scoringIdSet.has(c.id));
  const nonScoringCards = hand.filter(c => !scoringIdSet.has(c.id));

  // ── 3. 牌型禁止：计入 0 金币 ──
  if (bannedHandTypes.includes(handType)) {
    const emptyAcc: Record<string, number> = { ...skillAccumulation };
    return {
      handType,
      handName: HAND_NAMES[handType] ?? handType,
      scoringCardIds: expandedScoring,
      cardScoreSum: 0,
      multiplierTotal: 0,
      skillAddedScore: 0,
      skillAddedMultiplier: 0,
      independentMultiplier: 1,
      finalGold: 0,
      skillLog: [],
      newAccumulation: emptyAcc,
    };
  }

  // ── 4. 基础分值（牌面$ + 牌型基础$）──
  const stats = getHandTypeStats(handType, upgradeMap);
  const baseCardSum = scoringCards.reduce((s, c) => {
    if (c.isJoker) return s + c.baseValue; // Joker 不受花色/点数限制
    if (bannedSuits.length > 0 && bannedSuits.includes(c.suit)) return s;
    if (bannedRankMax > 0 && c.rank <= bannedRankMax) return s;
    return s + c.baseValue;
  }, 0);
  const cardScoreSum = baseCardSum + stats.baseScore;

  // ── 5. 技能结算 ──
  const newAccumulation: Record<string, number> = { ...skillAccumulation };
  const skillLog: SkillApplyLog[] = [];

  let skillAddedScore = 0;
  let skillAddedMultiplier = 0;
  let independentMultiplier = 1;

  const hasJoker = scoringCards.some(c => c.isJoker);

  // 判断是否是高街顺子（T/J/Q/K/A）
  const isHighStraight =
    handType === 'straight' &&
    scoringCards.length === 5 &&
    [10, 11, 12, 13, 14].every(r => scoringCards.some(c => c.rank === r));

  for (const skill of acquiredSkills) {
    for (const ef of skill.effects) {
      // 跳过 modify_rule（已在检测阶段处理）
      if (ef.type === 'modify_rule') continue;

      // ── triggerHasJoker 全局条件 ──
      if (ef.triggerHasJoker && !hasJoker) continue;

      // ── triggerHandTypes 全局条件 ──
      const handTypeMatch =
        !ef.triggerHandTypes || ef.triggerHandTypes.includes(handType);

      // ── requireLastHand ──
      if (ef.requireLastHand && !isLastHand) continue;

      // ── requireFirstHandNoHold ──
      if (ef.requireFirstHandNoHold && !(isFirstHandOfStage && drawsUsedThisHand === 0)) continue;

      // ── triggerHighStraight（用于 hand_add_multiplier 高街顺子） ──
      if (ef.triggerHighStraight && !isHighStraight) continue;

      switch (ef.type) {

        case 'add_score':
          if (handTypeMatch) {
            skillAddedScore += ef.value;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: ef.value });
          }
          break;

        case 'add_multiplier':
          if (handTypeMatch) {
            skillAddedMultiplier += ef.value;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: ef.value });
          }
          break;

        case 'hand_add_score':
          if (handTypeMatch) {
            skillAddedScore += ef.value;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: ef.value });
          }
          break;

        case 'hand_add_multiplier':
          if (handTypeMatch) {
            skillAddedMultiplier += ef.value;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: ef.value });
          }
          break;

        case 'per_scoring_card_score': {
          if (!handTypeMatch) break;
          let totalAdd = 0;
          for (const card of scoringCards) {
            if (card.isJoker) continue;
            if (cardMatchesCondition(card, ef)) totalAdd += ef.value;
          }
          if (totalAdd > 0) {
            skillAddedScore += totalAdd;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: totalAdd });
          }
          break;
        }

        case 'per_scoring_card_multiplier': {
          if (!handTypeMatch) break;
          let totalAdd = 0;
          for (const card of scoringCards) {
            if (card.isJoker) continue;
            if (cardMatchesCondition(card, ef)) totalAdd += ef.value;
          }
          if (totalAdd > 0) {
            skillAddedMultiplier += totalAdd;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: totalAdd });
          }
          break;
        }

        case 'per_non_scoring_card_multiplier': {
          const n = nonScoringCards.filter(c => !c.isJoker).length;
          if (n > 0) {
            const add = n * ef.value;
            skillAddedMultiplier += add;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: add });
          }
          break;
        }

        case 'accumulate_score': {
          // hold 触发类跳过（只由 store 管理）
          if (ef.triggerOnHold) break;

          // 判断触发条件
          let triggered = handTypeMatch;
          if (triggered && ef.triggerRanks) {
            // per-card 触发：每张符合 rank 的计分牌触发一次
            const matchCount = scoringCards.filter(
              c => !c.isJoker && ef.triggerRanks!.includes(c.rank)
            ).length;
            if (matchCount === 0) break;
            const cap = ef.accumulateCap ?? 9999;
            const prev = newAccumulation[skill.id] ?? 0;
            const grown = Math.min(prev + ef.value * matchCount, cap);
            newAccumulation[skill.id] = grown;
            skillAddedScore += grown;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: grown });
            break;
          }
          if (triggered) {
            const cap = ef.accumulateCap ?? 9999;
            const prev = newAccumulation[skill.id] ?? 0;
            const grown = Math.min(prev + ef.value, cap);
            newAccumulation[skill.id] = grown;
            skillAddedScore += grown;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: grown });
          }
          break;
        }

        case 'accumulate_multiplier': {
          if (ef.triggerOnHold) {
            // Hold 触发型：直接加上当前累积量
            const acc = newAccumulation[skill.id] ?? 0;
            if (acc > 0) {
              skillAddedMultiplier += acc;
              skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: acc });
            }
            break;
          }
          // 非 hold 触发的累积倍率（若有）
          if (handTypeMatch) {
            const cap = ef.accumulateCap ?? 9999;
            const prev = newAccumulation[skill.id] ?? 0;
            const grown = Math.min(prev + ef.value, cap);
            newAccumulation[skill.id] = grown;
            skillAddedMultiplier += grown;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: grown });
          }
          break;
        }

        case 'independent_multiply': {
          if (!handTypeMatch) break;
          independentMultiplier *= ef.value;
          skillLog.push({ skillId: skill.id, skillName: skill.name, multiplyFactor: ef.value });
          break;
        }

        default:
          break;
      }
    }
  }

  // ── 5.5 特殊技能：每拥有 1 个技能 +1 倍（包含该技能自身） ──
  if (acquiredSkills.some(s => s.id === SKILL_COUNT_MULT_ID)) {
    const add = acquiredSkills.length;
    if (add > 0) {
      skillAddedMultiplier += add;
      const skill = acquiredSkills.find(s => s.id === SKILL_COUNT_MULT_ID);
      skillLog.push({
        skillId: SKILL_COUNT_MULT_ID,
        skillName: skill?.name ?? '技能数加倍率',
        addedMultiplier: add,
      });
    }
  }

  // ── 5.6 特殊技能：计分牌四花色（4/5 张）时独立 ×2 ──
  if (acquiredSkills.some(s => s.id === RAINBOW_SUITS_X2_ID) && hasRainbowSuits(scoringCards)) {
    independentMultiplier *= 2;
    const skill = acquiredSkills.find(s => s.id === RAINBOW_SUITS_X2_ID);
    skillLog.push({
      skillId: RAINBOW_SUITS_X2_ID,
      skillName: skill?.name ?? '四色同堂翻倍',
      multiplyFactor: 2,
    });
  }

  // ── 6. 属性牌 multiplier 效果（card.multiplier > 0 的计分牌） ──
  for (const card of scoringCards) {
    if (!card.isJoker && card.multiplier > 0) {
      skillAddedMultiplier += card.multiplier;
      skillLog.push({
        skillId: `attrcard_${card.id}`,
        skillName: '属性牌',
        addedMultiplier: card.multiplier,
      });
    }
  }

  // ── 7. 最终金币 ──
  const multiplierTotal = stats.multiplier + skillAddedMultiplier;
  const finalGold = Math.round(
    (cardScoreSum + skillAddedScore) * multiplierTotal * independentMultiplier
  );

  return {
    handType,
    handName: HAND_NAMES[handType] ?? handType,
    scoringCardIds: expandedScoring,
    cardScoreSum,
    multiplierTotal,
    skillAddedScore,
    skillAddedMultiplier,
    independentMultiplier,
    finalGold,
    skillLog,
    newAccumulation,
  };
}

/** hold 时更新 hold 触发型技能的累积量 */
export function applyHoldSkillAccumulation(
  skills: SkillDef[],
  heldCards: Card[],
  currentAccumulation: Record<string, number>,
): Record<string, number> {
  const next = { ...currentAccumulation };
  const heldCount = heldCards.length;

  for (const skill of skills) {
    for (const ef of skill.effects) {
      if (ef.type !== 'accumulate_multiplier' || !ef.triggerOnHold) continue;
      const cap = ef.accumulateCap ?? 9999;
      let delta = 0;
      if (ef.triggerHoldRank !== undefined) {
        delta = heldCards.filter(c => !c.isJoker && c.rank === ef.triggerHoldRank).length * ef.value;
      } else if (ef.triggerHoldCountExact !== undefined) {
        delta = heldCount === ef.triggerHoldCountExact ? ef.value : 0;
      }
      if (delta > 0) {
        const prev = next[skill.id] ?? 0;
        next[skill.id] = Math.min(prev + delta, cap);
      }
    }
  }
  return next;
}
