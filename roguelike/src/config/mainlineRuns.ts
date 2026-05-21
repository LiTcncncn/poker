import { FRAME_DEFS, MainlineRunDef, RunConfig } from '../types/profile';
import type { SkillEnhancement } from '../types/skill';

// ─── 工具函数 ─────────────────────────────────────────────────

/** 生成解锁顺序 1..n 的数组 */
function orders(max: number): number[] {
  return Array.from({ length: max }, (_, i) => i + 1);
}

const FRAME_TO_SKILL_ENHANCEMENT: Partial<Record<string, SkillEnhancement>> = {
  silver: 'flash',
  gold: 'gold',
  rainbow: 'laser',
  black: 'black',
};

export function getAllowedSkillEnhancementsAfterNormalRun(highestNormalCleared: number): SkillEnhancement[] {
  return FRAME_DEFS
    .filter((frame) => frame.unlockRunNo > 0 && highestNormalCleared >= frame.unlockRunNo)
    .map((frame) => FRAME_TO_SKILL_ENHANCEMENT[frame.id])
    .filter((enhancement): enhancement is SkillEnhancement => enhancement != null);
}

/** 普通模式默认配置（基准） */
function normalBase(
  stageCount: number,
  targetMultiplier: number,
  overrides: Partial<Omit<RunConfig, 'runNo' | 'difficulty'>> = {}
): Omit<RunConfig, 'runNo' | 'difficulty'> {
  return {
    stageCount,
    targetMultiplier,
    startingDiamonds: 3,
    banJokersGlobal: false,
    holdDelta: 0,
    handsDelta: 0,
    deckRule: 'standard',
    allHandTypesLv2: false,
    skillSlotBonus: 0,
    allowedSkillOrders: orders(1),
    banSkillShopEdges: false,
    shopRefreshCostDelta: 0,
    shopPriceDelta: 0,
    stageBaseDiamondZero: false,
    bossTargetMultiplier: 1,
    runBannedRankMax: 0,
    runBanFaceCardScore: false,
    runBannedHandTypePickCount: 0,
    runBannedHandTypes: [],
    shopPremiumSlotCount: 0,
    shopPremiumPriceMultiplier: 5,
    shopUpgradeSlotBonus: 0,
    shopAttributeSlotBonus: 0,
    ...overrides,
  };
}

type RunConfigSans = Omit<RunConfig, 'runNo' | 'difficulty'>;

/** 困难配置 = 普通配置 + 叠加项（后者覆盖同名字段） */
export function hardFromNormal(
  normal: RunConfigSans,
  extra: Partial<RunConfigSans> = {},
): RunConfigSans {
  return { ...normal, ...extra };
}

function mainlineRun(
  runNo: number,
  title: string,
  normalConfig: RunConfigSans,
  hardExtra: Partial<RunConfigSans>,
  displayTags: string[],
  hardDisplayTags: string[],
): MainlineRunDef {
  return {
    runNo,
    title,
    normalConfig,
    hardConfig: hardFromNormal(normalConfig, hardExtra),
    displayTags,
    hardDisplayTags,
  };
}

// ─── 50 局主线定义 ────────────────────────────────────────────

