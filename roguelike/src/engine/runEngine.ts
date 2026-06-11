import { RunState, StageState, HandTypeUpgradeMap } from '../types/run';
import { SkillDef, SkillEnhancement } from '../types/skill';
import { Card, HandType } from '../shared/types/poker';
import { RunConfig } from '../types/profile';
import { initStage, pickModifierForStageIndex, initEndlessStage, pickEndlessModifier, pickRunWideBannedHandTypes } from './stageEngine';
import stageTemplates from '../config/runStageTemplates.json';
import newbieTemplates from '../config/newbieStageTemplates.json';

const STANDARD_TOTAL_STAGES = stageTemplates.length;
export const TOTAL_STAGES = STANDARD_TOTAL_STAGES;

type StageTpl = { targetGold: number; isElite: boolean; isBoss: boolean; handCount: number; holdCount: number };
const stageTplList = stageTemplates as StageTpl[];
const newbieTplList = newbieTemplates as StageTpl[];

/** 关卡基础目标 $（全局 targetMultiplier；Boss 关再叠 bossTargetMultiplier） */
function stageTargetGoldOverride(
  tpl: StageTpl,
  targetMult: number,
  bossTargetMult: number,
): number {
  let mult = targetMult;
  if (tpl.isBoss && bossTargetMult > 0 && bossTargetMult !== 1) {
    mult *= bossTargetMult;
  }
  return Math.round(tpl.targetGold * mult);
}

/** 无限阶段递推起点：主线最后一关 targetGold（与 JSON 同步） */
const ENDLESS_SEED_GOLD = stageTplList[stageTplList.length - 1].targetGold;

/**
 * 无限阶段目标金币增长（种子 = 主线末关 `runStageTemplates.json` 的 targetGold）：
 * - 递推粒度：每关一次（与“每关一次统一商店机会”一致）
 * - 无尽精英关：无尽第 3、6、9… 关（即显示关号 23、26、29…）额外乘 ELITE
 * - 取整：千位四舍五入
 * - 单调：与上一关取 max
 *
 * 目标：21～35 偏陡以抵抗 build 成型；36～60 平滑放缓，使 60 关目标约 1.5M（取整后约 1,499,000）。
 * 通过“显示关号 k（主线 1～20 + 无尽 21…）”驱动倍率，而非简单常量倍率。
 */
const ENDLESS_RATE_DECAY_START_K = 36; // 从第 36 关开始放缓
const ENDLESS_RATE_DECAY_END_K   = 60; // 到第 60 关放缓到下限
const ENDLESS_NORMAL_RATE_HI = 1.09;
const ENDLESS_ELITE_BONUS_HI = 1.045;
const ENDLESS_NORMAL_RATE_LO = 1.058;
const ENDLESS_ELITE_BONUS_LO = 1.036;
/** 无限关目标取整到千位（末三位为 0） */
const ENDLESS_GOLD_ROUND = 1000;

function roundEndlessGold(gold: number): number {
  return Math.round(gold / ENDLESS_GOLD_ROUND) * ENDLESS_GOLD_ROUND;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function endlessRateT(displayK: number): number {
  const denom = Math.max(1, ENDLESS_RATE_DECAY_END_K - ENDLESS_RATE_DECAY_START_K);
  return clamp01((displayK - ENDLESS_RATE_DECAY_START_K) / denom);
}

function endlessNormalRate(displayK: number): number {
  const t = endlessRateT(displayK);
  return ENDLESS_NORMAL_RATE_HI - (ENDLESS_NORMAL_RATE_HI - ENDLESS_NORMAL_RATE_LO) * t;
}

function endlessEliteBonus(displayK: number): number {
  const t = endlessRateT(displayK);
  return ENDLESS_ELITE_BONUS_HI - (ENDLESS_ELITE_BONUS_HI - ENDLESS_ELITE_BONUS_LO) * t;
}

function newRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 局内 💎 绝对下限（「超级信用卡」负债） */
export const RUN_DIAMONDS_ABS_FLOOR = -20;

export function clampRunDiamonds(n: number): number {
  return Math.max(RUN_DIAMONDS_ABS_FLOOR, n);
}

/** 「卖方市场」等为已拥有技能叠加的卖出回收价加成，单技能 id 累计上限 */
export const SKILL_SELL_BONUS_CAP = 8;

/** 将卖出加成规约到 [0, SKILL_SELL_BONUS_CAP] 的整数（持久化或非数字脏值安全） */
export function clampSkillSellExtraDiamonds(raw: unknown): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(SKILL_SELL_BONUS_CAP, Math.floor(v));
}

