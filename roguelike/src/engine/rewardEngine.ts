import { HandType, Card, Suit, Rank, CardQuality } from '../shared/types/poker';
import { HandTypeUpgradeMap } from '../types/run';
import { UpgradeOption, RewardState, RewardStep } from '../types/reward';
import { SkillDef, SkillQuality } from '../types/skill';
import upgradeConfig from '../config/runHandTypeUpgrades.json';
import { getHandTypeStats } from './handEngine';
import { ALL_SKILLS } from './skillEngine';

interface UpgradeCardDef {
  id: string;
  handType: string;
  name: string;
}

const upgradeCards = upgradeConfig.upgradeCards as UpgradeCardDef[];

/** 随机抽取 3 张不重复的升级卡选项（排除皇家同花顺，其数值与同花顺相同） */
export function generateUpgradeOptions(upgradeMap: HandTypeUpgradeMap): UpgradeOption[] {
  const pool = upgradeCards.filter(c => c.handType !== 'royal_flush');
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 3);

  return picked.map(card => {
    const ht = card.handType as HandType;
    const currentLevel = upgradeMap[ht] ?? 1;
    const currentStats = getHandTypeStats(ht, upgradeMap);
    const nextStats    = getHandTypeStats(ht, { ...upgradeMap, [ht]: currentLevel + 1 });
    return {
      type:             'upgrade' as const,
      handType:         ht,
      handName:         card.name.replace('升级卡', ''),
      currentLevel,
      baseScoreDelta:   nextStats.baseScore  - currentStats.baseScore,
      multiplierDelta:  nextStats.multiplier - currentStats.multiplier,
    };
  });
}

/** 应用升级选择，返回新的升级 map */
export function applyUpgrade(
  upgradeMap: HandTypeUpgradeMap,
  option: UpgradeOption,
): HandTypeUpgradeMap {
  const current = upgradeMap[option.handType] ?? 1;
  return { ...upgradeMap, [option.handType]: current + 1 };
}

// ─── 技能三选一 ──────────────────────────────────────────────────

/** 品质权重（精英关后可以在外部调整传入） */
const DEFAULT_QUALITY_WEIGHTS: Record<SkillQuality, number> = {
  green:  65,
  blue:   25,
  purple: 10,
};

type WeightedQualityPattern = {
  qualities: SkillQuality[];
  weight: number;
};

function weightedRandom<T>(items: T[], getWeight: (item: T) => number): T {
  const total = items.reduce((s, i) => s + getWeight(i), 0);
  let rng = Math.random() * total;
  for (const item of items) {
    rng -= getWeight(item);
    if (rng <= 0) return item;
  }
  return items[items.length - 1];
}

/** 从给定品质模板中按顺序抽取技能（尽量满足模板，不足时回退到任意可用技能） */
function pickSkillsByQualityPattern(available: SkillDef[], qualities: SkillQuality[]): SkillDef[] {
  const picked: SkillDef[] = [];
  const used = new Set<string>();

  for (const q of qualities) {
    const pool = available.filter(s => s.quality === q && !used.has(s.id));
    if (pool.length > 0) {
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      picked.push(chosen);
      used.add(chosen.id);
    }
  }

  // 若某品质库存不足，补齐到 3 个（从剩余可用技能中随机补）
  if (picked.length < 3) {
    const remaining = available.filter(s => !used.has(s.id));
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    picked.push(...shuffled.slice(0, 3 - picked.length));
  }

  return picked;
}

/**
 * 随机抽 3 个不重复技能（已拥有的不重复出现）。
 * afterElite: true 时紫色权重提升到 25%。
 */
export function generateSkillOptions(
  acquiredSkillIds: string[],
  afterElite = false,
): SkillDef[] {
  const available = ALL_SKILLS.filter(s => !acquiredSkillIds.includes(s.id));
  if (available.length === 0) return [];

  // 开局技能三选一：固定绿绿绿（若绿不足，自动回退补齐）
  if (!afterElite && acquiredSkillIds.length === 0) {
    return pickSkillsByQualityPattern(available, ['green', 'green', 'green']);
  }

  // 精英/Boss 后技能三选一组合池：
  // 绿绿蓝 30%、绿蓝蓝 40%、绿蓝紫 30%
  if (afterElite) {
    const patterns: WeightedQualityPattern[] = [
      { qualities: ['green', 'green', 'blue'], weight: 30 },
      { qualities: ['green', 'blue', 'blue'], weight: 40 },
      { qualities: ['green', 'blue', 'purple'], weight: 30 },
    ];
    const selected = weightedRandom(patterns, p => p.weight);
    return pickSkillsByQualityPattern(available, selected.qualities);
  }

  // 兜底：普通权重抽取（当前流程通常不会走到这里）
  const weights: Record<SkillQuality, number> = DEFAULT_QUALITY_WEIGHTS;
  const picked: SkillDef[] = [];
  const used = new Set<string>();
  const maxTries = 30;
  for (let i = 0; i < 3 && picked.length < available.length; i++) {
    let found: SkillDef | null = null;
    for (let t = 0; t < maxTries; t++) {
      const candidate = weightedRandom(available, s => weights[s.quality]);
      if (!used.has(candidate.id)) {
        found = candidate;
        break;
      }
    }
    if (found) {
      picked.push(found);
      used.add(found.id);
    }
  }
  return picked;
}

