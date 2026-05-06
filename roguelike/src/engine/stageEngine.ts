import { HandType, Suit } from '../shared/types/poker';
import { StageState } from '../types/run';
import { ModifierDef } from '../types/modifier';
import stageTemplates from '../config/runStageTemplates.json';
import modifierPool from '../config/runEliteModifiers.json';

interface StageTemplate {
  stageIndex: number;
  targetGold: number;
  handCount: number;
  holdCount: number;
  isElite: boolean;
  isBoss: boolean;
}

const templates = stageTemplates as StageTemplate[];
const ALL_MODIFIERS: ModifierDef[] = modifierPool as ModifierDef[];

export function getModifierById(id: string): ModifierDef | undefined {
  return ALL_MODIFIERS.find(m => m.id === id);
}

/** 解析词缀 effects 并返回合并后的约束值（供 initStage / initEndlessStage 共用） */
function applyModifierEffects(modifierId: string | undefined, defaults: {
  holdTotal: number;
  totalHands: number;
}) {
  let { holdTotal, totalHands } = defaults;
  const bannedHandTypes: HandType[] = [];
  const bannedSuits: Suit[] = [];
  let bannedRankMax = 0;
  let blockHoldBefore = 0;
  let blockHoldAfter  = 0;
  let banJokers = false;

  if (modifierId) {
    const mod = getModifierById(modifierId);
    if (mod) {
      for (const ef of mod.effects) {
        switch (ef.type) {
          case 'ban_hand_types':
            if (ef.handTypes) bannedHandTypes.push(...ef.handTypes);
            break;
          case 'reduce_hold':
            holdTotal = Math.max(0, holdTotal - ef.value);
            break;
          case 'block_hold_before':
            blockHoldBefore = ef.value;
            break;
          case 'block_hold_after':
            blockHoldAfter = ef.value;
            break;
          case 'reduce_hand_count':
            totalHands = Math.max(1, totalHands - ef.value);
            break;
          case 'ban_suits':
            if (ef.suits) bannedSuits.push(...(ef.suits as Suit[]));
            break;
          case 'ban_rank_max':
            if (ef.value > bannedRankMax) bannedRankMax = ef.value;
            break;
          case 'ban_jokers':
            banJokers = true;
            break;
        }
      }
    }
  }

  return { holdTotal, totalHands, bannedHandTypes, bannedSuits, bannedRankMax, blockHoldBefore, blockHoldAfter, banJokers };
}

/** 按模板初始化一个关卡（可附带词缀） */
export function initStage(stageIndex: number, modifierId?: string): StageState {
  const t = templates[stageIndex];
  if (!t) throw new Error(`No stage template for index ${stageIndex}`);

  const m = applyModifierEffects(modifierId, { holdTotal: t.holdCount, totalHands: t.handCount });

  return {
    stageIndex,
    targetGold:      t.targetGold,
    totalHands:      m.totalHands,
    usedHands:       0,
    holdTotal:       m.holdTotal,
    holdUsed:        0,
    accumulatedGold: 0,
    isElite:         t.isElite,
    isBoss:          t.isBoss,
    modifierId:      modifierId ?? null,
    bannedHandTypes: m.bannedHandTypes,
    bannedSuits:     m.bannedSuits,
    bannedRankMax:   m.bannedRankMax,
    blockHoldBefore: m.blockHoldBefore,
    blockHoldAfter:  m.blockHoldAfter,
    banJokers:       m.banJokers,
    status:          'active',
  };
}

/** 本关剩余补牌次数 */
export function remainingHold(stage: StageState): number {
  return stage.holdTotal - stage.holdUsed;
}

/**
 * 判断当前手牌是否可以补牌。
 * usedHands 在打完一手后才 +1，所以当前打第 usedHands+1 手时（0-based = usedHands）。
 */
export function canDraw(stage: StageState): boolean {
  if (remainingHold(stage) <= 0) return false;
  const curHandIdx = stage.usedHands; // 0-based 当前手
  if (stage.blockHoldBefore > 0 && curHandIdx < stage.blockHoldBefore) return false;
  if (stage.blockHoldAfter  > 0 && curHandIdx >= stage.totalHands - stage.blockHoldAfter) return false;
  return true;
}

