import { RunState, StageState, HandTypeUpgradeMap } from '../types/run';
import { SkillDef } from '../types/skill';
import { Card } from '../shared/types/poker';
import { initStage, pickModifierForStageIndex, initEndlessStage, pickEndlessModifier } from './stageEngine';
import stageTemplates from '../config/runStageTemplates.json';

const TOTAL_STAGES = stageTemplates.length;

// 无限阶段目标金币增长参数
const ENDLESS_BASE_GOLD  = 30000;  // 以主线末关为基准
const ENDLESS_NORMAL_RATE = 1.18;
const ENDLESS_ELITE_BONUS = 1.12;

function newRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 初始化一局新 Run，自动为精英/Boss 关分配词缀 */
export function initRun(): RunState {
  // 先为精英/Boss 关卡分配词缀 ID
  const stageModifiers: Record<number, string> = {};
  (stageTemplates as { isElite: boolean; isBoss: boolean }[]).forEach((t, i) => {
    if (t.isElite || t.isBoss) {
      stageModifiers[i] = pickModifierForStageIndex(i);
    }
  });

  const stages: StageState[] = (stageTemplates as { isElite: boolean; isBoss: boolean }[]).map((_, i) => {
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
    attributeCards: [],
    status: 'running',
    startedAt: Date.now(),
    skillAccumulation: {},
    stageModifiers,
    isEndless: false,
    endlessStagesCleared: 0,
    totalGoldEarned: 0,
    highestSingleStageTarget: 0,
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
 * 计算无限挑战第 idx 关（0-based）的目标金币。
 * 每关以上关为基础乘以 NORMAL_RATE，精英关再额外乘 ELITE_BONUS。
 */
function calcEndlessTargetGold(endlessIdx: number): number {
  let gold = ENDLESS_BASE_GOLD;
  for (let i = 0; i <= endlessIdx; i++) {
    const isThisElite = (i + 1) % 3 === 0;
    gold = Math.round(gold * ENDLESS_NORMAL_RATE * (isThisElite ? ENDLESS_ELITE_BONUS : 1));
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

export { TOTAL_STAGES };
