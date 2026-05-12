import { HandType, Card, Suit, Rank, CardQuality } from '../shared/types/poker';
import { HandTypeUpgradeMap } from '../types/run';
import { UpgradeOption, RewardState, RewardStep, SkillShopOption, UpgradeShopOption, AttributeShopOption } from '../types/reward';
import { SkillDef, SkillEnhancement, SkillQuality } from '../types/skill';
import upgradeConfig from '../config/runHandTypeUpgrades.json';
import { getHandTypeStats } from './handEngine';
import { ALL_SKILLS } from './skillEngine';

// ─── 黑边技能定向保底（扩技能槽）────────────────────────────────
const BLACK_EDGE_PITY_BASE_P = 0.05;
const BLACK_EDGE_PITY_MAX_TURNS = 10;
const BLACK_EDGE_PITY_COOLDOWN_TURNS = 2;
function blackEdgeGateK(n: number): number {
  return 19 + 20 * n;
}
function blackEdgePityChance(misses: number): number {
  const t = Math.max(0, Math.min(BLACK_EDGE_PITY_MAX_TURNS, misses));
  return Math.min(1, BLACK_EDGE_PITY_BASE_P + (1 - BLACK_EDGE_PITY_BASE_P) * (t / BLACK_EDGE_PITY_MAX_TURNS));
}
function countOwnedBlackEdges(acquiredSkillIds: string[], enhancements: Record<string, SkillEnhancement>): number {
  return acquiredSkillIds.filter(id => enhancements[id] === 'black').length;
}

/** `super_credit_card`：统一商店关卡序号 k（从 1 计）≤ 此值时不进入技能候选池 */
const SUPER_CREDIT_SHOP_EXCLUDE_MAX_K = 5;
const SUPER_CREDIT_CARD_ID = 'super_credit_card';

interface UpgradeCardDef {
  id: string;
  handType: string;
  name: string;
}

const upgradeCards = upgradeConfig.upgradeCards as UpgradeCardDef[];
const SKILL_BASE_PRICE: Record<SkillQuality, number> = { green: 4, blue: 6, purple: 8 };
const SKILL_ENHANCEMENT_EXTRA: Record<SkillEnhancement, number> = {
  normal: 0,
  flash: 2,
  gold: 4,
  laser: 6,
  black: 4,
};
const UPGRADE_PRICE = 4;
const ATTRIBUTE_PRICE_BY_QUALITY: Partial<Record<CardQuality, number>> = { green: 1, blue: 2, purple: 3, gold: 4 };
const DEFAULT_DIAMOND_REFRESH_COST = 5;

/** 随机抽取 3 张不重复的升级卡选项（排除皇家同花顺） */
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