/** 局级手数增量：全关 handsDelta + 精英/Boss 专属增量 */
function resolveStageHandsDelta(
  tpl: Pick<StageTpl, 'isElite' | 'isBoss'>,
  globalHandsDelta: number,
  eliteOnlyHandsDelta: number,
): number {
  let delta = globalHandsDelta;
  if ((tpl.isElite || tpl.isBoss) && eliteOnlyHandsDelta !== 0) {
    delta += eliteOnlyHandsDelta;
  }
  return delta;
}

/** 合并局级禁牌型、精英基础钻等到关卡状态 */
export function applyRunLevelStageRules(
  stage: StageState,
  tpl: Pick<StageTpl, 'isElite' | 'isBoss'>,
  runWideBannedHandTypes: HandType[],
  runEliteOnlyBannedHandTypes: HandType[],
  runEliteStageBaseDiamond: number,
): StageState {
  let next = mergeRunLevelStageBans(stage, tpl, runWideBannedHandTypes, runEliteOnlyBannedHandTypes);
  if (tpl.isElite && runEliteStageBaseDiamond > 0) {
    next = { ...next, stageBaseDiamondReward: runEliteStageBaseDiamond };
  }
  return next;
}

/** 合并局级禁牌型（全关 + 仅精英/Boss）到关卡状态 */
export function mergeRunLevelStageBans(
  stage: StageState,
  tpl: Pick<StageTpl, 'isElite' | 'isBoss'>,
  runWideBannedHandTypes: HandType[],
  runEliteOnlyBannedHandTypes: HandType[],
): StageState {
  let bannedHandTypes = [...(stage.bannedHandTypes ?? [])];
  if (runWideBannedHandTypes.length > 0) {
    bannedHandTypes = [...new Set([...bannedHandTypes, ...runWideBannedHandTypes])];
  }
  if ((tpl.isElite || tpl.isBoss) && runEliteOnlyBannedHandTypes.length > 0) {
    bannedHandTypes = [...new Set([...bannedHandTypes, ...runEliteOnlyBannedHandTypes])];
  }
  return { ...stage, bannedHandTypes };
}