/** 记录本手结算金币，返回更新后的关卡状态 */
export function applyHandGold(stage: StageState, gold: number): StageState {
  const next: StageState = {
    ...stage,
    accumulatedGold: stage.accumulatedGold + gold,
    usedHands:       stage.usedHands + 1,
  };

  if (next.accumulatedGold >= next.targetGold) {
    next.status = 'won';
  } else if (next.usedHands >= next.totalHands) {
    next.status = 'lost';
  }

  return next;
}

/** 消耗一次补牌次数，返回新关卡状态 */
export function consumeDraw(stage: StageState): StageState {
  if (remainingHold(stage) <= 0) return stage;
  return { ...stage, holdUsed: stage.holdUsed + 1 };
}

/** 随机分配词缀 ID（按难度池加权，越深越难） */
export function pickModifierForStageIndex(stageIndex: number): string {
  const depth = Math.floor(stageIndex / 3); // 0,1,2,3,4
  const maxDiff = Math.min(1 + depth, 3) as 1 | 2 | 3;
  const pool = ALL_MODIFIERS.filter(m => m.difficulty <= maxDiff);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

const ENDLESS_HAND_COUNT = 6;
const ENDLESS_HOLD_COUNT = 6;
const ELITE_UNSHACKLED_SKILL_ID = 'elite_unshackled';

/** 是否由“精英关无限制”使当前词缀失效（仅精英/Boss 关） */
export function isModifierSuppressed(stage: StageState, acquiredSkillIds: string[]): boolean {
  if (!acquiredSkillIds.includes(ELITE_UNSHACKLED_SKILL_ID)) return false;
  return stage.isElite || stage.isBoss;
}

/**
 * 返回结算/补牌应使用的“生效态关卡”。
 * 精英关无限制：仅取消禁止类与时点类限制；手数/补牌总量等已在 initStage 写入的数值仍生效。
 */
export function getEffectiveStage(stage: StageState, acquiredSkillIds: string[]): StageState {
  if (!isModifierSuppressed(stage, acquiredSkillIds)) return stage;
  return {
    ...stage,
    bannedHandTypes: [],
    bannedSuits: [],
    bannedRankMax: 0,
    blockHoldBefore: 0,
    blockHoldAfter: 0,
    banJokers: false,
  };
}

/** 无限挑战阶段：按动态参数初始化关卡（不依赖 stageTemplates） */
export function initEndlessStage(
  stageIndex: number,
  targetGold: number,
  isElite: boolean,
  modifierId?: string,
): StageState {
  const m = applyModifierEffects(modifierId, { holdTotal: ENDLESS_HOLD_COUNT, totalHands: ENDLESS_HAND_COUNT });

  return {
    stageIndex,
    targetGold,
    totalHands:      m.totalHands,
    usedHands:       0,
    holdTotal:       m.holdTotal,
    holdUsed:        0,
    accumulatedGold: 0,
    isElite,
    isBoss:          false,
    modifierId:      modifierId ?? null,
    bannedHandTypes: m.bannedHandTypes,
    bannedSuits:     m.bannedSuits,
    bannedRankMax:   m.bannedRankMax,
    blockHoldBefore: m.blockHoldBefore,
    blockHoldAfter:  m.blockHoldAfter,
    banJokers:       m.banJokers,
    status:          'active',
  };
}

/**
 * 无限挑战阶段精英关词缀选取。
 * endlessEliteIdx：当前是第几个无限精英关（0-based）。
 */
export function pickEndlessModifier(endlessEliteIdx: number): string {
  const minDiff = 2;
  const maxDiff = Math.min(2 + Math.floor(endlessEliteIdx / 2), 3) as 2 | 3;
  const pool = ALL_MODIFIERS.filter(m => m.difficulty >= minDiff && m.difficulty <= maxDiff);
  if (!pool.length) return ALL_MODIFIERS[ALL_MODIFIERS.length - 1].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