/** 随机 `count` 张不重复升级候选（排除皇家同花顺） */
export function generateUpgradeOptionsCount(upgradeMap: HandTypeUpgradeMap, count: number): UpgradeOption[] {
  if (count <= 0) return [];
  const pool = upgradeCards.filter(c => c.handType !== 'royal_flush');
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
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
 * afterElite: true 时使用精英品质模板池。
 * `shopStageK` 为 1～5 时：**超级信用卡**（`super_credit_card`）不进入候选池。
 * `allowedSkillIds`：仅此集合内的技能可进入候选（undefined = 全部可用）。
 */
export function generateSkillOptions(
  acquiredSkillIds: string[],
  afterElite = false,
  /** 统一商店关卡序号 k（从 1 计）；传入时用于前两关定稿规则 */
  shopStageK?: number,
  /** 本局曾卖出过的技能，不再进入商店候选 */
  soldSkillIds: string[] = [],
  /** 本局允许的技能 ID 集合（来自解锁顺序）；undefined 表示不过滤 */
  allowedSkillIds?: Set<string>,
): SkillDef[] {
  const sold = new Set(soldSkillIds);
  const available = ALL_SKILLS.filter((s) => {
    if (acquiredSkillIds.includes(s.id) || sold.has(s.id)) return false;
    if (
      shopStageK != null &&
      shopStageK <= SUPER_CREDIT_SHOP_EXCLUDE_MAX_K &&
      s.id === SUPER_CREDIT_CARD_ID
    ) {
      return false;
    }
    // 技能解锁顺序过滤（主线模式）
    if (allowedSkillIds && !allowedSkillIds.has(s.id)) return false;
    return true;
  });
  if (available.length === 0) return [];

  // 第 1、2 关后的商店（k=1、2）：技能固定绿绿绿（见 `Roguelike2.0统一关后商店设计.md` §2.3）
  if (shopStageK != null && shopStageK <= 2) {
    return pickSkillsByQualityPattern(available, ['green', 'green', 'green']);
  }

  // 开局技能三选一：固定绿绿绿（若绿不足，自动回退补齐）
  if (!afterElite && acquiredSkillIds.length === 0) {
    return pickSkillsByQualityPattern(available, ['green', 'green', 'green']);
  }

  // 精英/Boss 后技能三选一组合池
  if (afterElite) {
    const patterns: WeightedQualityPattern[] = [
      { qualities: ['green', 'green', 'blue'], weight: 30 },
      { qualities: ['green', 'blue', 'blue'], weight: 25 },
      { qualities: ['blue', 'blue', 'blue'], weight: 25 },
      { qualities: ['blue', 'blue', 'purple'], weight: 15 },
      { qualities: ['blue', 'purple', 'purple'], weight: 5 },
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

/** 生成至多 `count` 个技能候选（沿用 `generateSkillOptions` 的模板与权重，张数不足则尽数返回） */
export function generateSkillOptionsCount(
  acquiredSkillIds: string[],
  afterElite: boolean,
  count: number,
  shopStageK?: number,
  soldSkillIds: string[] = [],
  allowedSkillIds?: Set<string>,
): SkillDef[] {
  if (count <= 0) return [];
  const full = generateSkillOptions(acquiredSkillIds, afterElite, shopStageK, soldSkillIds, allowedSkillIds);
  return full.slice(0, Math.min(count, full.length));
}

/**
 * 统一商店「本批技能」附加边：**整批至多 1 张**非 normal；其余槽均为 normal。
 * 带边落在哪一格均匀随机（与槽位数无关）。
 *
 * - **首 Roll**（`useRefreshOdds === false`）：无 88% / 银 4% / 金 4% / 彩 2% / 黑 2%
 * - **💎 刷新后重 Roll**（`useRefreshOdds === true`）：无 82% / 银 6% / 金 5% / 彩 4% / 黑 3%
 *
 * `forceNormal === true`（如 k=1、2）时全部为 normal。
 */
const INITIAL_SKILL_EDGE_THRESHOLDS: { t: number; edge: SkillEnhancement | null }[] = [
  { t: 88, edge: null },
  { t: 92, edge: 'flash' },
  { t: 96, edge: 'gold' },
  { t: 98, edge: 'laser' },
  { t: 100, edge: 'black' },
];

const REFRESH_SKILL_EDGE_THRESHOLDS: { t: number; edge: SkillEnhancement | null }[] = [
  { t: 82, edge: null },
  { t: 88, edge: 'flash' },
  { t: 93, edge: 'gold' },
  { t: 97, edge: 'laser' },
  { t: 100, edge: 'black' },
];

function rollSkillShopEnhancements(
  slotCount: number,
  forceNormal: boolean,
  useRefreshOdds: boolean,
): SkillEnhancement[] {
  const n = Math.max(0, slotCount);
  const out: SkillEnhancement[] = Array.from({ length: n }, () => 'normal');
  if (n === 0 || forceNormal) return out;

  const table = useRefreshOdds ? REFRESH_SKILL_EDGE_THRESHOLDS : INITIAL_SKILL_EDGE_THRESHOLDS;
  const r = Math.random() * 100;
  let edge: SkillEnhancement | null = null;
  for (const row of table) {
    if (r < row.t) {
      edge = row.edge;
      break;
    }
  }
  if (edge == null) return out;
  out[Math.floor(Math.random() * n)] = edge;
  return out;
}

export function getSkillPurchasePrice(skill: SkillDef, enhancement: SkillEnhancement): number {
  return SKILL_BASE_PRICE[skill.quality] + SKILL_ENHANCEMENT_EXTRA[enhancement];
}

export function getDefaultDiamondRefreshCost(): number {
  return DEFAULT_DIAMOND_REFRESH_COST;
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

const CROSS_VALUE_GROUPS: Rank[][] = [[8, 9, 10], [11, 12, 13]];

/**
 * 随机生成一张属性牌（roguelike 专用）。
 *
 * 品质（无入参时）：绿 30% / 蓝 40% / 紫 30%，每张独立掷点。
 * 数值规则（对齐 `Roguelike超级牌设定.md`）：
 * - green  : 单轨 high_score +10 | multiplier +3
 * - blue   : 仅双花 / 跨数值，各 **50%**（各档 +10$ / +2 倍 各 50%）；无单花单数值
 * - purple : **20%** 紫钻；**40%** 双花 / **40%** 跨数值（双花对立色；档内 +20$ / +3 倍 各 50%）；无单花 +$40 / +5 倍
 *
 * 绿、蓝：`isDiamondCard: false`。紫 **仅 20% 钻档** 为 `isDiamondCard: true`、`diamondBonus: 3`。
 */
export function generateOneAttributeCard(quality?: CardQuality): Card {
  const q: CardQuality = quality ?? (() => {
    const r = Math.random();
    // 绿:蓝:紫:金 = 20%:50%:25%:5%
    if (r < 0.20) return 'green';
    if (r < 0.70) return 'blue';
    if (r < 0.95) return 'purple';
    return 'gold';
  })();

  const suit  = randomFrom(SUITS);
  const rank  = randomFrom(RANKS);
  const baseV = scoreValue(rank);

  // 所有生成牌均禁止钻石奖励（roguelike 模式专用规则）
  const noDiamond = { isDiamondCard: false as const };

  if (q === 'green') {
    const isHigh = Math.random() < 0.5;
    const effectValue = isHigh ? 10 : 2;
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
    // 单花单数值 : 双花 : 跨数值 = 50% : 25% : 25%
    const branch = Math.random();
    if (branch < 0.50) {
      // 蓝色单花单数值：可 +$30 或 +4 倍（各 50%）
      const isHigh = Math.random() < 0.5;
      if (isHigh) {
        return {
          ...noDiamond,
          id: makeAttrId(), suit, rank, quality: q,
          effects: [{ type: 'high_score', value: 30 }],
          baseValue: baseV + 30,
          multiplier: 0,
        };
      }
      return {
        ...noDiamond,
        id: makeAttrId(), suit, rank, quality: q,
        effects: [{ type: 'multiplier', value: 4 }],
        baseValue: baseV,
        multiplier: 4,
      };
    }
    if (branch < 0.75) {
      // 蓝色双花：仅双花结构，不附带 +$ / +倍
      const otherSuit = randomFrom(SUITS.filter(s => s !== suit));
      return {
        ...noDiamond,
        id: makeAttrId(), suit, rank, quality: q,
        effects: [{ type: 'double_suit', suits: [suit, otherSuit] }],
        baseValue: baseV,
        multiplier: 0,
      };
    }
    // 蓝色跨数值：仅跨数值结构，不附带 +$ / +倍
    const ranks = randomFrom(CROSS_VALUE_GROUPS);
    const baseCross = Math.max(...ranks.map(r => scoreValue(r as Rank)));
    return {
      ...noDiamond,
      id: makeAttrId(), suit, rank, quality: q,
      effects: [{ type: 'cross_value', ranks }],
      baseValue: baseCross,
      multiplier: 0,
    };
  }

  if (q === 'gold') {
    // 金色属性牌：单花单数值，点数仅 8-A；参与计分则独立 ×1.5（显示 ×1.5）
    const goldRanks: Rank[] = [8, 9, 10, 11, 12, 13, 14];
    const r = randomFrom(goldRanks);
    const bv = scoreValue(r);
    return {
      ...noDiamond,
      id: makeAttrId(),
      suit,
      rank: r,
      quality: q,
      effects: [{ type: 'independent_multiply', value: 1.5 }],
      baseValue: bv,
      multiplier: 0,
    };
  }

  // purple：20% 紫钻 / 40% 双花 / 40% 跨数值（去掉单花 +$40、+5 倍；结构内 25:25 → 40:40）
  const pr = Math.random();
  if (pr < 0.20) {
    return {
      id: makeAttrId(),
      suit,
      rank,
      quality: q,
      effects: [],
      baseValue: baseV,
      multiplier: 0,
      isDiamondCard: true,
      diamondBonus: 3,
    };
  }
  if (pr < 0.60) {
    const isHigh = Math.random() < 0.5;
    const black: Suit[] = ['spades', 'clubs'];
    const red: Suit[] = ['hearts', 'diamonds'];
    const pair = black.includes(suit)
      ? [suit, randomFrom(red)]
      : [suit, randomFrom(black)];
    if (isHigh) {
      return {
        ...noDiamond,
        id: makeAttrId(), suit, rank, quality: q,
        effects: [
          { type: 'double_suit', suits: pair as Suit[] },
          { type: 'high_score', value: 20 },
        ],
        baseValue: baseV + 20,
        multiplier: 0,
      };
    }
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
  const isHighCross = Math.random() < 0.5;
  const ranks = randomFrom(CROSS_VALUE_GROUPS);
  const baseCross = Math.max(...ranks.map(r => scoreValue(r as Rank)));
  if (isHighCross) {
    return {
      ...noDiamond,
      id: makeAttrId(), suit, rank, quality: q,
      effects: [
        { type: 'cross_value', ranks },
        { type: 'high_score', value: 20 },
      ],
      baseValue: baseCross + 20,
      multiplier: 0,
    };
  }
  return {
    ...noDiamond,
    id: makeAttrId(), suit, rank, quality: q,
    effects: [
      { type: 'cross_value', ranks },
      { type: 'multiplier', value: 3 },
    ],
    baseValue: baseCross,
    multiplier: 3,
  };
}

/** 除 id 外完全一致则视为同一张牌（多槽生成时禁止重复签名） */
function attributeCardSignature(c: Card): string {
  const eff = [...(c.effects ?? [])].sort((a, b) => {
    const ta = String(a.type);
    const tb = String(b.type);
    if (ta !== tb) return ta.localeCompare(tb);
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
  return `${c.suit}|${c.rank}|${c.quality}|${JSON.stringify(eff)}`;
}

/** 生成 3 张属性牌备选：每槽独立掷品质（30/40/30）与策划 §3 效果（蓝仅跨/双、紫钻 20%+跨/双各 40%），签名去重 */
export function generateAttributeCardOptions(): Card[] {
  return generateAttributeCardOptionsCount(3);
}

/** 生成 `count` 张属性牌：每槽 `generateOneAttributeCard()`，签名去重 */
export function generateAttributeCardOptionsCount(count: number): Card[] {
  if (count <= 0) return [];
  const used = new Set<string>();
  const out: Card[] = [];
  const maxTriesPerSlot = count === 3 ? 100 : 80;
  for (let i = 0; i < count; i++) {
    let card = generateOneAttributeCard();
    let tries = 0;
    while (used.has(attributeCardSignature(card)) && tries < maxTriesPerSlot) {
      card = generateOneAttributeCard();
      tries++;
    }
    used.add(attributeCardSignature(card));
    out.push(card);
  }
  return out;
}

/**
 * 关卡序号 k（从 1 计）：k=1、2 固定 330；`k % 3 === 0` 且 k≥3 为精英池，否则普通池。
 * 见 `Roguelike2.0统一关后商店设计.md`
 */
export function pickUnifiedShopComposition(shopStageK: number): { skills: number; upgrades: number; attributes: number } {
  if (shopStageK === 1 || shopStageK === 2) {
    return { skills: 3, upgrades: 3, attributes: 0 };
  }
  const elite = shopStageK % 3 === 0;
  if (elite) {
    return Math.random() < 0.5
      ? { skills: 3, upgrades: 3, attributes: 0 }
      : { skills: 3, upgrades: 2, attributes: 1 };
  }
  const i = Math.floor(Math.random() * 3);
  if (i === 0) return { skills: 2, upgrades: 2, attributes: 2 };
  if (i === 1) return { skills: 2, upgrades: 3, attributes: 1 };
  return { skills: 1, upgrades: 3, attributes: 2 };
}

function toSkillShopOptions(
  skills: SkillDef[],
  forceNormal = false,
  useRefreshSkillEdgeOdds = false,
  blackEdgeInject?: {
    shopStageK: number;
    ownedBlackCount: number;
    pityGateN: number | null;
    pityMisses: number;
    pityCooldown: number;
  },
): SkillShopOption[] {
  const enhancements = rollSkillShopEnhancements(skills.length, forceNormal, useRefreshSkillEdgeOdds);
  const base = skills.map((skill, i) => {
    const enhancement = enhancements[i] ?? 'normal';
    return {
      skill,
      enhancement,
      price: getSkillPurchasePrice(skill, enhancement),
      purchased: false,
    };
  });

  // 黑边定向保底：仅对技能候选生效，且每关最多保证 1 张黑边；若已自然出现黑边则不注入。
  if (blackEdgeInject && base.length > 0) {
    const alreadyHasBlack = base.some(o => o.enhancement === 'black');
    const canInject =
      !alreadyHasBlack &&
      blackEdgeInject.pityGateN != null &&
      blackEdgeInject.shopStageK >= blackEdgeGateK(blackEdgeInject.pityGateN) &&
      blackEdgeInject.ownedBlackCount <= blackEdgeInject.pityGateN &&
      blackEdgeInject.pityCooldown <= 0;

    if (canInject) {
      const p = blackEdgePityChance(blackEdgeInject.pityMisses);
      if (Math.random() < p) {
        // 优先选择 normal 槽，避免覆盖银/金/彩
        const normals = base
          .map((o, i) => ({ o, i }))
          .filter(x => x.o.enhancement === 'normal');
        const pickFrom = normals.length > 0 ? normals : base.map((o, i) => ({ o, i })).filter(x => x.o.enhancement !== 'black');
        if (pickFrom.length > 0) {
          const idx = pickFrom[Math.floor(Math.random() * pickFrom.length)].i;
          base[idx] = {
            ...base[idx],
            enhancement: 'black',
            price: getSkillPurchasePrice(base[idx].skill, 'black'),
          };
        }
      }
    }
  }

  return base;
}

function toUpgradeShopOptions(options: UpgradeOption[]): UpgradeShopOption[] {
  return options.map(option => ({
    option,
    price: UPGRADE_PRICE,
    purchased: false,
  }));
}

function toAttributeShopOptions(cards: Card[]): AttributeShopOption[] {
  return cards.map(card => ({
    card,
    price: ATTRIBUTE_PRICE_BY_QUALITY[card.quality] ?? 1,
    purchased: false,
  }));
}

function buildUnifiedShopPayload(
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  skillEnhancements: Record<string, SkillEnhancement>,
  shopStageK: number,
  soldSkillIds: string[] = [],
  /** 统一商店 💎 刷新后的技能边权重（仍受 k≤2 强制无边） */
  useRefreshSkillEdgeOdds = false,
  blackEdgePity?: { gateN: number | null; misses: number; cooldown: number },
  allowedSkillIds?: Set<string>,
): Pick<RewardState, 'skillOptions' | 'upgradeOptions' | 'attributeOptions'> {
  const { skills, upgrades, attributes } = pickUnifiedShopComposition(shopStageK);
  const afterEliteSkills = shopStageK % 3 === 0;
  const skillDefs = generateSkillOptionsCount(acquiredSkillIds, afterEliteSkills, skills, shopStageK, soldSkillIds, allowedSkillIds);
  const upgradeOpts = generateUpgradeOptionsCount(upgradeMap, upgrades);
  const attrCards = generateAttributeCardOptionsCount(attributes);
  /** k=1、2：技能不带边（强化均为 normal） */
  const forceNormalSkillEdge = shopStageK <= 2;
  return {
    skillOptions:     toSkillShopOptions(
      skillDefs,
      forceNormalSkillEdge,
      useRefreshSkillEdgeOdds,
      {
        shopStageK,
        ownedBlackCount: countOwnedBlackEdges(acquiredSkillIds, skillEnhancements),
        pityGateN: blackEdgePity?.gateN ?? null,
        pityMisses: blackEdgePity?.misses ?? 0,
        pityCooldown: blackEdgePity?.cooldown ?? 0,
      },
    ),
    upgradeOptions:   toUpgradeShopOptions(upgradeOpts),
    attributeOptions: toAttributeShopOptions(attrCards),
  };
}

/**
 * 在统一商店初始 Roll 中随机选一个 IAA 商品槽。
 * 资格：技能品质非绿色；升级牌全部资格；属性牌品质非绿色。
 * 返回 0-based 槽索引（[skills…, upgrades…, attrs…]），无可选则返回 -1。
 */
export function pickIaaItemSlotIndex(
  skills: Pick<SkillShopOption, 'skill' | 'purchased'>[],
  upgrades: Pick<UpgradeShopOption, 'purchased'>[],
  attrs: Pick<AttributeShopOption, 'card' | 'purchased'>[],
): number {
  const eligible: number[] = [];
  skills.forEach((s, i) => {
    if (!s.purchased && s.skill.quality !== 'green') eligible.push(i);
  });
  upgrades.forEach((u, i) => {
    if (!u.purchased) eligible.push(skills.length + i);
  });
  attrs.forEach((a, i) => {
    if (!a.purchased && a.card.quality !== 'green') eligible.push(skills.length + upgrades.length + i);
  });
  if (eligible.length === 0) return -1;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/** 关后统一 6 卡商店（一次）；`shopStageK` = 本关序号从 1 计（与 `generateRewardForStage` 传入的 `groupIndex+1` 一致） */
export function generateUnifiedRewardState(
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  skillEnhancements: Record<string, SkillEnhancement>,
  shopStageK: number,
  soldSkillIds: string[] = [],
  blackEdgePity?: { gateN: number | null; misses: number; cooldown: number },
  allowedSkillIds?: Set<string>,
): RewardState {
  const payload = buildUnifiedShopPayload(upgradeMap, acquiredSkillIds, skillEnhancements, shopStageK, soldSkillIds, false, blackEdgePity, allowedSkillIds);
  const ownedBlack = countOwnedBlackEdges(acquiredSkillIds, skillEnhancements);
  const iaaItemSlotIndex = pickIaaItemSlotIndex(
    payload.skillOptions,
    payload.upgradeOptions,
    payload.attributeOptions,
  );
  return {
    step: 'unified',
    ...payload,
    pendingSteps: [],
    afterElite: shopStageK % 3 === 0,
    shopStageK,
    diamondRefreshCost: DEFAULT_DIAMOND_REFRESH_COST,
    refreshUsedWithDiamonds: false,
    refreshUsedWithIaa: false,
    iaaItemSlotIndex,
    isOpeningReward: false,
    blackEdgeOwnedAtOpen: ownedBlack,
    blackEdgeSeenThisShop: payload.skillOptions.some(o => o.enhancement === 'black'),
    blackEdgeGateN: blackEdgePity?.gateN ?? null,
  };
}

/**
 * @param groupIndex  主线：`stageIndex`（0-based）；无限：本关胜利时的 `endlessStagesCleared`（0-based）
 * @param allowedSkillIds  本局允许的技能 ID 集合（主线技能解锁限制）；undefined = 不过滤
 */
export function generateRewardForStage(
  groupIndex: number,
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  skillEnhancements: Record<string, SkillEnhancement>,
  _afterEliteUnused = false,
  _isEndlessUnused = false,
  soldSkillIds: string[] = [],
  blackEdgePity?: { gateN: number | null; misses: number; cooldown: number },
  allowedSkillIds?: Set<string>,
): RewardState {
  const shopStageK = groupIndex + 1;
  return generateUnifiedRewardState(upgradeMap, acquiredSkillIds, skillEnhancements, shopStageK, soldSkillIds, blackEdgePity, allowedSkillIds);
}

export function regenerateShopOptionsForStep(
  step: RewardStep,
  upgradeMap: HandTypeUpgradeMap,
  acquiredSkillIds: string[],
  skillEnhancements: Record<string, SkillEnhancement>,
  afterElite = false,
  forceNormalSkillEnhancement = false,
  unifiedShopK?: number,
  soldSkillIds: string[] = [],
  /** 统一商店且本次为 💎 刷新后的整页重 Roll：技能边用「刷新套」权重 */
  unifiedUseRefreshSkillEdgeOdds = false,
  blackEdgePity?: { gateN: number | null; misses: number; cooldown: number },
  allowedSkillIds?: Set<string>,
): Pick<RewardState, 'skillOptions' | 'upgradeOptions' | 'attributeOptions'> {
  if (step === 'unified') {
    const k = unifiedShopK ?? 1;
    return buildUnifiedShopPayload(
      upgradeMap,
      acquiredSkillIds,
      skillEnhancements,
      k,
      soldSkillIds,
      unifiedUseRefreshSkillEdgeOdds,
      blackEdgePity,
      allowedSkillIds,
    );
  }
  if (step === 'skill') {
    return {
      skillOptions: toSkillShopOptions(
        generateSkillOptions(acquiredSkillIds, afterElite, undefined, soldSkillIds),
        forceNormalSkillEnhancement,
        false,
        blackEdgePity && {
          shopStageK: blackEdgeGateK(0), // 非统一商店场景不传 k，默认视为门槛已过；当前流程通常不会走到此分支
          ownedBlackCount: countOwnedBlackEdges(acquiredSkillIds, skillEnhancements),
          pityGateN: blackEdgePity.gateN,
          pityMisses: blackEdgePity.misses,
          pityCooldown: blackEdgePity.cooldown,
        },
      ),
      upgradeOptions: [],
      attributeOptions: [],
    };
  }
  if (step === 'upgrade') {
    return {
      skillOptions: [],
      upgradeOptions: toUpgradeShopOptions(generateUpgradeOptions(upgradeMap)),
      attributeOptions: [],
    };
  }
  return {
    skillOptions: [],
    upgradeOptions: [],
    attributeOptions: toAttributeShopOptions(generateAttributeCardOptions()),
  };
}