/** 初始化一局新 Run，自动为精英/Boss 关分配词缀 */
export function initRun(config?: RunConfig): RunState {
  const isNewbie = config?.stageCount === 10;
  const tplList = isNewbie ? newbieTplList : stageTplList;
  const stageCount = config?.stageCount ?? STANDARD_TOTAL_STAGES;
  const targetMult = config?.targetMultiplier ?? 1.0;
  const bossTargetMult = config?.bossTargetMultiplier ?? 1;
  const holdDelta = config?.holdDelta ?? 0;
  const handsDelta = config?.handsDelta ?? 0;
  const runBannedRankMax = config?.runBannedRankMax ?? 0;
  const runBanFaceCardScore = config?.runBanFaceCardScore ?? false;
  const runBannedHandTypePickCount = config?.runBannedHandTypePickCount ?? 0;
  const runBannedHandTypesFixed = config?.runBannedHandTypes ?? [];
  const runWideBannedHandTypes = [
    ...new Set([
      ...pickRunWideBannedHandTypes(runBannedHandTypePickCount),
      ...runBannedHandTypesFixed,
    ]),
  ];
  const runEliteOnlyBannedHandTypes = config?.runEliteOnlyBannedHandTypes ?? [];
  const runEliteOnlyHandsDelta = config?.runEliteOnlyHandsDelta ?? 0;
  const runEliteStageBaseDiamond = config?.runEliteStageBaseDiamond ?? 0;
  const startDiamonds = config?.startingDiamonds ?? 3;

  // 先为精英/Boss 关卡分配词缀 ID
  const stageModifiers: Record<number, string> = {};
  tplList.slice(0, stageCount).forEach((t, i) => {
    if (t.isElite || t.isBoss) {
      stageModifiers[i] = pickModifierForStageIndex(i);
    }
  });

  const stages: StageState[] = tplList.slice(0, stageCount).map((t, i) => {
    const modId = stageModifiers[i];
    const stage = initStage(i, modId, {
      targetGoldOverride: stageTargetGoldOverride(t, targetMult, bossTargetMult),
      holdDelta,
      handsDelta: resolveStageHandsDelta(t, handsDelta, runEliteOnlyHandsDelta),
      runBannedRankMax,
      runBanFaceCardScore,
    }, tplList);
    const withRunRules = applyRunLevelStageRules(
      stage,
      t,
      runWideBannedHandTypes,
      runEliteOnlyBannedHandTypes,
      runEliteStageBaseDiamond,
    );
    return { ...withRunRules, status: i === 0 ? 'active' : 'pending' } as StageState;
  });

  // 所有牌型 Lv.2 起步
  const handTypeUpgrades: HandTypeUpgradeMap = config?.allHandTypesLv2
    ? {
        high_card: 2, one_pair: 2, two_pairs: 2, three_of_a_kind: 2,
        straight: 2, flush: 2, full_house: 2, four_of_a_kind: 2,
        straight_flush: 2, royal_flush: 2,
      }
    : {} as HandTypeUpgradeMap;

  return {
    runId: newRunId(),
    currentStageIndex: 0,
    stages,
    handTypeUpgrades,
    acquiredSkillIds: [],
    soldSkillIds: [],
    skillEnhancements: {},
    skillSlotCap: 5 + (config?.skillSlotBonus ?? 0),
    attributeCards: [],
    runDiamonds: startDiamonds,
    skillSellBonus: {},
    diamondsEarnedTotal: 0,
    diamondsSpentTotal: 0,
    status: 'running',
    startedAt: Date.now(),
    skillAccumulation: {},
    stageModifiers,
    blackEdgePityGateN: undefined,
    blackEdgePityMisses: 0,
    blackEdgePityCooldown: 0,
    isEndless: false,
    endlessStagesCleared: 0,
    totalGoldEarned: 0,
    handsPlayedTotal: 0,
    highestSingleStageTarget: 0,
    bestHandThisRun: null,
    maxSingleHandGold: 0,
    iaa: undefined,
    // 多局长线字段
    runNo: config?.runNo ?? 0,
    difficulty: config?.difficulty ?? 'freeplay',
    deckRule: config?.deckRule ?? 'standard',
    runBanJokers: config?.banJokersGlobal ?? false,
    runHoldDelta: holdDelta,
    runHandsDelta: handsDelta,
    runShopRefreshCostDelta: config?.shopRefreshCostDelta ?? 0,
    runShopPriceDelta: config?.shopPriceDelta ?? 0,
    runShopUpgradeSlotBonus: config?.shopUpgradeSlotBonus ?? 0,
    runShopAttributeSlotBonus: config?.shopAttributeSlotBonus ?? 0,
    allowedSkillOrders: config?.allowedSkillOrders ?? Array.from({ length: 29 }, (_, i) => i + 1),
    allowedSkillEnhancements:
      config?.allowedSkillEnhancements ?? ['flash', 'gold', 'laser', 'black'],
    runBanSkillShopEdges: config?.banSkillShopEdges ?? false,
    runTargetMultiplier: targetMult,
    runBossTargetMultiplier: bossTargetMult,
    runBannedRankMax,
    runBanFaceCardScore,
    runShopPremiumSlotCount: config?.shopPremiumSlotCount ?? 0,
    runShopPremiumPriceMultiplier: config?.shopPremiumPriceMultiplier ?? 5,
    runShopPremiumFixedPrice: config?.shopPremiumFixedPrice ?? 0,
    runBannedHandTypesWide: runWideBannedHandTypes,
    runEliteOnlyBannedHandTypes,
    runEliteOnlyHandsDelta,
    runEliteStageBaseDiamond,
    runStageCount: stageCount,
  };
}

/** 更新 run 里某个关卡的状态 */
export function updateStageInRun(run: RunState, updatedStage: StageState): RunState {
  const stages = run.stages.map(s =>
    s.stageIndex === updatedStage.stageIndex ? updatedStage : s
  );
  return { ...run, stages };
}

