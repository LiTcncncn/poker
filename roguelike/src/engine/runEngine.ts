import { RunState, StageState, HandTypeUpgradeMap } from '../types/run';
import { SkillDef, SkillEnhancement } from '../types/skill';
import { Card } from '../shared/types/poker';
import { initStage, pickModifierForStageIndex, initEndlessStage, pickEndlessModifier } from './stageEngine';
import stageTemplates from '../config/runStageTemplates.json';

const TOTAL_STAGES = stageTemplates.length;

type StageTpl = { targetGold: number; isElite: boolean; isBoss: boolean };
const stageTplList = stageTemplates as StageTpl[];

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

/** 初始化一局新 Run，自动为精英/Boss 关分配词缀 */
export function initRun(): RunState {
  // 先为精英/Boss 关卡分配词缀 ID
  const stageModifiers: Record<number, string> = {};
  stageTplList.forEach((t, i) => {
    if (t.isElite || t.isBoss) {
      stageModifiers[i] = pickModifierForStageIndex(i);
    }
  });

  const stages: StageState[] = stageTplList.map((_, i) => {
    const modId = stageModifiers[i];
    const stage = initStage(i, modId);
    return { ...stage, status: i === 0 ? 'active' : 'pending' } as StageState;
  });

  return {
    runId: newRunId(),
    currentStageIndex: 0,
    stages,
    handTypeUpgrades: {} as HandTypeUpgradeMap,
    acquiredSkillIds: [],
    soldSkillIds: [],
    skillEnhancements: {},
    skillSlotCap: 5,
    attributeCards: [],
    runDiamonds: 3,
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

  if (next >= TOTAL_STAGES) {
    return {
      ...run,
      handTypeUpgrades: upgrades,
      acquiredSkillIds: newSkillIds,
      attributeCards: mergedAttrCards,
      status: 'victory',
    };
  }

  const modId = run.stageModifiers[next];
  const stages = run.stages.map((s, i) => {
    if (i === next) {
      return { ...initStage(i, modId), status: 'active' as const };
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
 * 从主线末关 `targetGold`（`ENDLESS_SEED_GOLD`，与 `runStageTemplates.json` 最后一行同步）起算；
 * 每关在上关基础上乘 NORMAL_RATE，精英关（无尽内第 3、6、9… 关，即 (endlessIdx+1)%3===0）再乘 ELITE_BONUS；
 * 结果四舍五入到千位，且相对上一关单调不减（例：种子 40000 时前几关约 43k→46k→51k…）。
 */
function calcEndlessTargetGold(endlessIdx: number): number {
  let gold = ENDLESS_SEED_GOLD;
  for (let i = 0; i <= endlessIdx; i++) {
    const displayK = TOTAL_STAGES + i + 1; // 21,22,23...
    const isThisElite = (i + 1) % 3 === 0;
    const raw = gold * endlessNormalRate(displayK) * (isThisElite ? endlessEliteBonus(displayK) : 1);
    const rounded = roundEndlessGold(raw);
    gold = Math.max(gold, rounded);
  }
  return gold;
}

/** 生成无限阶段的第 endlessIdx 关（0-based） */
function buildEndlessStage(endlessIdx: number): StageState {
  const isElite   = (endlessIdx + 1) % 3 === 0;
  const targetGold = calcEndlessTargetGold(endlessIdx);
  // endlessEliteIdx：当前是第几个精英关
  const endlessEliteIdx = Math.floor(endlessIdx / 3);
  const modId = isElite ? pickEndlessModifier(endlessEliteIdx) : undefined;
  return initEndlessStage(TOTAL_STAGES + endlessIdx, targetGold, isElite, modId);
}

/**
 * 主线胜利后进入无限挑战模式。
 * 立即生成第一个无限关（index = TOTAL_STAGES），status 回到 'running'。
 */
export function enterEndlessMode(run: RunState): RunState {
  const firstEndlessStage = buildEndlessStage(0);
  return {
    ...run,
    isEndless: true,
    endlessStagesCleared: 0,
    status: 'running',
    stages: [...run.stages, firstEndlessStage],
    currentStageIndex: TOTAL_STAGES,
    highestSingleStageTarget: Math.max(run.highestSingleStageTarget, firstEndlessStage.targetGold),
  };
}

/**
 * 无限阶段关卡胜利后，累计技能/升级/属性牌并推进到下一无限关。
 * 新关卡覆写 stages[TOTAL_STAGES]，currentStageIndex 保持 TOTAL_STAGES。
 */
export function advanceToNextEndlessStage(
  run: RunState,
  upgrades: HandTypeUpgradeMap,
  newSkills: SkillDef[],
  newAttributeCards: Card[] = [],
): RunState {
  const newEndlessCount = run.endlessStagesCleared + 1;
  const nextStage = buildEndlessStage(newEndlessCount);

  const updatedStages = [...run.stages];
  updatedStages[TOTAL_STAGES] = nextStage; // 覆写无限关槽位

  return {
    ...run,
    handTypeUpgrades: upgrades,
    acquiredSkillIds: [...run.acquiredSkillIds, ...newSkills.map(s => s.id)],
    attributeCards:   [...run.attributeCards, ...newAttributeCards],
    endlessStagesCleared: newEndlessCount,
    stages: updatedStages,
    currentStageIndex: TOTAL_STAGES,
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

export { TOTAL_STAGES };
