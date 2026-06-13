import type { RunState, StageIaaState, StageState } from '../types/run';

const SKILL_DIAMOND_TYCOON = 'diamond_tycoon';
const TYCOON_BONUS = 5;

export interface StageDiamondBreakdown {
  stageIndex: number;
  stageLabel: string;
  base: number;
  handBonus: number;
  holdBonus: number;
  handsLeft: number;
  holdLeft: number;
  stageKind: 'normal' | 'elite' | 'boss';
  tycoonBonus: number;
  stageDiamondCardEarned: number;
  totalGranted: number;
  skipBoard?: boolean;
}

export function stageKindFromStage(stage: StageState): StageDiamondBreakdown['stageKind'] {
  if (stage.isBoss) return 'boss';
  if (stage.isElite) return 'elite';
  return 'normal';
}

export function baseLabelForKind(kind: StageDiamondBreakdown['stageKind']): string {
  if (kind === 'boss') return '基础（Boss）';
  if (kind === 'elite') return '基础（精英）';
  return '基础（普通）';
}

/** 胜利钻石：有效剩手/剩补牌（IAA 额外资源不参与加成） */
export function effectiveVictoryDiamondCounts(
  stage: StageState,
  iaaPerStage?: StageIaaState,
): { handsLeft: number; holdLeft: number } {
  let handsLeft = Math.max(0, stage.totalHands - stage.usedHands);
  if (iaaPerStage?.extraHandUsed) {
    handsLeft = Math.max(0, stage.totalHands - Math.min(stage.usedHands, stage.totalHands));
  }
  const holdLeft = Math.max(0, stage.holdTotal - stage.holdUsed);
  return { handsLeft, holdLeft };
}

export function computeVictoryDiamondParts(
  stage: StageState,
  iaaPerStage?: StageIaaState,
): {
  base: number;
  handBonus: number;
  holdBonus: number;
  handsLeft: number;
  holdLeft: number;
  stageWinSubtotal: number;
} {
  if (stage.shopBaseDiamondRewardZero) {
    return {
      base: 0,
      handBonus: 0,
      holdBonus: 0,
      handsLeft: 0,
      holdLeft: 0,
      stageWinSubtotal: 0,
    };
  }

  const base =
    stage.stageBaseDiamondReward != null
      ? stage.stageBaseDiamondReward
      : stage.isElite || stage.isBoss
        ? 5
        : 3;

  const { handsLeft, holdLeft } = effectiveVictoryDiamondCounts(stage, iaaPerStage);
  const handBonus = handsLeft >= 2 ? 2 : handsLeft === 1 ? 1 : 0;
  const holdBonus = holdLeft >= 1 ? 1 : 0;

  return {
    base,
    handBonus,
    holdBonus,
    handsLeft,
    holdLeft,
    stageWinSubtotal: base + handBonus + holdBonus,
  };
}

export function calcStageDiamondReward(
  stage: StageState,
  iaaPerStage?: StageIaaState,
): number {
  return computeVictoryDiamondParts(stage, iaaPerStage).stageWinSubtotal;
}

function formatStageLabel(stage: StageState, run: Pick<RunState, 'isEndless'>): string {
  const n = stage.stageIndex + 1;
  const prefix = run.isEndless ? `无尽第 ${n} 关` : `第 ${n} 关`;
  if (stage.isBoss) return `${prefix} · BOSS`;
  if (stage.isElite) return `${prefix} · 精英`;
  return `${prefix} · 普通`;
}

export function buildStageDiamondBreakdown(
  stage: StageState,
  run: Pick<RunState, 'isEndless' | 'acquiredSkillIds'>,
  iaaPerStage?: StageIaaState,
  opts?: { skipBoard?: boolean },
): StageDiamondBreakdown {
  const parts = computeVictoryDiamondParts(stage, iaaPerStage);
  const tycoonBonus = run.acquiredSkillIds.includes(SKILL_DIAMOND_TYCOON) ? TYCOON_BONUS : 0;
  const stageDiamondCardEarned = stage.diamondCardEarnedThisStage ?? 0;
  const totalGranted = parts.stageWinSubtotal + tycoonBonus + stageDiamondCardEarned;

  return {
    stageIndex: stage.stageIndex,
    stageLabel: formatStageLabel(stage, run),
    base: parts.base,
    handBonus: parts.handBonus,
    holdBonus: parts.holdBonus,
    handsLeft: parts.handsLeft,
    holdLeft: parts.holdLeft,
    stageKind: stageKindFromStage(stage),
    tycoonBonus,
    stageDiamondCardEarned,
    totalGranted,
    skipBoard: opts?.skipBoard,
  };
}