/** 关卡胜利后推进到下一关，携带新技能、升级和属性牌 */
export function advanceToNextStage(
  run: RunState,
  upgrades: HandTypeUpgradeMap,
  newSkills: SkillDef[],
  newAttributeCards: import('../shared/types/poker').Card[] = [],
): RunState {
  const next = run.currentStageIndex + 1;
  const newSkillIds = [...run.acquiredSkillIds, ...newSkills.map(s => s.id)];
  const mergedAttrCards = [...run.attributeCards, ...newAttributeCards];

  // 使用 RunState 存储的局级参数
  const stageCount = run.runStageCount ?? resolveRunStageCount(run);
  const tplList = stageCount === 10 ? newbieTplList : stageTplList;
  const targetMult = run.runTargetMultiplier ?? 1.0;
  const bossTargetMult = run.runBossTargetMultiplier ?? 1;
  const runBannedRankMax = run.runBannedRankMax ?? 0;
  const runBanFaceCardScore = run.runBanFaceCardScore ?? false;

  if (next >= stageCount) {
    return {
      ...run,
      handTypeUpgrades: upgrades,
      acquiredSkillIds: newSkillIds,
      attributeCards: mergedAttrCards,
      status: 'victory',
    };
  }

  const modId = run.stageModifiers[next];
  const tpl = tplList[next] ?? { targetGold: 0, isElite: false, isBoss: false, handCount: 6, holdCount: 6 };
  const runWideBans = run.runBannedHandTypesWide ?? [];
  const eliteOnlyBans = run.runEliteOnlyBannedHandTypes ?? [];
  const eliteOnlyHandsDelta = run.runEliteOnlyHandsDelta ?? 0;
  const eliteStageBaseDiamond = run.runEliteStageBaseDiamond ?? 0;
  const stages = run.stages.map((s, i) => {
    if (i === next) {
      const stage = initStage(i, modId, {
        targetGoldOverride: stageTargetGoldOverride(tpl, targetMult, bossTargetMult),
        holdDelta: run.runHoldDelta ?? 0,
        handsDelta: resolveStageHandsDelta(tpl, run.runHandsDelta ?? 0, eliteOnlyHandsDelta),
        runBannedRankMax,
        runBanFaceCardScore,
      }, tplList);
      return {
        ...applyRunLevelStageRules(stage, tpl, runWideBans, eliteOnlyBans, eliteStageBaseDiamond),
        status: 'active' as const,
      };
    }
    return s;
  });

  return {
    ...run,
    stages,
    currentStageIndex: next,
    handTypeUpgrades: upgrades,
    acquiredSkillIds: newSkillIds,
    attributeCards: mergedAttrCards,
  };
}

/** 整局 Run 失败 */
export function defeatRun(run: RunState): RunState {
  return { ...run, status: 'defeat' };
}

// ─── 无限挑战阶段 ─────────────────────────────────────────────

/**
 * 计算无限挑战第 endlessIdx 关（0-based）的目标金币。
 * - 短主线（如新手 10 关）：显示关 11～20 对齐 `runStageTemplates.json` 第 11～20 关曲线（含局目标倍率）；
 *   显示关 21 起与标准 20 关主线相同，从末关 40000 递推到约 44000，再按无尽公式继续。
 * - 标准 20 关主线：显示关 21 起沿用无尽递推。
 */
function calcEndlessTargetGold(
  endlessIdx: number,
  mainStageCount = TOTAL_STAGES,
  targetMult = 1.0,
  bossTargetMult = 1,
): number {
  const displayK = mainStageCount + endlessIdx + 1;

  if (displayK <= STANDARD_TOTAL_STAGES) {
    const tpl = stageTplList[displayK - 1];
    if (tpl) {
      return stageTargetGoldOverride(tpl, targetMult, bossTargetMult);
    }
  }

  let gold = ENDLESS_SEED_GOLD;
  const bridgeStageCount = Math.max(0, STANDARD_TOTAL_STAGES - mainStageCount);
  const trueEndlessIdx = endlessIdx - bridgeStageCount;

  for (let i = 0; i <= trueEndlessIdx; i++) {
    const k = STANDARD_TOTAL_STAGES + i + 1;
    const isThisElite = (i + 1) % 3 === 0;
    const raw = gold * endlessNormalRate(k) * (isThisElite ? endlessEliteBonus(k) : 1);
    const rounded = roundEndlessGold(raw);
    gold = Math.max(gold, rounded);
  }
  return gold;
}

/** 当前 run 的主线关数（新手局 10，标准局 20；老存档缺字段时按 runNo 推断） */
export function resolveRunStageCount(run: Pick<RunState, 'runStageCount' | 'runNo'>): number {
  if (run.runNo === 1) return 10;
  if (run.runStageCount != null && run.runStageCount > 0) return run.runStageCount;
  return TOTAL_STAGES;
}

