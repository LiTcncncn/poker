import { Card, HandType, Suit } from '../shared/types/poker';
import { SkillDef, SkillEffect, RuleModType, SkillEnhancement } from '../types/skill';
import { HandResult, HandTypeUpgradeMap, SkillApplyLog } from '../types/run';
import {
  diamondRewardForScoringCardIds,
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
/** 「Joker几率+」技能 id */
export const JOKER_RATE_SKILL_ID = 'joker_rate';
/** 「JOKER 成双」：一手牌允许至多 2 张 Joker 参与计分组合（与 `capJokersInHand` / `calculateHandScore` 一致） */
export const JOKER_DOUBLE_SKILL_ID = 'joker_double';
/** 「技能数加倍」技能 id（牌面/详情用） */
export const SKILL_COUNT_MULT_ID = 'skill_count_mult';
/** 技能数加倍：每个已拥有技能贡献的额外倍率（加算层）；总贡献 = 技能数 × 本值，不设单独上限 */
export const SKILL_COUNT_MULT_PER_SKILL = 3;
const RAINBOW_SUITS_X2_ID = 'rainbow_suits_x2';
/** 超级牌乘倍：独立乘区因子上限（1 + 张数×增量 不超过此值） */
const SUPER_CARD_INDEPENDENT_MULT_CAP = 2.5;

function handPriority(ht: HandType): number {
  return HAND_PRIORITY[ht] ?? 0;
}

/** 由最终结算牌型推导“可视为包含”的子牌型集合 */
function getContainedHandTypes(handType: HandType): Set<HandType> {
  const contained = new Set<HandType>([handType]);
  switch (handType) {
    case 'two_pairs':
      contained.add('one_pair');
      break;
    case 'three_of_a_kind':
      contained.add('one_pair');
      break;
    case 'full_house':
      contained.add('three_of_a_kind');
      contained.add('two_pairs');
      contained.add('one_pair');
      break;
    case 'four_of_a_kind':
      contained.add('three_of_a_kind');
      contained.add('one_pair');
      break;
    case 'five_of_a_kind':
      contained.add('four_of_a_kind');
      contained.add('three_of_a_kind');
      contained.add('one_pair');
      break;
    case 'six_of_a_kind':
      contained.add('five_of_a_kind');
      contained.add('four_of_a_kind');
      contained.add('three_of_a_kind');
      contained.add('one_pair');
      break;
    case 'seven_of_a_kind':
      contained.add('six_of_a_kind');
      contained.add('five_of_a_kind');
      contained.add('four_of_a_kind');
      contained.add('three_of_a_kind');
      contained.add('one_pair');
      break;
    case 'straight_flush':
      contained.add('straight');
      contained.add('flush');
      break;
    case 'royal_flush':
      contained.add('straight_flush');
      contained.add('straight');
      contained.add('flush');
      break;
    default:
      break;
  }
  return contained;
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
 *  若同时持有黑色成花 + 红色成花：不能在同一遍里用 if/else if（跨色双花会先被固定成黑，破坏红同花），
 *  由 detectHandType 分别用「仅黑」「仅红」规则集各算一次再择优。
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

/**
 * 四张成花仅按字面 4 同花判定。
 * 黑/红成花（color_flush_*）限定在 5 张成花路径，不参与 n_card_flush_4，避免组合过强。
 */
function findBestFourFlushForRules(hand: Card[]): Card[] | null {
  return findNCardFlush(hand, 4);
}

/** 带规则改写的牌型检测，返回最优结果 */
function detectHandType(
  hand: Card[],
  ruleMods: Set<RuleModType>,
  maxJokersInScoring: number,
): { handType: HandType; scoringCardIds: string[] } {
  const scoreOpts = { maxJokersInScoring };
  // Step 1: 标准检测基准
  const stdRaw = calculateHandScore(hand, hand.length, scoreOpts);
  let best: { handType: HandType; scoringCardIds: string[] } = {
    handType: stdRaw.type,
    scoringCardIds: stdRaw.scoringCardIds,
  };

  // Step 2: Color flush 规则 — 归一化花色后重新检测（兼容同花顺）
  // 可与四张成花共存：先尝试 5 张色组成花/同花顺；不足时再交给 Step 4 用四张规则补判。
  if (hand.length === 5 && (ruleMods.has('color_flush_black') || ruleMods.has('color_flush_red'))) {
    const hasBlack = ruleMods.has('color_flush_black');
    const hasRed = ruleMods.has('color_flush_red');

    const pickBetterColorFlushResult = (
      a: ReturnType<typeof calculateHandScore>,
      b: ReturnType<typeof calculateHandScore>,
    ): ReturnType<typeof calculateHandScore> => {
      const pa = handPriority(a.type);
      const pb = handPriority(b.type);
      if (pb > pa) return b;
      if (pa > pb) return a;
      return b.score > a.score ? b : a;
    };

    let nr: ReturnType<typeof calculateHandScore>;
    if (hasBlack && hasRed) {
      const modsBlackOnly = new Set(ruleMods);
      modsBlackOnly.delete('color_flush_red');
      const modsRedOnly = new Set(ruleMods);
      modsRedOnly.delete('color_flush_black');
      const nrB = calculateHandScore(normalizeForColorFlush(hand, modsBlackOnly), hand.length, scoreOpts);
      const nrR = calculateHandScore(normalizeForColorFlush(hand, modsRedOnly), hand.length, scoreOpts);
      nr = pickBetterColorFlushResult(nrB, nrR);
    } else {
      const normalized = normalizeForColorFlush(hand, ruleMods);
      nr = calculateHandScore(normalized, normalized.length, scoreOpts);
    }
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
  // 条件用「弱于同花」而非弱于顺子：否则 Step 1 已出五张标准顺子时，无法再用本分支升级为四张同花
  if (ruleMods.has('even_straight') && ruleMods.has('n_card_straight_4') && handPriority(best.handType) < handPriority('flush')) {
    const even4 = findNCardEvenStraight(hand, 4);
    if (even4) {
      const ht: HandType = isFourCardFlush(even4) ? 'flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: even4.map(c => c.id) };
      }
    }
  }

  // Step 3.6: 奇数成顺 + 四张成顺 组合（支持 A/3/5/7、3/5/7/9 等 4 张奇数序列）
  // 同上：须允许在已是「顺子」时仍尝试四张奇数序 + 同花 → 升为同花
  if (ruleMods.has('odd_straight') && ruleMods.has('n_card_straight_4') && handPriority(best.handType) < handPriority('flush')) {
    const odd4 = findNCardOddStraight(hand, 4);
    if (odd4) {
      const ht: HandType = isFourCardFlush(odd4) ? 'flush' : 'straight';
      if (handPriority(ht) > handPriority(best.handType)) {
        best = { handType: ht, scoringCardIds: odd4.map(c => c.id) };
      }
    }
  }

  // Step 4: 4 张成花（不兼容同花顺，只当当前不足 flush 时才检查）
  // 可与黑/红成花共存：字面 4 同花找不到时，在色组归一化后的牌里再找 4 张。
  if (ruleMods.has('n_card_flush_4') && handPriority(best.handType) < handPriority('flush')) {
    const fc = findBestFourFlushForRules(hand);
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

/** 双花牌视为同时拥有 `double_suit` 中的花色与 `card.suit`（用于花色类 per-card 技能） */
function getCardSuitsForPerCardTriggers(card: Card): Suit[] {
  if (card.isJoker) return [];
  const ds = card.effects.find(e => e.type === 'double_suit')?.suits as Suit[] | undefined;
  if (ds?.length) {
    const set = new Set<Suit>(ds);
    set.add(card.suit);
    return [...set];
  }
  return [card.suit];
}

/**
 * 精英词缀等：整张牌的牌面分是否不计入 baseCardSum。
 * - 禁花色：与 per-card 技能一致，用 `getCardSuitsForPerCardTriggers`（含双花牌的副花色）；任一副命中即整牌不计入。
 * - Joker：通配，不视为禁限花色牌，仍在上层单独分支计分。
 */
function isCardBaseValueBlockedByStage(
  card: Card,
  bannedSuits: Suit[],
  bannedRankMax: number,
  banFaceCardScore: boolean,
): boolean {
  if (card.isJoker) return false;
  if (bannedSuits.length > 0) {
    const suits = getCardSuitsForPerCardTriggers(card);
    if (suits.some(su => bannedSuits.includes(su))) return true;
  }
  if (bannedRankMax > 0 && card.rank <= bannedRankMax) return true;
  if (banFaceCardScore && card.rank >= 11 && card.rank <= 13) return true;
  return false;
}

function cardPossibleRanksForStraight(card: Card): number[] {
  if (card.isJoker) return [];
  const cross = card.effects?.find(e => e.type === 'cross_value') as { ranks?: number[] } | undefined;
  if (cross?.ranks?.length) return cross.ranks;
  return [card.rank];
}

/** 能否用计分牌（含 Joker/跨数值牌）覆盖 requiredRanks（只要求覆盖，不要求没有额外点数） */
function canCoverRequiredRanks(scoringCards: Card[], requiredRanks: number[]): boolean {
  const req = [...new Set(requiredRanks)];
  if (req.length === 0) return true;
  const idx = new Map<number, number>();
  req.forEach((r, i) => idx.set(r, i));
  const fullMask = (1 << req.length) - 1;

  const jokers = scoringCards.filter(c => c.isJoker).length;
  const cards = scoringCards.filter(c => !c.isJoker);

  let dp = new Set<number>([0]);
  for (const c of cards) {
    const pr = cardPossibleRanksForStraight(c);
    let mask = 0;
    for (const r of pr) {
      const j = idx.get(r);
      if (j !== undefined) mask |= 1 << j;
    }
    if (mask === 0) continue;
    const next = new Set<number>(dp);
    for (const m of dp) {
      // 该牌最多代表其中一个 required rank
      for (let bit = 0; bit < req.length; bit++) {
        const b = 1 << bit;
        if ((mask & b) && !(m & b)) next.add(m | b);
      }
    }
    dp = next;
    if (dp.has(fullMask)) return true;
  }

  for (const m of dp) {
    let missing = fullMask & ~m;
    let missingCount = 0;
    while (missing) {
      missing &= missing - 1;
      missingCount += 1;
    }
    if (missingCount <= jokers) return true;
  }
  return false;
}

function rankInOddSet(r: number): boolean {
  return r === 14 || r === 11 || r === 13 || r === 3 || r === 5 || r === 7 || r === 9;
}
function rankInEvenSet(r: number): boolean {
  return r === 12 || r === 2 || r === 4 || r === 6 || r === 8 || r === 10;
}

function hasMadeGroupInSet(scoringCards: Card[], groupSize: 2 | 3, setKind: 'odd' | 'even'): boolean {
  const jokerCount = scoringCards.filter(c => c.isJoker).length;
  const counts = new Map<number, number>();
  for (const c of scoringCards) {
    if (c.isJoker) continue;
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  for (const [rank, n] of counts.entries()) {
    const ok = setKind === 'odd' ? rankInOddSet(rank) : rankInEvenSet(rank);
    if (!ok) continue;

    // Joker 作为万能牌：可补齐对子/三条。
    // 但至少需要已有 1 张该 rank 的非 Joker 牌，否则会出现“纯 Joker 也算任意奇/偶对子”的歧义。
    if (n + jokerCount >= groupSize) return true;
  }
  return false;
}

function isStrictSuitFlush(scoringCards: Card[], suit: Suit, minCount: number): boolean {
  const nonJokers = scoringCards.filter(c => !c.isJoker);
  if (nonJokers.length === 0) return false;
  let count = 0;
  for (const c of nonJokers) {
    const suits = getCardSuitsForPerCardTriggers(c);
    if (!suits.includes(suit)) return false;
    count += 1;
  }
  return count >= minCount;
}

// ─── 辅助：判断牌是否满足 per-card 触发条件 ──────────────────
function cardMatchesCondition(card: Card, ef: SkillEffect): boolean {
  if (ef.triggerSuits) {
    const suits = getCardSuitsForPerCardTriggers(card);
    if (!suits.some(s => ef.triggerSuits!.includes(s))) return false;
  }
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
  /** 词缀：J/Q/K 的牌面分不计入 baseCardSum */
  banFaceCardScore?: boolean;
  /** 词缀：结算时读取牌型升级等级临时 -N（最低 Lv1；不改变牌型判定/技能触发） */
  handTypeLevelDownshift?: number;
  isLastHand: boolean;
  isFirstHandOfStage: boolean;
  /** 本手已用补牌次数（0 = 未补牌，用于技能触发条件） */
  drawsUsedThisHand: number;
  /** 本局已获得的超级牌（属性牌）数量，用于「超级牌乘倍」等 */
  superCardCount?: number;
  /** 技能附加属性：skillId -> enhancement */
  skillEnhancements?: Record<string, SkillEnhancement>;
  /**
   * 计分取样时的局内 💎（**不含**本手因计分牌即将入账的钻）；用于钻石估值/倍率/超级穷鬼等。
   */
  runDiamonds: number;
  /** 本关总手数、已打完的手数（计分时刻尚未计入本手） */
  stageTotalHands: number;
  stageUsedHands: number;
  /** 本局已结算的手数（跨关累计，结算口径为“本手结算前已完成的手数”） */
  runHandsPlayedTotal?: number;
  /**
   * `random_hand_add_multiplier`：本手加性倍率的骰点（闭区间整数），由 `rollRandomHandAddMultiplier` 在结算时生成；
   * 未传则该效果本手视为 0（如 Hold 预览不计随机段）。
   */
  randomHandAddMultiplier?: number;
}

/** 是否拥有「随机加倍」类效果（不掷骰）。 */
export function hasRandomHandAddMultiplierSkill(skills: SkillDef[]): boolean {
  return skills.some((s) => s.effects.some((e) => e.type === 'random_hand_add_multiplier'));
}

/** 若拥有随机加倍类技能，返回本手应叠加的加性倍率整数；否则 `undefined`。 */
export function rollRandomHandAddMultiplier(skills: SkillDef[]): number | undefined {
  if (!hasRandomHandAddMultiplierSkill(skills)) return undefined;
  for (const s of skills) {
    const ef = s.effects.find((e) => e.type === 'random_hand_add_multiplier');
    if (ef) {
      const mn = ef.randomMultMin ?? 2;
      const mx = ef.randomMultMax ?? 15;
      const lo = Math.min(mn, mx);
      const hi = Math.max(mn, mx);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }
  }
  return undefined;
}

/** 超级牌乘倍：当前独立乘区因子 min(上限, 1 + superCardCount × delta)（无此效果则 null） */
export function getSuperCardIndependentFactor(skill: SkillDef, superCardCount: number): number | null {
  const ef = skill.effects.find(e => e.type === 'super_card_independent_multiply');
  if (!ef) return null;
  const pairs = Math.floor(Math.max(0, superCardCount) / 2);
  return Math.min(SUPER_CARD_INDEPENDENT_MULT_CAP, 1 + pairs * ef.value);
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
    banFaceCardScore = false,
    handTypeLevelDownshift = 0,
    isLastHand,
    isFirstHandOfStage,
    drawsUsedThisHand,
    superCardCount = 0,
    skillEnhancements = {},
    runDiamonds,
    stageTotalHands,
    stageUsedHands,
    runHandsPlayedTotal,
    randomHandAddMultiplier,
  } = ctx;

  /** 钻石估值/倍率：仅正钻数参与加算（负债不反向扣技能$） */
  const gemsForDiamondSkills = Math.max(0, runDiamonds);

  function diamondSkillSteps(gems: number, cost: number | undefined): number {
    const n = Math.max(1, cost ?? 1);
    return Math.floor(gems / n);
  }

  const ruleMods = getActiveRuleMods(acquiredSkills);
  const maxJokersInScoring = acquiredSkills.some(s => s.id === JOKER_DOUBLE_SKILL_ID) ? 2 : 1;

  // ── 1. 牌型检测（带规则改写）──
  const detected = detectHandType(hand, ruleMods, maxJokersInScoring);
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
  const down = Math.max(0, Math.floor(handTypeLevelDownshift));
  const currentLevel = upgradeMap[handType] ?? 1;
  const effectiveLevel = Math.max(1, currentLevel - down);
  const stats = getHandTypeStats(handType, down > 0 ? { ...upgradeMap, [handType]: effectiveLevel } : upgradeMap);
  const baseCardSum = scoringCards.reduce((s, c) => {
    if (c.isJoker) return s + c.baseValue; // Joker：通配，不设为禁限花色/点数牌
    if (isCardBaseValueBlockedByStage(c, bannedSuits, bannedRankMax, banFaceCardScore)) return s;
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

  const containedHandTypes = getContainedHandTypes(handType);

  for (const skill of acquiredSkills) {
    let skillTriggered = false;
    for (const ef of skill.effects) {
      // 跳过 modify_rule（已在检测阶段处理）
      if (ef.type === 'modify_rule') continue;

      // ── triggerHasJoker 全局条件 ──
      if (ef.triggerHasJoker && !hasJoker) continue;

      // ── triggerHandTypes 全局条件 ──
      const handTypeMatch =
        !ef.triggerHandTypes ||
        (ef.matchContainedHandTypes
          ? ef.triggerHandTypes.some(t => containedHandTypes.has(t))
          : ef.triggerHandTypes.includes(handType));

      // ── requireLastHand ──
      if (ef.requireLastHand && !isLastHand) continue;

      // ── requireFirstHandNoHold ──
      if (ef.requireFirstHandNoHold && !(isFirstHandOfStage && drawsUsedThisHand === 0)) continue;

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
            if (ef.requireMadeGroupSize && ef.requireMadeGroupRankSet) {
              if (!hasMadeGroupInSet(scoringCards, ef.requireMadeGroupSize, ef.requireMadeGroupRankSet)) break;
            }
            skillAddedScore += ef.value;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: ef.value });
          }
          break;

        case 'hand_add_multiplier':
          if (handTypeMatch) {
            if (ef.requireMadeGroupSize && ef.requireMadeGroupRankSet) {
              if (!hasMadeGroupInSet(scoringCards, ef.requireMadeGroupSize, ef.requireMadeGroupRankSet)) break;
            }
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

        case 'accumulate_multiplier_no_draw': {
          if (drawsUsedThisHand > 0) break;
          const cap = ef.accumulateCap ?? 9999;
          const prev = newAccumulation[skill.id] ?? 0;
          const grown = Math.min(prev + ef.value, cap);
          newAccumulation[skill.id] = grown;
          skillAddedMultiplier += grown;
          skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: grown });
          break;
        }

        case 'per_run_diamond_score': {
          const steps = diamondSkillSteps(gemsForDiamondSkills, ef.perRunDiamondsCost);
          const add = steps * ef.value;
          if (add !== 0) {
            skillAddedScore += add;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: add });
          }
          break;
        }

        case 'per_run_diamond_multiplier': {
          const steps = diamondSkillSteps(gemsForDiamondSkills, ef.perRunDiamondsCost);
          const addM = steps * ef.value;
          if (addM !== 0) {
            skillAddedMultiplier += addM;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: addM });
          }
          break;
        }

        case 'random_hand_add_multiplier': {
          const rolled = randomHandAddMultiplier;
          if (rolled !== undefined && rolled > 0) {
            skillAddedMultiplier += rolled;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: rolled });
          }
          break;
        }

        case 'per_remaining_hand_add_multiplier': {
          const afterThis = Math.max(0, stageTotalHands - stageUsedHands - 1);
          const addR = afterThis * ef.value;
          if (addR > 0) {
            skillAddedMultiplier += addR;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: addR });
          }
          break;
        }

        case 'stage_decay_add_multiplier': {
          if (!handTypeMatch) break;
          const cur = Number(newAccumulation[skill.id] ?? 0);
          if (Number.isFinite(cur) && cur > 0) {
            skillAddedMultiplier += cur;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedMultiplier: cur });
          }
          break;
        }

        case 'hand_decay_add_score': {
          if (!handTypeMatch) break;
          const cur = Number(newAccumulation[skill.id] ?? 0);
          if (Number.isFinite(cur) && cur > 0) {
            skillAddedScore += cur;
            skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: cur });
          }
          break;
        }

        case 'shop_refresh_independent_bonus': {
          if (!handTypeMatch) break;
          const cnt = Number(newAccumulation[skill.id] ?? 0);
          if (Number.isFinite(cnt) && cnt > 0) {
            const factor = Math.min(2, 1 + cnt * ef.value);
            if (factor > 1) {
              independentMultiplier *= factor;
              skillLog.push({ skillId: skill.id, skillName: skill.name, multiplyFactor: factor });
            }
          }
          break;
        }

        case 'independent_multiply': {
          if (!handTypeMatch) break;
          if (ef.requireRunDiamondsLte !== undefined && runDiamonds > ef.requireRunDiamondsLte) break;
          if (ef.requireStageHandIndex !== undefined) {
            const curHand = stageUsedHands + 1; // 1-based
            if (curHand !== ef.requireStageHandIndex) break;
          }
          if (ef.requireStrictFlushSuit) {
            const minCount = ef.requireStrictFlushMinCount ?? 5;
            if (!isStrictSuitFlush(scoringCards, ef.requireStrictFlushSuit, minCount)) break;
          }
          if (ef.requireStraightContainsRanks?.length) {
            if (!canCoverRequiredRanks(scoringCards, ef.requireStraightContainsRanks)) break;
          }
          if (ef.requireRunHandCycle7) {
            const raw = ctx.runHandsPlayedTotal;
            const prev = Number(raw ?? 0);
            const safe = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0;
            const handNo = safe + 1; // 本手为第几手（1-based；与 _commitScore 传入的「结算前已完成手数」一致）
            if (!(handNo === 1 || handNo % 7 === 0)) break;
          }
          independentMultiplier *= ef.value;
          skillLog.push({ skillId: skill.id, skillName: skill.name, multiplyFactor: ef.value });
          break;
        }

        case 'super_card_independent_multiply': {
          if (!handTypeMatch) break;
          const pairs = Math.floor(Math.max(0, superCardCount) / 2);
          const factor = Math.min(
            SUPER_CARD_INDEPENDENT_MULT_CAP,
            1 + pairs * ef.value,
          );
          if (factor > 1) {
            independentMultiplier *= factor;
            skillLog.push({ skillId: skill.id, skillName: skill.name, multiplyFactor: factor });
          }
          break;
        }

        default:
          break;
      }
    }
    // 银边/金边/彩边（flash/gold/laser）作为技能附加词条：每手固定生效 1 次，不依赖原技能触发条件
    const enhancement = skillEnhancements[skill.id] ?? 'normal';
    if (enhancement === 'flash') {
      skillAddedScore += 40;
      skillLog.push({ skillId: `${skill.id}_flash`, skillName: `${skill.name}[银边]`, addedScore: 40 });
    } else if (enhancement === 'gold') {
      skillAddedMultiplier += 10;
      skillLog.push({ skillId: `${skill.id}_gold`, skillName: `${skill.name}[金边]`, addedMultiplier: 10 });
    } else if (enhancement === 'laser') {
      independentMultiplier *= 1.5;
      skillLog.push({ skillId: `${skill.id}_laser`, skillName: `${skill.name}[彩边]`, multiplyFactor: 1.5 });
    } else if (enhancement === 'black') {
      /* 黑边仅增加技能槽位，不参与本手数值；槽位在 store / getEffectiveSkillSlotCap */
    }
  }

  // ── 5.5 特殊技能：每拥有 1 个技能 +SKILL_COUNT_MULT_PER_SKILL 倍（包含该技能自身），不设本项上限 ──
  if (acquiredSkills.some(s => s.id === SKILL_COUNT_MULT_ID)) {
    const add = SKILL_COUNT_MULT_PER_SKILL * acquiredSkills.length;
    if (add > 0) {
      skillAddedMultiplier += add;
      const skill = acquiredSkills.find(s => s.id === SKILL_COUNT_MULT_ID);
      skillLog.push({
        skillId: SKILL_COUNT_MULT_ID,
        skillName: skill?.name ?? '技能数加倍',
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

  // ── 6.1 金色属性牌：参与计分则独立 ×N（可叠乘） ──
  for (const card of scoringCards) {
    if (card.isJoker) continue;
    const ef = card.effects.find(e => e.type === 'independent_multiply' && typeof e.value === 'number');
    if (ef && ef.value && ef.value > 0) {
      independentMultiplier *= ef.value;
      skillLog.push({
        skillId: `attrcard_${card.id}_indep`,
        skillName: '属性牌',
        multiplyFactor: ef.value,
      });
    }
  }

  // ── 7. 最终金币 ──
  const multiplierTotal = stats.multiplier + skillAddedMultiplier;
  const finalGold = Math.round(
    (cardScoreSum + skillAddedScore) * multiplierTotal * independentMultiplier
  );

  const dr = diamondRewardForScoringCardIds(hand, expandedScoring);

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
    diamondReward: dr > 0 ? dr : undefined,
    skillLog,
    newAccumulation,
  };
}

/**
 * 本关通关且仍剩余手数时：对拥有 `accumulate_score_saved_hands` 的技能按「每剩余 1 手 +value」叠加上限，
 * 并将**整池**并入当次技能$后重算 `finalGold`（与 `accumulate_score` 同类记账）。
 */
export function applySavedHandsStageWinBonus(
  base: SkillHandResult,
  acquiredSkills: SkillDef[],
  savedHands: number,
): SkillHandResult {
  if (savedHands <= 0) return base;

  let newAccumulation = { ...base.newAccumulation };
  let skillAddedScore = base.skillAddedScore;
  const skillLog = [...base.skillLog];
  let touched = false;

  for (const skill of acquiredSkills) {
    for (const ef of skill.effects) {
      if (ef.type !== 'accumulate_score_saved_hands') continue;
      const cap = ef.accumulateCap ?? 9999;
      const prev = newAccumulation[skill.id] ?? 0;
      const grown = Math.min(prev + ef.value * savedHands, cap);
      newAccumulation[skill.id] = grown;
      skillAddedScore += grown;
      skillLog.push({ skillId: skill.id, skillName: skill.name, addedScore: grown });
      touched = true;
    }
  }

  if (!touched) return base;

  const finalGold = Math.round(
    (base.cardScoreSum + skillAddedScore) * base.multiplierTotal * base.independentMultiplier,
  );

  return {
    ...base,
    skillAddedScore,
    newAccumulation,
    skillLog,
    finalGold,
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