export const MAINLINE_RUNS: MainlineRunDef[] = [
  mainlineRun(
    1,
    '新手局！',
    normalBase(10, 1.0, { allowedSkillOrders: orders(1) }),
    { targetMultiplier: 1.1, banJokersGlobal: true },
    [],
    ['无 Joker', '目标略升'],
  ),

  mainlineRun(
    2,
    '出征！',
    normalBase(20, 0.92, { allowedSkillOrders: orders(1) }),
    { holdDelta: -1 },
    ['标准 20 关'],
    ['Hold -1'],
  ),

  mainlineRun(
    3,
    'HOLD 不住！',
    normalBase(20, 0.94, { allowedSkillOrders: orders(2), holdDelta: -1 }),
    { holdDelta: -2 },
    ['Hold -1'],
    ['Hold -2'],
  ),

  mainlineRun(
    4,
    '难上加难',
    normalBase(20, 0.95, { allowedSkillOrders: orders(3) }),
    { handsDelta: -1 },
    ['精英/Boss 手数 -1'],
    ['全局手数 -1'],
  ),

  mainlineRun(
    5,
    '无小丑夜',
    normalBase(20, 0.96, { allowedSkillOrders: orders(3), banJokersGlobal: true }),
    { holdDelta: -1 },
    ['无 Joker'],
    ['Hold -1'],
  ),

  mainlineRun(
    6,
    '牌型陷阱',
    normalBase(20, 0.98, { allowedSkillOrders: orders(3) }),
    {},
    ['精英/Boss 可能禁高牌/一对'],
    ['普通关也加入禁高牌'],
  ),

  mainlineRun(
    7,
    '命犯桃花',
    normalBase(20, 0.98, { allowedSkillOrders: orders(4), deckRule: 'two_suits_hs' }),
    { holdDelta: -1 },
    ['只有 ♥/♠ 花色归并'],
    ['Hold -1'],
  ),

  mainlineRun(
    8,
    '十面埋伏',
    normalBase(20, 0.99, { allowedSkillOrders: orders(4), deckRule: 'a_to_10' }),
    { banJokersGlobal: true },
    ['仅出现 A-10 牌'],
    ['无 Joker'],
  ),

  mainlineRun(
    9,
    '短牌试炼',
    normalBase(20, 1.0, { allowedSkillOrders: orders(5), deckRule: 'six_to_a' }),
    { holdDelta: -1 },
    ['仅出现 6-A 牌'],
    ['Hold -1'],
  ),

  mainlineRun(
    10,
    '无小丑恶梦',
    normalBase(20, 1.02, { allowedSkillOrders: orders(5), banJokersGlobal: true }),
    { handsDelta: -1 },
    ['无 Joker', 'Boss 目标 +10%'],
    ['手数 -1'],
  ),

  mainlineRun(
    11,
    '富矿开局',
    normalBase(20, 1.02, { allowedSkillOrders: orders(6), startingDiamonds: 10 }),
    { shopRefreshCostDelta: 3 },
    ['开局钻石 = 10', '目标 +8%'],
    ['商店刷新费用 +3'],
  ),

  mainlineRun(
    12,
    '技多不压身',
    normalBase(20, 1.03, { allowedSkillOrders: orders(6), skillSlotBonus: 1 }),
    { shopPriceDelta: 2 },
    ['技能槽 +1', '目标 +10%'],
    ['商店商品价格 +2'],
  ),

  mainlineRun(
    13,
    '高级牛马',
    normalBase(20, 1.04, { allowedSkillOrders: orders(7), allHandTypesLv2: true }),
    { banJokersGlobal: true },
    ['所有牌型 Lv.2', '目标 +15%'],
    ['无 Joker'],
  ),

  mainlineRun(
    14,
    '钱难赚！',
    normalBase(20, 1.05, { allowedSkillOrders: orders(7) }),
    { targetMultiplier: 1.10 },
    ['精英关基础收益降为 💎1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    15,
    '强人所难',
    normalBase(20, 1.06, { allowedSkillOrders: orders(8), holdDelta: -1 }),
    { holdDelta: -2 },
    ['Hold -1'],
    ['Hold -2'],
  ),

  mainlineRun(
    16,
    '小丑再失踪',
    normalBase(20, 1.06, {
      allowedSkillOrders: orders(8),
      banJokersGlobal: true,
      holdDelta: 1,
    }),
    { targetMultiplier: 1.10 },
    ['无 Joker', 'Hold +1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    17,
    '今日不顺',
    normalBase(20, 1.07, { allowedSkillOrders: orders(9) }),
    { targetMultiplier: 1.10 },
    ['精英/Boss 禁顺子线'],
    ['目标 +10%'],
  ),

  mainlineRun(
    18,
    '今日不花',
    normalBase(20, 1.08, { allowedSkillOrders: orders(9) }),
    { targetMultiplier: 1.10 },
    ['精英/Boss 禁同花线'],
    ['目标 +10%'],
  ),

  mainlineRun(
    19,
    '望牌兴叹',
    normalBase(20, 1.09, { allowedSkillOrders: orders(10) }),
    { handsDelta: -1 },
    ['目标 +9%'],
    ['手数 -1'],
  ),

  mainlineRun(
    20,
    '笑到最后',
    normalBase(20, 1.10, { allowedSkillOrders: orders(10), bossTargetMultiplier: 1.3 }),
    { holdDelta: -1 },
    ['Boss 关目标 +30%'],
    ['Hold -1'],
  ),

  mainlineRun(
    21,
    '小角色走开',
    normalBase(20, 1.10, { allowedSkillOrders: orders(11), runBannedRankMax: 6 }),
    { banJokersGlobal: true },
    ['2-6 牌面分不计'],
    ['无 Joker'],
  ),

  mainlineRun(
    22,
    '大佬勿近',
    normalBase(20, 0.999, { allowedSkillOrders: orders(11), runBanFaceCardScore: true }),
    { targetMultiplier: 1.11, runBanFaceCardScore: true },
    ['J/Q/K 牌面分不计', '目标 -10%'],
    ['J/Q/K 牌面分不计'],
  ),

  mainlineRun(
    23,
    '黑色幽默',
    normalBase(20, 1.12, {
      allowedSkillOrders: orders(12),
      deckRule: 'two_suits_sc',
      holdDelta: -1,
    }),
    { targetMultiplier: 1.344 },
    ['只有 ♠/♣', 'Hold -1'],
    ['目标 +20%'],
  ),

  mainlineRun(
    24,
    '非卖品！',
    normalBase(20, 1.13, {
      allowedSkillOrders: orders(12),
      shopPremiumSlotCount: 2,
      shopPremiumPriceMultiplier: 5,
    }),
    { shopRefreshCostDelta: 3 },
    ['随机 2 个商品 💎×5'],
    ['商店刷新费用 +3'],
  ),

  mainlineRun(
    25,
    '短牌再袭',
    normalBase(20, 1.14, { allowedSkillOrders: orders(13), deckRule: 'six_to_a', holdDelta: -1 }),
    { targetMultiplier: 1.254 },
    ['6-A 牌堆', 'Hold -1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    26,
    '我要逆袭！',
    normalBase(20, 1.14, {
      allowedSkillOrders: orders(13),
      deckRule: 'a_to_10',
      handsDelta: -1,
    }),
    { targetMultiplier: 1.254 },
    ['A-10 牌堆', '手数 -1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    27,
    '升级狂潮',
    normalBase(20, 1.15, {
      allowedSkillOrders: orders(14),
      shopUpgradeSlotBonus: 1,
      shopPriceDelta: 2,
    }),
    { targetMultiplier: 1.265 },
    ['升级牌占比 +1', '商店商品价格 +2'],
    ['目标 +10%'],
  ),

  mainlineRun(
    28,
    '超级牌狂潮',
    normalBase(20, 1.16, { allowedSkillOrders: orders(14), shopAttributeSlotBonus: 1 }),
    { targetMultiplier: 1.276 },
    ['超级牌占比 +1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    29,
    '真难受！',
    normalBase(20, 1.17, {
      allowedSkillOrders: orders(15),
      holdDelta: -1,
      handsDelta: -1,
    }),
    { targetMultiplier: 1.287 },
    ['Hold -1', '手数 -1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    30,
    '压力山大',
    normalBase(20, 1.18, {
      allowedSkillOrders: orders(15),
      bossTargetMultiplier: 1.15,
      runBannedHandTypePickCount: 3,
    }),
    { targetMultiplier: 1.357 },
    ['Boss 目标 +15%', '本局禁三条'],
    ['目标 +15%'],
  ),

  mainlineRun(
    31,
    '又是同花局',
    normalBase(20, 1.18, {
      allowedSkillOrders: orders(16),
      deckRule: 'two_suits_hs',
      handsDelta: -1,
    }),
    { targetMultiplier: 1.298 },
    ['只有 ♥/♠', '手数 -1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    32,
    '无人区',
    normalBase(20, 1.19, { allowedSkillOrders: orders(16), deckRule: 'a_to_10' }),
    { banJokersGlobal: true },
    ['J/Q/K 不进牌堆', '数字牌主题'],
    ['无 Joker'],
  ),

  mainlineRun(
    33,
    '奇数枷锁',
    normalBase(20, 1.19, {
      allowedSkillOrders: orders(17),
      deckRule: 'odd_only',
      holdDelta: -1,
    }),
    { targetMultiplier: 1.3685 },
    ['只保留奇数牌', 'Hold -1'],
    ['目标 +15%'],
  ),

  mainlineRun(
    34,
    '技能过载',
    normalBase(20, 1.20, {
      allowedSkillOrders: orders(17),
      skillSlotBonus: 1,
      handsDelta: -1,
    }),
    { targetMultiplier: 1.38 },
    ['技能槽 +1', '手数 -1'],
    ['目标 +15%'],
  ),

  mainlineRun(
    35,
    '血色浪漫',
    normalBase(20, 1.20, {
      allowedSkillOrders: orders(18),
      deckRule: 'two_suits_hd',
      holdDelta: -1,
    }),
    { targetMultiplier: 1.38 },
    ['只有 ♥/♦', 'Hold -1'],
    ['目标 +15%'],
  ),

  mainlineRun(
    36,
    '步数陷阱',
    normalBase(20, 1.21, {
      allowedSkillOrders: orders(18),
      handsDelta: -1,
      shopPriceDelta: 2,
    }),
    { targetMultiplier: 1.3915 },
    ['手数 -1', '商店商品价格 +2'],
    ['目标 +15%'],
  ),

  mainlineRun(
    37,
    '我最头铁！',
    normalBase(20, 1.22, {
      allowedSkillOrders: orders(19),
      holdDelta: -2,
      startingDiamonds: 10,
    }),
    { targetMultiplier: 1.403 },
    ['Hold -2', '开局钻石 = 10'],
    ['目标 +15%'],
  ),

  mainlineRun(
    38,
    '黑心商店',
    normalBase(20, 1.22, {
      allowedSkillOrders: orders(19),
      shopRefreshCostDelta: 3,
      shopPriceDelta: 2,
    }),
    { targetMultiplier: 1.403 },
    ['商店刷新费用 +3', '商店商品价格 +2'],
    ['目标 +15%'],
  ),

  mainlineRun(
    39,
    '偶数枷锁',
    normalBase(20, 1.23, {
      allowedSkillOrders: orders(20),
      deckRule: 'even_only',
      handsDelta: -1,
    }),
    { targetMultiplier: 1.4145 },
    ['只保留偶数牌', '手数 -1'],
    ['目标 +15%'],
  ),

  mainlineRun(
    40,
    '冲刺阶段！',
    normalBase(20, 1.24, {
      allowedSkillOrders: orders(20),
      bossTargetMultiplier: 1.4,
      holdDelta: -1,
      startingDiamonds: 10,
    }),
    { targetMultiplier: 1.364 },
    ['Boss 目标 +40%', 'Hold -1', '开局钻石 = 10'],
    ['目标 +10%'],
  ),

  mainlineRun(
    41,
    '卧薪尝胆',
    normalBase(20, 1.24, {
      allowedSkillOrders: orders(21),
      holdDelta: -1,
      handsDelta: -1,
      skillSlotBonus: 1,
    }),
    { targetMultiplier: 1.364 },
    ['Hold -1', '手数 -1', '技能槽 +1'],
    ['目标 +10%'],
  ),

  mainlineRun(
    42,
    '小丑去死！',
    normalBase(20, 1.25, {
      allowedSkillOrders: orders(21),
      banJokersGlobal: true,
      holdDelta: -1,
      allHandTypesLv2: true,
    }),
    { targetMultiplier: 1.375 },
    ['无 Joker', 'Hold -1', '所有牌型 Lv.2'],
    ['目标 +10%'],
  ),

  mainlineRun(
    43,
    '无边之战！',
    normalBase(20, 1.26, {
      allowedSkillOrders: orders(22),
      handsDelta: -1,
      shopRefreshCostDelta: 3,
      banSkillShopEdges: true,
    }),
    { targetMultiplier: 1.386 },
    ['手数 -1', '刷新费 +3', '商店无带边技能'],
    ['目标 +10%'],
  ),

  mainlineRun(
    44,
    '对子陷阱',
    normalBase(20, 1.27, {
      allowedSkillOrders: orders(22),
      runBannedHandTypes: ['one_pair'],
      holdDelta: -1,
      startingDiamonds: 10,
    }),
    { targetMultiplier: 1.4605 },
    ['一对不计分', 'Hold -1', '开局钻石 = 10'],
    ['目标 +15%'],
  ),

  mainlineRun(
    45,
    '短牌终章',
    normalBase(20, 1.28, {
      allowedSkillOrders: orders(23),
      deckRule: 'six_to_a',
      banJokersGlobal: true,
      handsDelta: 1,
    }),
    { targetMultiplier: 1.472 },
    ['6-A 牌堆', '无 Joker', '手数 +1'],
    ['目标 +15%'],
  ),

  mainlineRun(
    46,
    '高牌歧视！',
    normalBase(20, 1.29, {
      allowedSkillOrders: orders(23),
      runBannedHandTypes: ['high_card'],
      holdDelta: -1,
      startingDiamonds: 10,
    }),
    { targetMultiplier: 1.4835 },
    ['高牌不计分', 'Hold -1', '开局钻石 = 10'],
    ['目标 +15%'],
  ),

  mainlineRun(
    47,
    '逆袭！',
    normalBase(20, 1.30, {
      allowedSkillOrders: orders(24),
      holdDelta: -2,
      handsDelta: -1,
      skillSlotBonus: 1,
    }),
    { targetMultiplier: 1.56 },
    ['Hold -2', '手数 -1', '技能槽 +1'],
    ['目标 +20%'],
  ),

  mainlineRun(
    48,
    '黑店！',
    normalBase(20, 1.30, {
      allowedSkillOrders: orders(24),
      shopRefreshCostDelta: 3,
      shopPriceDelta: 2,
      shopPremiumSlotCount: 2,
      shopPremiumPriceMultiplier: 5,
    }),
    { targetMultiplier: 1.56 },
    ['刷新费 +3', '全店 +2💎', '随机 2 商品 💎×5'],
    ['目标 +20%'],
  ),

  mainlineRun(
    49,
    '终局彩排',
    normalBase(20, 1.31, {
      allowedSkillOrders: orders(25),
      allHandTypesLv2: true,
      banJokersGlobal: true,
      handsDelta: -1,
    }),
    { targetMultiplier: 1.572 },
    ['无 Joker', '手数 -1', '所有牌型 Lv.2'],
    ['目标 +20%'],
  ),

  mainlineRun(
    50,
    '野人王座',
    normalBase(20, 1.32, {
      allowedSkillOrders: orders(26),
      bossTargetMultiplier: 2,
      holdDelta: -1,
      startingDiamonds: 10,
    }),
    { targetMultiplier: 1.584 },
    ['Boss 目标 +100%', 'Hold -1', '开局钻石 = 10'],
    ['目标 +20%'],
  ),
];

/** 根据局编号获取定义（1-based） */
export function getMainlineRunDef(runNo: number): MainlineRunDef | undefined {
  return MAINLINE_RUNS.find(r => r.runNo === runNo);
}

/** 根据局编号和难度构建 RunConfig */
export function buildRunConfig(
  runNo: number,
  difficulty: 'normal' | 'hard',
  highestNormalCleared: number,
): RunConfig | null {
  const def = getMainlineRunDef(runNo);
  if (!def) return null;

  // 计算当局可用技能顺序（取已解锁的最大值和本局配置交集）
  const baseConfig = difficulty === 'hard' ? def.hardConfig : def.normalConfig;

  return {
    runNo,
    difficulty,
    ...baseConfig,
    allowedSkillEnhancements: getAllowedSkillEnhancementsAfterNormalRun(highestNormalCleared),
  };
}

/** 自由挑战（无限挑战）配置：解锁全部技能，使用标准规则 */
export function buildFreeplayConfig(): RunConfig {
  return {
    runNo: 0,
    difficulty: 'freeplay',
    stageCount: 20,
    targetMultiplier: 1.0,
    startingDiamonds: 3,
    banJokersGlobal: false,
    holdDelta: 0,
    handsDelta: 0,
    deckRule: 'standard',
    allHandTypesLv2: false,
    skillSlotBonus: 0,
    allowedSkillOrders: Array.from({ length: 27 }, (_, i) => i + 1),
    allowedSkillEnhancements: ['flash', 'gold', 'laser', 'black'],
    shopRefreshCostDelta: 0,
    shopPriceDelta: 0,
    stageBaseDiamondZero: false,
    bossTargetMultiplier: 1,
    runBannedRankMax: 0,
    runBanFaceCardScore: false,
    runBannedHandTypePickCount: 0,
    runBannedHandTypes: [],
    shopPremiumSlotCount: 0,
    shopPremiumPriceMultiplier: 5,
    shopUpgradeSlotBonus: 0,
    shopAttributeSlotBonus: 0,
    banSkillShopEdges: false,
  };
}