/** 当前 run 的无尽关固定槽位：等于本局主线关数（新手局 10，标准局 20） */
export function getEndlessStageIndex(run: Pick<RunState, 'runStageCount' | 'runNo'>): number {
  return resolveRunStageCount(run);
}

/** 生成无限阶段的第 endlessIdx 关（0-based） */
function buildEndlessStage(
  endlessIdx: number,
  mainStageCount = TOTAL_STAGES,
  targetMult = 1.0,
  bossTargetMult = 1,
): StageState {
  const isElite   = (endlessIdx + 1) % 3 === 0;
  const targetGold = calcEndlessTargetGold(endlessIdx, mainStageCount, targetMult, bossTargetMult);
  // endlessEliteIdx：当前是第几个精英关
  const endlessEliteIdx = Math.floor(endlessIdx / 3);
  const modId = isElite ? pickEndlessModifier(endlessEliteIdx) : undefined;
  return initEndlessStage(mainStageCount + endlessIdx, targetGold, isElite, modId);
}

/**
 * 主线胜利后进入无限挑战模式。
 * 立即生成第一个无限关（index = runStageCount），status 回到 'running'。
 */
export function enterEndlessMode(run: RunState): RunState {
  const mainStageCount = resolveRunStageCount(run);
  const endlessStageIndex = getEndlessStageIndex(run);
  const targetMult = run.runTargetMultiplier ?? 1.0;
  const bossTargetMult = run.runBossTargetMultiplier ?? 1;
  const firstEndlessStage = buildEndlessStage(0, mainStageCount, targetMult, bossTargetMult);
  const stages = [...run.stages];
  stages[endlessStageIndex] = firstEndlessStage;
  return {
    ...run,
    isEndless: true,
    endlessStagesCleared: 0,
    status: 'running',
    stages,
    currentStageIndex: endlessStageIndex,
    highestSingleStageTarget: Math.max(run.highestSingleStageTarget, firstEndlessStage.targetGold),
  };
}

/**
 * 无限阶段关卡胜利后，累计技能/升级/属性牌并推进到下一无限关。
 * 新关卡覆写 stages[runStageCount]，currentStageIndex 保持该无尽槽位。
 */
export function advanceToNextEndlessStage(
  run: RunState,
  upgrades: HandTypeUpgradeMap,
  newSkills: SkillDef[],
  newAttributeCards: Card[] = [],
): RunState {
  const newEndlessCount = run.endlessStagesCleared + 1;
  const mainStageCount = resolveRunStageCount(run);
  const endlessStageIndex = getEndlessStageIndex(run);
  const targetMult = run.runTargetMultiplier ?? 1.0;
  const bossTargetMult = run.runBossTargetMultiplier ?? 1;
  const nextStage = buildEndlessStage(newEndlessCount, mainStageCount, targetMult, bossTargetMult);

  const updatedStages = [...run.stages];
  updatedStages[endlessStageIndex] = nextStage; // 覆写无限关槽位

  return {
    ...run,
    handTypeUpgrades: upgrades,
    acquiredSkillIds: [...run.acquiredSkillIds, ...newSkills.map(s => s.id)],
    attributeCards:   [...run.attributeCards, ...newAttributeCards],
    endlessStagesCleared: newEndlessCount,
    stages: updatedStages,
    currentStageIndex: endlessStageIndex,
    highestSingleStageTarget: Math.max(run.highestSingleStageTarget, nextStage.targetGold),
  };
}

/** 已上阵技能中「黑边」枚数 */
export function countBlackEdgeSlots(
  skillEnhancements: Record<string, SkillEnhancement>,
  acquiredSkillIds: string[],
): number {
  return acquiredSkillIds.filter(id => skillEnhancements[id] === 'black').length;
}

/**
 * 当前总技能槽（分母）：**基础 `skillSlotCap` + 黑边枚数**。
 * 黑边牌面「技能+1」指总上限较基础多出的 **1 格即该黑边牌所占的那一格**，不会在「入队一张牌」与「黑边效果」上对分母做两次 +1（例：基础 5、0 黑时 `4/5`，购入并上阵 1 枚黑边后为 `5/6`，而非 `5/7`）。
 * 多张黑边仍线性叠加；与扩容等来源可再加算（见策划稿）。
 */
export function getEffectiveSkillSlotCap(run: RunState): number {
  return run.skillSlotCap + countBlackEdgeSlots(run.skillEnhancements, run.acquiredSkillIds);
}