// ─── 属性牌生成 ──────────────────────────────────────────────────

const SUITS: Suit[]  = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS: Rank[]  = [2,3,4,5,6,7,8,9,10,11,12,13,14];

function scoreValue(rank: Rank): number { return rank >= 10 ? 10 : rank; }

let attrCardCounter = 0;

function makeAttrId(): string {
  return `attr_${Date.now()}_${attrCardCounter++}`;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 随机生成一张属性牌（roguelike 专用，永久禁止 isDiamondCard）。
 *
 * 数值规则：
 * - green  : high_score +5  |  multiplier +2
 * - blue   : high_score +10 |  multiplier +3
 *            double_suit（同色异花）+ high_score +5（双效果）
 * - purple : cross_value(JQK 或 8-10) + multiplier +3（双效果）
 *            double_suit（对立色）+ multiplier +3（双效果）
 *
 * 禁用 +💎 说明：
 *   原项目中 isDiamondCard:true 的牌会在计分时产生局外钻石奖励，
 *   与 roguelike 单局金币目标不一致，所有生成的牌均显式设 isDiamondCard:false。
 */
export function generateOneAttributeCard(quality?: CardQuality): Card {
  const q: CardQuality = quality ?? (() => {
    const r = Math.random();
    if (r < 0.60) return 'green';
    if (r < 0.90) return 'blue';
    return 'purple';
  })();

  const suit  = randomFrom(SUITS);
  const rank  = randomFrom(RANKS);
  const baseV = scoreValue(rank);

  // 所有生成牌均禁止钻石奖励（roguelike 模式专用规则）
  const noDiamond = { isDiamondCard: false as const };

  if (q === 'green') {
    const isHigh = Math.random() < 0.5;
    const effectValue = isHigh ? 5 : 2;
    const effectType  = isHigh ? 'high_score' as const : 'multiplier' as const;
    return {
      ...noDiamond,
      id: makeAttrId(), suit, rank, quality: q,
      effects: [{ type: effectType, value: effectValue }],
      baseValue: isHigh ? baseV + effectValue : baseV,
      multiplier: isHigh ? 0 : effectValue,
    };
  }

  if (q === 'blue') {
    const roll = Math.random();
    if (roll < 0.33) {
      // high_score +10
      return {
        ...noDiamond,
        id: makeAttrId(), suit, rank, quality: q,
        effects: [{ type: 'high_score', value: 10 }],
        baseValue: baseV + 10, multiplier: 0,
      };
    } else if (roll < 0.66) {
      // multiplier +3
      return {
        ...noDiamond,
        id: makeAttrId(), suit, rank, quality: q,
        effects: [{ type: 'multiplier', value: 3 }],
        baseValue: baseV, multiplier: 3,
      };
    } else {
      // double_suit + high_score +5（双效果）
      const otherSuit = randomFrom(SUITS.filter(s => s !== suit));
      return {
        ...noDiamond,
        id: makeAttrId(), suit, rank, quality: q,
        effects: [
          { type: 'double_suit', suits: [suit, otherSuit] },
          { type: 'high_score', value: 5 },
        ],
        baseValue: baseV + 5,
        multiplier: 0,
      };
    }
  }

  // purple
  const roll = Math.random();
  if (roll < 0.5) {
    // cross_value(JQK 或 8-10) + multiplier +3
    const groups: Rank[][] = [[8,9,10],[11,12,13]];
    const ranks = randomFrom(groups);
    return {
      ...noDiamond,
      id: makeAttrId(), suit, rank, quality: q,
      effects: [
        { type: 'cross_value', ranks },
        { type: 'multiplier', value: 3 },
      ],
      baseValue: Math.max(...ranks.map(r => scoreValue(r as Rank))),
      multiplier: 3,
    };
  } else {
    // double_suit 对立色 + multiplier +3（双效果）
    const black: Suit[] = ['spades','clubs'];
    const red:   Suit[] = ['hearts','diamonds'];
    const pair = black.includes(suit)
      ? [suit, randomFrom(red)]
      : [suit, randomFrom(black)];
    return {
      ...noDiamond,
      id: makeAttrId(), suit, rank, quality: q,
      effects: [
        { type: 'double_suit', suits: pair as Suit[] },
        { type: 'multiplier', value: 3 },
      ],
      baseValue: baseV,
      multiplier: 3,
    };
  }
}

/** 生成 3 张不同品质倾向的属性牌备选 */
export function generateAttributeCardOptions(): Card[] {
  // 属性牌三选一组合池：
  // 绿绿蓝 25%、绿蓝蓝 25%、绿蓝紫 35%、绿紫紫 15%
  const patterns: Array<{ qualities: CardQuality[]; weight: number }> = [
    { qualities: ['green', 'green', 'blue'],  weight: 25 },
    { qualities: ['green', 'blue', 'blue'],   weight: 25 },
    { qualities: ['green', 'blue', 'purple'], weight: 35 },
    { qualities: ['green', 'purple', 'purple'], weight: 15 },
  ];
  const selected = weightedRandom(patterns, p => p.weight);
  return selected.qualities.map(q => generateOneAttributeCard(q));
}

/**
 * 生成单步奖励状态。
 * 每关只有一步：普通1关→upgrade，普通2关→attribute，精英/Boss关→skill。
 */
export function generateSingleRewardState(
  type: RewardStep,
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  afterElite = false,
): RewardState {
  switch (type) {
    case 'upgrade':
      return {
        step: 'upgrade',
        skillOptions:     [],
        upgradeOptions:   generateUpgradeOptions(upgradeMap),
        attributeOptions: [],
      };
    case 'attribute':
      return {
        step: 'attribute',
        skillOptions:     [],
        upgradeOptions:   [],
        attributeOptions: generateAttributeCardOptions(),
      };
    case 'skill':
    default:
      return {
        step: 'skill',
        skillOptions:     generateSkillOptions(acquiredSkillIds, afterElite),
        upgradeOptions:   [],
        attributeOptions: [],
      };
  }
}

/** 开局奖励：技能三选一（isOpeningReward = true） */
export function generateOpeningRewardState(acquiredSkillIds: string[]): RewardState {
  return {
    step: 'skill',
    skillOptions:     generateSkillOptions(acquiredSkillIds, false),
    upgradeOptions:   [],
    attributeOptions: [],
    isOpeningReward:  true,
  };
}

/**
 * 按关卡在组内的位置生成奖励状态。
 *
 * 规则（3 关一组）：
 *   groupIndex % 3 == 0 (普通1)    → 升级三选一 → 属性牌三选一（两步）
 *   groupIndex % 3 == 1 (普通2)    → 升级三选一 → 属性牌三选一（两步）
 *   groupIndex % 3 == 2 (精英/Boss) → 技能三选一 → 技能三选一（两步）
 *
 * @param groupIndex  主线用 stageIndex，无限阶段用 endlessStagesCleared
 */
export function generateRewardForStage(
  groupIndex: number,
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  afterElite = false,
): RewardState {
  const pos = ((groupIndex % 3) + 3) % 3;

  if (pos === 2) {
    // 精英/Boss：两次技能三选一（第二次选项在玩家选完第一个技能后动态生成）
    return {
      step:             'skill',
      skillOptions:     generateSkillOptions(acquiredSkillIds, afterElite),
      upgradeOptions:   [],
      attributeOptions: [],
      pendingSteps:     ['skill'],
      afterElite,
    };
  }

  // 普通1 / 普通2：升级 → 属性牌（两步，属性牌选项预先生成）
  return {
    step:             'upgrade',
    skillOptions:     [],
    upgradeOptions:   generateUpgradeOptions(upgradeMap),
    attributeOptions: generateAttributeCardOptions(),   // 属性牌选项先生成好
    pendingSteps:     ['attribute'],
  };
}

/** @deprecated 单步奖励，保留供内部调用 */
export function generateRewardState(
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  afterElite = false,
): RewardState {
  return generateSingleRewardState('skill', upgradeMap, acquiredSkillIds, afterElite);
}
