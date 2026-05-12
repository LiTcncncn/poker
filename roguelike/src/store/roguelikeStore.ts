import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RunState, StageState, HandState, HandResult, RunIaaState } from '../types/run';
import { RewardState, UpgradeOption } from '../types/reward';
import { SkillDef, SkillEnhancement } from '../types/skill';
import { Card } from '../shared/types/poker';
import { RunConfig } from '../types/profile';
import {
  initRun,
  updateStageInRun,
  advanceToNextStage,
  advanceToNextEndlessStage,
  enterEndlessMode,
  getEndlessStageIndex,
  defeatRun,
  TOTAL_STAGES,
  countBlackEdgeSlots,
  clampRunDiamonds,
  clampSkillSellExtraDiamonds,
  SKILL_SELL_BONUS_CAP,
} from '../engine/runEngine';
import { applyHandGold, consumeDraw, canDraw, getEffectiveStage, getStageTargetGold, remainingHold } from '../engine/stageEngine';
import { buildDeckForRule, injectJokers, shuffle, dealCards, replaceUnheld, capJokersInHand } from '../engine/deckEngine';
import { applyUpgrade, generateRewardForStage, getDefaultDiamondRefreshCost, regenerateShopOptionsForStep } from '../engine/rewardEngine';
import { getAllowedSkillIds, getUnlockedOrdersAfterNormalRun } from '../config/skillUnlockOrders';
import {
  evaluateHandWithSkills,
  applyHoldSkillAccumulation,
  getSkillsByIds,
  applySavedHandsStageWinBonus,
  rollRandomHandAddMultiplier,
  hasRandomHandAddMultiplierSkill,
  JOKER_RATE_SKILL_ID,
  JOKER_DOUBLE_SKILL_ID,
} from '../engine/skillEngine';
import { recordRunOnAbandon } from '../storage/rushLeaderboard';
import {
  ROGUELIKE_PERSIST_SCHEMA_VERSION,
  ROGUELIKE_ZUSTAND_PERSIST_NAME,
} from '../config/storageNamespace';
import { getAllowedSkillEnhancementsAfterNormalRun } from '../config/mainlineRuns';

const HAND_SIZE = 5;
const IAA_DIAMOND_REFILL_LIMIT = 2;

function fallbackHighestNormalClearedForEdgeGate(run: RunState): number {
  if (run.difficulty === 'freeplay') return Number.MAX_SAFE_INTEGER;
  if (run.isEndless || run.status === 'victory' || run.difficulty === 'hard') return Math.max(0, run.runNo);
  return Math.max(0, run.runNo - 1);
}

function getAllowedSkillEnhancementSet(run: RunState): Set<SkillEnhancement> | undefined {
  if (run.difficulty === 'freeplay') return undefined;
  const stored = (run as RunState & { allowedSkillEnhancements?: SkillEnhancement[] }).allowedSkillEnhancements;
  const allowed = Array.isArray(stored)
    ? stored
    : getAllowedSkillEnhancementsAfterNormalRun(fallbackHighestNormalClearedForEdgeGate(run));
  return new Set(allowed);
}

/** 牌堆 Joker 注入概率：基础 8%；持有「Joker几率+」为 12%；词缀禁小丑时为 0 */
function jokerInjectProbability(acquiredSkillIds: string[], banJokers: boolean): number {
  if (banJokers) return 0;
  return acquiredSkillIds.includes(JOKER_RATE_SKILL_ID) ? 0.12 : 0.08;
}

function maxJokersInHandCap(acquiredSkillIds: string[]): number {
  return acquiredSkillIds.includes(JOKER_DOUBLE_SKILL_ID) ? 2 : 1;
}

const SKILL_SUPER_CREDIT = 'super_credit_card';
const SKILL_DIAMOND_TYCOON = 'diamond_tycoon';
const SKILL_SELLERS_MARKET = 'sellers_market';
const SKILL_ELITE_UNSHACKLED = 'elite_unshackled';
const SKILL_REFRESH_SHOP_MULT = 'refresh_shop_mult';
const SKILL_DIMINISHING_EFFECT = 'diminishing_effect';
const SKILL_FADING_BOOST = 'fading_boost';
const SKILL_FORWARD_RUSH = 'forward_rush';

/** 「精英关无限制」用完最后一券后从卡槽移除（进关时已扣到 0，本关内须仍持有 id 以抵消词缀） */
function stripEliteUnshackledIfDepleted(run: RunState): RunState {
  if (!run.acquiredSkillIds.includes(SKILL_ELITE_UNSHACKLED)) return run;
  const newSkillIds = run.acquiredSkillIds.filter((id) => id !== SKILL_ELITE_UNSHACKLED);
  const newEnh = { ...run.skillEnhancements };
  delete newEnh[SKILL_ELITE_UNSHACKLED];
  const newAcc = { ...run.skillAccumulation };
  delete newAcc[SKILL_ELITE_UNSHACKLED];
  return { ...run, acquiredSkillIds: newSkillIds, skillEnhancements: newEnh, skillAccumulation: newAcc };
}

function removeSkillFromRun(run: RunState, skillId: string): RunState {
  const newSkillIds = run.acquiredSkillIds.filter((id) => id !== skillId);
  const newEnh = { ...run.skillEnhancements };
  delete newEnh[skillId];
  const newAcc = { ...run.skillAccumulation };
  delete newAcc[skillId];
  const newSellBonus = { ...(run.skillSellBonus ?? {}) };
  delete newSellBonus[skillId];
  return {
    ...run,
    acquiredSkillIds: newSkillIds,
    skillEnhancements: newEnh,
    skillAccumulation: newAcc,
    skillSellBonus: newSellBonus,
  };
}

function applyForwardRushToStageIfNeeded(stage: StageState, acquiredSkillIds: string[]): StageState {
  if (!acquiredSkillIds.includes(SKILL_FORWARD_RUSH)) return stage;
  // 每关都生效：手数 +2，补牌总量 -1（最低 0）
  const totalHands = Math.max(1, stage.totalHands + 2);
  const holdTotal = Math.max(0, stage.holdTotal - 1);
  return { ...stage, totalHands, holdTotal };
}

function computeBlackEdgePityGateN(shopStageK: number, ownedBlackCount: number): number | null {
  const gateK = 19 + 20 * ownedBlackCount;
  return shopStageK >= gateK ? ownedBlackCount : null;
}

/** 关卡胜利后：王老五 +💎5；卖方市场给每个已拥有技能卖出价 +1（每技能 id 叠加上限 💎8） */
function applyStageWinEconomy(r: RunState): RunState {
  let out: RunState = { ...r };
  if (r.acquiredSkillIds.includes(SKILL_DIAMOND_TYCOON)) {
    out = {
      ...out,
      runDiamonds: clampRunDiamonds(out.runDiamonds + 5),
      diamondsEarnedTotal: out.diamondsEarnedTotal + 5,
    };
  }
  if (r.acquiredSkillIds.includes(SKILL_SELLERS_MARKET)) {
    const bonus = { ...(r.skillSellBonus ?? {}) };
    for (const id of r.acquiredSkillIds) {
      const prev = clampSkillSellExtraDiamonds(bonus[id]);
      bonus[id] = Math.min(SKILL_SELL_BONUS_CAP, prev + 1);
    }
    out = { ...out, skillSellBonus: bonus };
  }
  return out;
}

// ─── 结算辅助 ────────────────────────────────────────────────
type SetFn = (partial: Partial<{ run: RunState | null; handState: HandState | null; reward: RewardState | null }>) => void;

function _commitScore(
  handState: HandState,
  run: RunState,
  stage: StageState,
  set: SetFn,
) {
  const skills = getSkillsByIds(run.acquiredSkillIds);
  const isLastHand         = stage.usedHands + 1 >= stage.totalHands;
  const isFirstHandOfStage = stage.usedHands === 0;
  const randomHandAddMultiplier =
    run.pendingRandomHandMult ?? rollRandomHandAddMultiplier(skills);

  const evalBase = evaluateHandWithSkills({
    hand: handState.hand,
    upgradeMap: run.handTypeUpgrades,
    acquiredSkills: skills,
    skillAccumulation: run.skillAccumulation,
    bannedHandTypes: stage.bannedHandTypes,
    bannedSuits:     stage.bannedSuits,
    bannedRankMax:   stage.bannedRankMax,
    banFaceCardScore: stage.banFaceCardScore,
    handTypeLevelDownshift: stage.handTypeLevelDownshift,
    isLastHand,
    isFirstHandOfStage,
    drawsUsedThisHand: handState.drawsUsed,
    superCardCount:    run.attributeCards?.length ?? 0,
    skillEnhancements: run.skillEnhancements,
    runDiamonds:       run.runDiamonds,
    stageTotalHands:   stage.totalHands,
    stageUsedHands:    stage.usedHands,
    runHandsPlayedTotal: run.handsPlayedTotal ?? 0,
    randomHandAddMultiplier,
  });

  const wouldClearStage =
    stage.accumulatedGold + evalBase.finalGold >= getStageTargetGold(stage);
  const savedHands = wouldClearStage ? stage.totalHands - (stage.usedHands + 1) : 0;
  const evalResult = applySavedHandsStageWinBonus(evalBase, skills, savedHands);

  const handResult: HandResult = {
    handType:              evalResult.handType,
    handName:              evalResult.handName,
    scoringCardIds:        evalResult.scoringCardIds,
    cardScoreSum:          evalResult.cardScoreSum,
    multiplierTotal:       evalResult.multiplierTotal,
    skillAddedScore:       evalResult.skillAddedScore,
    skillAddedMultiplier:  evalResult.skillAddedMultiplier,
    independentMultiplier: evalResult.independentMultiplier,
    finalGold:             evalResult.finalGold,
    diamondReward:         evalResult.diamondReward,
    skillLog:              evalResult.skillLog,
  };

  // 进入结算展示时统一清空 HOLD 标记，避免“直接结算”场景残留 HOLD UI
  const newHandState: HandState = { ...handState, heldIndices: [], phase: 'result', lastResult: handResult };

  const fg = handResult.finalGold;
  const prevMaxGold = run.maxSingleHandGold ?? 0;
  let bestHandThisRun = run.bestHandThisRun ?? null;
  if (fg > prevMaxGold) {
    bestHandThisRun = { handType: handResult.handType, finalGold: fg };
  }

  // 更新统计数据
  const handDiamond = evalResult.diamondReward ?? 0;
  let newRun: RunState = {
    ...run,
    skillAccumulation: evalResult.newAccumulation,
    totalGoldEarned: run.totalGoldEarned + evalResult.finalGold,
    handsPlayedTotal: (run.handsPlayedTotal ?? 0) + 1,
    bestHandThisRun,
    maxSingleHandGold: Math.max(prevMaxGold, fg),
  };
  if (handDiamond > 0) {
    newRun = {
      ...newRun,
      runDiamonds: clampRunDiamonds(newRun.runDiamonds + handDiamond),
      diamondsEarnedTotal: newRun.diamondsEarnedTotal + handDiamond,
    };
  }

  // 「后劲不足」：按手递减的 +$（获得后下一手为第 1 手）；用 skillAccumulation 记录当前值
  if (newRun.acquiredSkillIds.includes(SKILL_FADING_BOOST)) {
    const curRaw = Number(newRun.skillAccumulation?.[SKILL_FADING_BOOST] ?? 100);
    const cur = Number.isFinite(curRaw) ? curRaw : 100;
    const next = cur - 5;
    if (next > 0) {
      newRun = {
        ...newRun,
        skillAccumulation: { ...newRun.skillAccumulation, [SKILL_FADING_BOOST]: next },
      };
    } else {
      newRun = removeSkillFromRun(newRun, SKILL_FADING_BOOST);
    }
  }

  const newStage = applyHandGold(stage, evalResult.finalGold);
  newRun = updateStageInRun(newRun, newStage);

  if (
    (newStage.status === 'won' || newStage.status === 'lost') &&
    (stage.isElite || stage.isBoss) &&
    newRun.acquiredSkillIds.includes(SKILL_ELITE_UNSHACKLED) &&
    (newRun.skillAccumulation?.[SKILL_ELITE_UNSHACKLED] ?? 3) === 0
  ) {
    newRun = stripEliteUnshackledIfDepleted(newRun);
  }

  if (newStage.status === 'won') {
    const diamondsGained = calcStageDiamondReward(newStage);
    newRun = {
      ...newRun,
      runDiamonds: clampRunDiamonds(newRun.runDiamonds + diamondsGained),
      diamondsEarnedTotal: newRun.diamondsEarnedTotal + diamondsGained,
    };
    // 更新最高单关目标记录
    newRun = { ...newRun, highestSingleStageTarget: Math.max(newRun.highestSingleStageTarget, newStage.targetGold) };
    newRun = applyStageWinEconomy(newRun);

    // 计算本局允许的技能池（主线模式时过滤解锁顺序）
    const allowedSkillIds =
      newRun.difficulty !== 'freeplay' && newRun.allowedSkillOrders?.length
        ? getAllowedSkillIds(newRun.allowedSkillOrders)
        : undefined;
    const allowedSkillEnhancements = getAllowedSkillEnhancementSet(newRun);
    const blackEdgePityAllowed = allowedSkillEnhancements == null || allowedSkillEnhancements.has('black');

    if (run.isEndless) {
      // 黑边定向保底的 gateK(N) 使用“显示关数”（主线 1..20 + 无尽 21..），因此这里要用 stageIndex+1（而不是 endlessStagesCleared+1）。
      const displayK = stage.stageIndex + 1;
      const rewardState = generateRewardForStage(
        stage.stageIndex,
        newRun.handTypeUpgrades,
        newRun.acquiredSkillIds,
        newRun.skillEnhancements,
        false,
        true,
        newRun.soldSkillIds ?? [],
        {
          gateN: blackEdgePityAllowed
            ? computeBlackEdgePityGateN(displayK, newRun.acquiredSkillIds.filter((id) => newRun.skillEnhancements[id] === 'black').length)
            : null,
          misses: newRun.blackEdgePityMisses ?? 0,
          cooldown: newRun.blackEdgePityCooldown ?? 0,
        },
        allowedSkillIds,
        allowedSkillEnhancements,
      );
      set({ run: newRun, handState: newHandState, reward: rewardState });
    } else {
      const stageCount = newRun.runStageCount ?? TOTAL_STAGES;
      const isLastStage = stage.stageIndex + 1 >= stageCount;
      if (isLastStage) {
        // 主线最后一关通关 → 进入胜利画面，用户选择是否继续挑战
        const victoryRun: RunState = { ...newRun, status: 'victory' };
        set({ run: victoryRun, handState: newHandState, reward: null });
      } else {
        const rewardState = generateRewardForStage(
          stage.stageIndex,
          newRun.handTypeUpgrades,
          newRun.acquiredSkillIds,
          newRun.skillEnhancements,
          false,
          false,
          newRun.soldSkillIds ?? [],
          {
            gateN: blackEdgePityAllowed
              ? computeBlackEdgePityGateN(stage.stageIndex + 1, newRun.acquiredSkillIds.filter((id) => newRun.skillEnhancements[id] === 'black').length)
              : null,
            misses: newRun.blackEdgePityMisses ?? 0,
            cooldown: newRun.blackEdgePityCooldown ?? 0,
          },
          allowedSkillIds,
          allowedSkillEnhancements,
        );
        set({ run: newRun, handState: newHandState, reward: rewardState });
      }
    }
  } else if (newStage.status === 'lost') {
    set({ run: defeatRun(newRun), handState: newHandState, reward: null });
  } else {
    set({ run: newRun, handState: newHandState, reward: null });
  }
}

interface RLStore {
  run: RunState | null;
  handState: HandState | null;
  reward: RewardState | null;

  // ── Run 流程 ──────────────────────────────
  startNewRun:        (config?: RunConfig) => void;
  abandonRun:         () => void;
  enterEndlessMode:   () => void;  // 主线胜利后选择继续挑战

  // ── 手牌交互 ──────────────────────────────
  dealInitialHand: () => void;
  flipCards:       () => void;          // deal → hold（翻牌）
  toggleHold:      (index: number) => void;
  drawCards:       () => void;          // 补牌（hold阶段，可多次，消耗holdUsed）
  scoreHand:       () => void;          // 结算（hold阶段 → result）

  // ── 奖励（三步） ──────────────────────────
  chooseSkill:          (skill: SkillDef, enhancement: SkillEnhancement, price: number) => void;
  sellSkill:            (skillId: string) => void;
  chooseUpgrade:        (option: UpgradeOption) => void;
  chooseAttributeCard:  (card: Card) => void;
  refreshRewardWithDiamonds: () => void;
  proceedRewardStep:    () => void;

  // ── IAA ───────────────────────────────────
  /** IAA 刷新商店（每关限 1 次，与💎刷新独立） */
  iaaRefreshReward:   () => void;
  /** IAA 补钻 +3（商店/关内共享，每局限 2 次） */
  iaaClaimDiamonds:   () => void;
  /** IAA 购买初始 Roll 中标记的 IAA 商品（每关限 1 次） */
  iaaBuyItem:         () => void;
  /** IAA HOLD+1 授权：下次补牌使用 IAA HOLD（每关限 1 次） */
  iaaGrantExtraHold:  () => void;
  /** IAA 手数+1：本局最后一手失败后再打一手（每关限 1 次） */
  iaaExtraHand:       () => void;
  /** IAA 复活：最终失败时按胜利过关但不结算钻石（每局限 1 次） */
  iaaRevive:          () => void;

  // ── 计算 ──────────────────────────────────
  currentStage: () => StageState | null;
}

function calcSkillSellValue(quality: SkillDef['quality'], enhancement: SkillEnhancement): number {
  const qualityVal: Record<SkillDef['quality'], number> = { green: 1, blue: 2, purple: 3 };
  const enhancementVal: Record<SkillEnhancement, number> = { normal: 0, flash: 1, gold: 2, laser: 3, black: 2 };
  return qualityVal[quality] + enhancementVal[enhancement];
}

function calcStageDiamondReward(stage: StageState): number {
  if (stage.shopBaseDiamondRewardZero) return 0;
  const base = stage.isElite || stage.isBoss ? 5 : 3;
  const handsLeft = stage.totalHands - stage.usedHands;
  const handBonus = handsLeft >= 2 ? 2 : handsLeft === 1 ? 1 : 0;
  const holdLeft = stage.holdTotal - stage.holdUsed;
  const holdBonus = holdLeft >= 1 ? 1 : 0;
  return base + handBonus + holdBonus;
}

// ─── (buildDeck 已废弃，改用 buildDeckForRule) ───────────────────

export const useRLStore = create<RLStore>()(
  persist(
    (set, get) => ({
      run: null,
      handState: null,
      reward: null,

      // ─── 开始新 Run ────────────────────────────────────────────
      startNewRun: (config?: RunConfig) => {
        const run = initRun(config);
        const stage0 = getEffectiveStage(run.stages[0], run.acquiredSkillIds);
        const banJokers = run.runBanJokers || stage0.banJokers === true;
        const jP = jokerInjectProbability(run.acquiredSkillIds, banJokers);
        const maxJ = maxJokersInHandCap(run.acquiredSkillIds);
        const baseDeck = buildDeckForRule(run.deckRule ?? 'standard');
        const deck = shuffle(injectJokers(baseDeck, jP));
        const dealt = dealCards(deck, HAND_SIZE);
        const { hand, remaining } = capJokersInHand(dealt.hand, dealt.remaining, maxJ);
        set({
          run,
          reward: null,
          handState: { deck: remaining, hand, heldIndices: [], phase: 'deal', drawsUsed: 0, lastResult: null },
        });
      },

      abandonRun: () => {
        const { run } = get();
        if (run) recordRunOnAbandon(run);
        set({ run: null, handState: null, reward: null });
      },

      // ─── 进入无限挑战模式 ──────────────────────────────────────
      enterEndlessMode: () => {
        const { run } = get();
        if (!run || run.status !== 'victory' || run.isEndless) return;
        const runWithFreshUnlocks =
          run.difficulty === 'normal' && run.runNo > 0
            ? {
                ...run,
                allowedSkillOrders: getUnlockedOrdersAfterNormalRun(run.runNo),
                allowedSkillEnhancements: getAllowedSkillEnhancementsAfterNormalRun(run.runNo),
              }
            : run;
        const endlessRun = enterEndlessMode(runWithFreshUnlocks);
        set({ run: endlessRun, reward: null });
        get().dealInitialHand();
      },

      // ─── 发初始手牌（新一手，含属性牌） ─────────────────────────
      dealInitialHand: () => {
        let { run } = get();
        if (!run || run.status !== 'running') return;
        let rawStage = run.stages[run.currentStageIndex];
        if (!rawStage && run.isEndless) {
          const endlessStageIndex = getEndlessStageIndex(run);
          rawStage = run.stages[endlessStageIndex];
          if (rawStage) run = { ...run, currentStageIndex: endlessStageIndex };
        }
        if (!rawStage) return;
        // 最后一券已耗尽但异常留在非精英关（极少见）：清掉占位技能
        if (
          run.acquiredSkillIds.includes(SKILL_ELITE_UNSHACKLED) &&
          (run.skillAccumulation?.[SKILL_ELITE_UNSHACKLED] ?? 3) === 0 &&
          !rawStage.isElite &&
          !rawStage.isBoss
        ) {
          run = stripEliteUnshackledIfDepleted(run);
          set({ run });
        }
        const stage = getEffectiveStage(rawStage, run.acquiredSkillIds);
        const banJokers = run.runBanJokers || stage.banJokers === true;
        const jokerProb = jokerInjectProbability(run.acquiredSkillIds, banJokers);
        const maxJ = maxJokersInHandCap(run.acquiredSkillIds);
        // 属性牌混入牌池（防御 undefined）；使用局规则牌堆
        const baseDeck = buildDeckForRule(run.deckRule ?? 'standard');
        const base = injectJokers(baseDeck, jokerProb);
        const deck = shuffle([...base, ...(run.attributeCards ?? [])]);
        const dealt = dealCards(deck, HAND_SIZE);
        const { hand, remaining } = capJokersInHand(dealt.hand, dealt.remaining, maxJ);
        const nextRun = { ...run };
        delete nextRun.pendingRandomHandMult;
        set({
          run: nextRun,
          handState: { deck: remaining, hand, heldIndices: [], phase: 'deal', drawsUsed: 0, lastResult: null },
          reward: null,
        });
      },

      // ─── 翻牌：deal → hold ────────────────────────────────────
      flipCards: () => {
        const { handState, run } = get();
        if (!handState || !run || handState.phase !== 'deal') return;
        const skills = getSkillsByIds(run.acquiredSkillIds);
        const rolled = rollRandomHandAddMultiplier(skills);
        const nextRun = { ...run };
        if (rolled !== undefined) nextRun.pendingRandomHandMult = rolled;
        else delete nextRun.pendingRandomHandMult;
        set({ run: nextRun, handState: { ...handState, phase: 'hold' } });
      },

      // ─── 切换 hold（hold 阶段选/取消选牌）──────────────────────
      toggleHold: (index: number) => {
        const { handState } = get();
        if (!handState || handState.phase !== 'hold') return;
        const held = handState.heldIndices;
        const next = held.includes(index)
          ? held.filter(i => i !== index)
          : [...held, index];
        set({ handState: { ...handState, heldIndices: next } });
      },

      // ─── 补牌（hold 阶段，可多次，消耗 holdUsed）──────────────
      drawCards: () => {
        const { handState, run } = get();
        if (!handState || !run || handState.phase !== 'hold') return;
        const rawStage = get().currentStage();
        if (!rawStage) return;
        const stage = getEffectiveStage(rawStage, run.acquiredSkillIds);
        const iaaGranted = run.iaa?.perStage[rawStage.stageIndex]?.extraHoldGranted ?? false;
        if (!canDraw(stage) && !iaaGranted) return;

        // 消耗一次补牌次数（IAA HOLD 时 holdUsed 可超出 holdTotal，钻石结算中 holdLeft<0 自动归零）
        const updatedStage = consumeDraw(stage);
        let updatedRun = updateStageInRun(run, updatedStage);

        // 消耗 IAA HOLD 授权
        if (iaaGranted) {
          const si = rawStage.stageIndex;
          const prevIaa = run.iaa!;
          updatedRun = {
            ...updatedRun,
            iaa: {
              ...prevIaa,
              perStage: {
                ...prevIaa.perStage,
                [si]: { ...prevIaa.perStage[si], extraHoldGranted: false, extraHoldUsed: true },
              },
            },
          };
        }

        // 换牌
        const replaced = replaceUnheld(handState.hand, handState.heldIndices, handState.deck);
        const maxJ = maxJokersInHandCap(run.acquiredSkillIds);
        const { hand: newHand, remaining } = capJokersInHand(replaced.newHand, replaced.remaining, maxJ);

        // 触发 hold 型技能积累
        const heldCards = handState.heldIndices.map(i => handState.hand[i]);
        const skills = getSkillsByIds(run.acquiredSkillIds);
        const newAccumulation = applyHoldSkillAccumulation(skills, heldCards, updatedRun.skillAccumulation);
        updatedRun = { ...updatedRun, skillAccumulation: newAccumulation };

        set({
          run: updatedRun,
          handState: {
            ...handState,
            hand: newHand,
            deck: remaining,
            heldIndices: [],
            drawsUsed: handState.drawsUsed + 1,
            phase: 'hold',   // 保持 hold 状态，可继续补牌或结算
          },
        });
      },

      // ─── 结算（hold 阶段 → result）────────────────────────────
      scoreHand: () => {
        const { handState, run } = get();
        if (!handState || !run || handState.phase !== 'hold') return;
        const rawStage = get().currentStage();
        if (!rawStage) return;
        const stage = getEffectiveStage(rawStage, run.acquiredSkillIds);
        _commitScore(handState, run, stage, set);
      },

      // ─── 购买技能 ─────────────────────────────────────────────
      chooseSkill: (skill: SkillDef, enhancement: SkillEnhancement, price: number) => {
        const { run, reward } = get();
        if (!run || !reward || (reward.step !== 'skill' && reward.step !== 'unified')) return;
        if (run.runDiamonds < price) return;
        if (run.acquiredSkillIds.includes(skill.id)) return;
        const blacksAfter =
          countBlackEdgeSlots(run.skillEnhancements, run.acquiredSkillIds) + (enhancement === 'black' ? 1 : 0);
        if (run.acquiredSkillIds.length >= run.skillSlotCap + blacksAfter) return;

        let nextDiamonds = run.runDiamonds - price;
        if (skill.id === SKILL_SUPER_CREDIT) nextDiamonds += 20;
        let newRun: RunState = {
          ...run,
          acquiredSkillIds: [...run.acquiredSkillIds, skill.id],
          skillEnhancements: { ...run.skillEnhancements, [skill.id]: enhancement },
          runDiamonds: clampRunDiamonds(nextDiamonds),
          diamondsSpentTotal: run.diamondsSpentTotal + price,
        };
        // 新技能初始化（用于递减/计数类技能的 skillAccumulation）
        if (skill.id === SKILL_DIMINISHING_EFFECT) {
          // “获得后下一关”为第 1 关：进入下一关前会先 -4，因此这里设为 24（24→20）
          newRun = {
            ...newRun,
            skillAccumulation: { ...newRun.skillAccumulation, [skill.id]: 24 },
          };
        } else if (skill.id === SKILL_FADING_BOOST) {
          // “获得后下一手”为第 1 手：首手结算读 100，然后在 _commitScore 末尾递减
          newRun = {
            ...newRun,
            skillAccumulation: { ...newRun.skillAccumulation, [skill.id]: 100 },
          };
        } else if (skill.id === SKILL_REFRESH_SHOP_MULT) {
          newRun = {
            ...newRun,
            skillAccumulation: { ...newRun.skillAccumulation, [skill.id]: 0 },
          };
        }
        // 「精英关无限制」：3 次充能（进入精英/Boss 关消耗）
        if (skill.id === SKILL_ELITE_UNSHACKLED) {
          newRun = {
            ...newRun,
            skillAccumulation: { ...newRun.skillAccumulation, [skill.id]: 3 },
          };
        }
        const beforeRandom = hasRandomHandAddMultiplierSkill(getSkillsByIds(run.acquiredSkillIds));
        const afterRandom = hasRandomHandAddMultiplierSkill(getSkillsByIds(newRun.acquiredSkillIds));
        const hs = get().handState;
        if (!beforeRandom && afterRandom && hs?.phase === 'hold') {
          const r = rollRandomHandAddMultiplier(getSkillsByIds(newRun.acquiredSkillIds));
          if (r !== undefined) newRun = { ...newRun, pendingRandomHandMult: r };
        }
        const newSkillOptions = reward.skillOptions.map(s =>
          s.skill.id === skill.id ? { ...s, purchased: true } : s
        );
        set({ run: newRun, reward: { ...reward, skillOptions: newSkillOptions } });
      },

      // ─── 卖出技能（先卖后买）────────────────────────────────────
      sellSkill: (skillId: string) => {
        const { run } = get();
        if (!run) return;
        if (!run.acquiredSkillIds.includes(skillId)) return;
        const skill = getSkillsByIds([skillId])[0];
        if (!skill) return;
        const enhancement = run.skillEnhancements[skillId] ?? 'normal';
        const sellExtra = clampSkillSellExtraDiamonds(run.skillSellBonus?.[skillId]);
        const refund = calcSkillSellValue(skill.quality, enhancement) + sellExtra;
        let nextDiamonds = run.runDiamonds + refund;
        if (skillId === SKILL_SUPER_CREDIT) nextDiamonds -= 20;
        const newSkillIds = run.acquiredSkillIds.filter(id => id !== skillId);
        const newEnhancements = { ...run.skillEnhancements };
        delete newEnhancements[skillId];
        const newAccumulation = { ...run.skillAccumulation };
        delete newAccumulation[skillId];
        const newSellBonus = { ...(run.skillSellBonus ?? {}) };
        delete newSellBonus[skillId];
        const soldSkillIds = run.soldSkillIds.includes(skillId)
          ? run.soldSkillIds
          : [...run.soldSkillIds, skillId];
        const beforeRandom = hasRandomHandAddMultiplierSkill(getSkillsByIds(run.acquiredSkillIds));
        const afterRandom = hasRandomHandAddMultiplierSkill(getSkillsByIds(newSkillIds));
        const nextRun: RunState = {
          ...run,
          acquiredSkillIds: newSkillIds,
          soldSkillIds,
          skillEnhancements: newEnhancements,
          skillAccumulation: newAccumulation,
          skillSellBonus: newSellBonus,
          runDiamonds: clampRunDiamonds(nextDiamonds),
        };
        if (beforeRandom && !afterRandom) delete nextRun.pendingRandomHandMult;
        set({ run: nextRun });
      },

      // ─── 购买升级 ─────────────────────────────────────────────
      chooseUpgrade: (option: UpgradeOption) => {
        const { run, reward } = get();
        if (!run || !reward || (reward.step !== 'upgrade' && reward.step !== 'unified')) return;
        const target = reward.upgradeOptions.find(u =>
          u.option.handType === option.handType && u.option.handName === option.handName
        );
        if (!target) return;
        if (target.purchased) return;
        if (run.runDiamonds < target.price) return;
        const newUpgrades = applyUpgrade(run.handTypeUpgrades, option);
        set({
          run: {
            ...run,
            handTypeUpgrades: newUpgrades,
            runDiamonds: clampRunDiamonds(run.runDiamonds - target.price),
            diamondsSpentTotal: run.diamondsSpentTotal + target.price,
          },
          reward: {
            ...reward,
            upgradeOptions: reward.upgradeOptions.map(u =>
              u.option.handType === option.handType && u.option.handName === option.handName
                ? { ...u, purchased: true }
                : u
            ),
          },
        });
      },

      // ─── 购买超级牌 ───────────────────────────────────────────
      chooseAttributeCard: (card: Card) => {
        const { run, reward } = get();
        if (!run || !reward || (reward.step !== 'attribute' && reward.step !== 'unified')) return;
        const target = reward.attributeOptions.find(a => a.card.id === card.id);
        if (!target) return;
        if (target.purchased) return;
        if (run.runDiamonds < target.price) return;
        set({
          run: {
            ...run,
            attributeCards: [...run.attributeCards, card],
            runDiamonds: clampRunDiamonds(run.runDiamonds - target.price),
            diamondsSpentTotal: run.diamondsSpentTotal + target.price,
          },
          reward: {
            ...reward,
            attributeOptions: reward.attributeOptions.map(a =>
              a.card.id === card.id ? { ...a, purchased: true } : a
            ),
          },
        });
      },

      // ─── 钻石刷新（每阶段仅 1 次）─────────────────────────────
      refreshRewardWithDiamonds: () => {
        const { run, reward } = get();
        if (!run || !reward) return;
        if (reward.refreshUsedWithDiamonds) return;
        const refreshCost = Math.max(0, reward.diamondRefreshCost ?? getDefaultDiamondRefreshCost());
        if (run.runDiamonds < refreshCost) return;
        const afterElite = reward.afterElite ?? false;
        const allowedSkillEnhancementsForRefresh = getAllowedSkillEnhancementSet(run);
        const ownedBlack = run.acquiredSkillIds.filter((id) => run.skillEnhancements[id] === 'black').length;
        const gateN =
          reward.shopStageK != null && (allowedSkillEnhancementsForRefresh == null || allowedSkillEnhancementsForRefresh.has('black'))
            ? computeBlackEdgePityGateN(reward.shopStageK, ownedBlack)
            : null;
        const allowedSkillIdsForRefresh =
          run.difficulty !== 'freeplay' && run.allowedSkillOrders?.length
            ? getAllowedSkillIds(run.allowedSkillOrders)
            : undefined;
        const refreshed = regenerateShopOptionsForStep(
          reward.step,
          run.handTypeUpgrades,
          run.acquiredSkillIds,
          run.skillEnhancements,
          afterElite,
          false,
          reward.shopStageK,
          run.soldSkillIds ?? [],
          true,
          gateN != null ? { gateN, misses: run.blackEdgePityMisses ?? 0, cooldown: run.blackEdgePityCooldown ?? 0 } : undefined,
          allowedSkillIdsForRefresh,
          allowedSkillEnhancementsForRefresh,
        );
        const nextReward: RewardState = {
          ...reward,
          ...refreshed,
          refreshUsedWithDiamonds: true,
          blackEdgeSeenThisShop:
            (reward.blackEdgeSeenThisShop ?? false) || refreshed.skillOptions.some((o) => o.enhancement === 'black'),
        };
        set({
          run: (() => {
            let nextRun: RunState = {
              ...run,
              runDiamonds: clampRunDiamonds(run.runDiamonds - refreshCost),
              diamondsSpentTotal: run.diamondsSpentTotal + refreshCost,
            };
            // 「刷新商店乘倍」：仅统计 💎 刷新成功次数，本局永久叠加；count 写入 skillAccumulation[skillId]
            if (nextRun.acquiredSkillIds.includes(SKILL_REFRESH_SHOP_MULT)) {
              const prev = Number(nextRun.skillAccumulation?.[SKILL_REFRESH_SHOP_MULT] ?? 0);
              const cnt = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0;
              // 上限 ×2：count 至多 5（1 + 5×0.2 = 2）
              const nextCnt = Math.min(5, cnt + 1);
              nextRun = {
                ...nextRun,
                skillAccumulation: { ...nextRun.skillAccumulation, [SKILL_REFRESH_SHOP_MULT]: nextCnt },
              };
            }
            return nextRun;
          })(),
          reward: nextReward,
        });
      },

      // ─── 继续奖励下一步 / 下一关 ──────────────────────────────
      proceedRewardStep: () => {
        const { run, reward } = get();
        if (!run || !reward) return;

        // 黑边定向保底：在离开本关商店时更新 pity/cooldown（每关一次）
        if (reward.step === 'unified' && reward.shopStageK != null) {
          const k = reward.shopStageK;
          const ownedBefore = reward.blackEdgeOwnedAtOpen ?? 0;
          const ownedAfter = run.acquiredSkillIds.filter((id) => run.skillEnhancements[id] === 'black').length;
          const allowedSkillEnhancements = getAllowedSkillEnhancementSet(run);
          const blackEdgePityAllowed = allowedSkillEnhancements == null || allowedSkillEnhancements.has('black');
          const gateN = blackEdgePityAllowed ? computeBlackEdgePityGateN(k, ownedAfter) : null;
          const prevGateN = run.blackEdgePityGateN ?? null;
          let misses = blackEdgePityAllowed ? (run.blackEdgePityMisses ?? 0) : 0;
          let cooldown = blackEdgePityAllowed ? (run.blackEdgePityCooldown ?? 0) : 0;

          // 段切换：重置
          if (gateN !== prevGateN) {
            misses = 0;
            cooldown = 0;
          }

          if (gateN != null) {
            const seenBlack = reward.blackEdgeSeenThisShop ?? false;
            const boughtBlack = ownedAfter > ownedBefore;

            if (seenBlack && boughtBlack) {
              misses = 0;
              cooldown = 0;
            } else {
              // 未达成“拥有更多黑边”：misses 继续累加
              misses += 1;
              // cooldown 自然衰减
              if (cooldown > 0) cooldown = Math.max(0, cooldown - 1);
              // 特例：出现但未买 → 接下来两关不强行注入
              if (seenBlack && !boughtBlack) cooldown = 2;
            }
          }

          set({
            run: {
              ...run,
              blackEdgePityGateN: gateN ?? undefined,
              blackEdgePityMisses: misses,
              blackEdgePityCooldown: cooldown,
            },
          });
        }

        let advanced = run.isEndless
          ? advanceToNextEndlessStage(run, run.handTypeUpgrades, [], [])
          : advanceToNextStage(run, run.handTypeUpgrades, [], []);

        // ── 递减效应（按关）：进入下一关前先衰减一次，使“获得后下一关”为第 1 档（20,16,12...）
        if (advanced.status === 'running' && advanced.acquiredSkillIds.includes(SKILL_DIMINISHING_EFFECT)) {
          const prev = Number(advanced.skillAccumulation?.[SKILL_DIMINISHING_EFFECT] ?? 24);
          const cur = Number.isFinite(prev) ? prev : 24;
          const next = cur - 4;
          if (next > 0) {
            advanced = {
              ...advanced,
              skillAccumulation: { ...advanced.skillAccumulation, [SKILL_DIMINISHING_EFFECT]: next },
            };
          } else {
            advanced = removeSkillFromRun(advanced, SKILL_DIMINISHING_EFFECT);
          }
        }

        // ── 勇往直前：对新关卡参数生效（每关都生效）
        if (advanced.status === 'running') {
          const st = advanced.stages[advanced.currentStageIndex];
          if (st) {
            const patched = applyForwardRushToStageIfNeeded(st, advanced.acquiredSkillIds);
            if (patched !== st) advanced = updateStageInRun(advanced, patched);
          }
        }

        // 「精英关无限制」：进入精英/Boss 关时消耗 1 次；用完后技能消失
        if (advanced.status === 'running' && advanced.acquiredSkillIds.includes(SKILL_ELITE_UNSHACKLED)) {
          const st = advanced.stages[advanced.currentStageIndex];
          if (st && (st.isElite || st.isBoss) && st.modifierId) {
            const prev = advanced.skillAccumulation?.[SKILL_ELITE_UNSHACKLED] ?? 3;
            const next = Math.max(0, prev - 1);
            advanced = {
              ...advanced,
              skillAccumulation: { ...advanced.skillAccumulation, [SKILL_ELITE_UNSHACKLED]: next },
            };
          }
        }
        set({ run: advanced, reward: null });
        if (advanced.status === 'running') get().dealInitialHand();
      },

      // ─── IAA 辅助函数 ─────────────────────────────────────────
      /** 构造或更新 RunIaaState，自动标记 iaaAssisted 并累加 totalAdsWatched */
      // （非 store action，仅内部使用，不声明在 RLStore 中）

      // ─── IAA：刷新商店 ────────────────────────────────────────
      iaaRefreshReward: () => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'unified') return;
        if (reward.refreshUsedWithIaa) return;
        const stageIdx = run.currentStageIndex;
        const prevIaa: RunIaaState = run.iaa ?? {
          iaaAssisted: false, runReviveUsed: false,
          totalAdsWatched: 0, diamondsFromIaa: 0, perStage: {},
        };
        if (prevIaa.perStage[stageIdx]?.iaaRefreshUsed) return;

        const afterElite = reward.afterElite ?? false;
        const allowedEnhancements = getAllowedSkillEnhancementSet(run);
        const ownedBlack = run.acquiredSkillIds.filter((id) => run.skillEnhancements[id] === 'black').length;
        const gateN =
          reward.shopStageK != null && (allowedEnhancements == null || allowedEnhancements.has('black'))
            ? computeBlackEdgePityGateN(reward.shopStageK, ownedBlack)
            : null;
        const allowedIds = run.difficulty !== 'freeplay' && run.allowedSkillOrders?.length
          ? getAllowedSkillIds(run.allowedSkillOrders) : undefined;
        const refreshed = regenerateShopOptionsForStep(
          reward.step, run.handTypeUpgrades, run.acquiredSkillIds,
          run.skillEnhancements, afterElite, false, reward.shopStageK,
          run.soldSkillIds ?? [], true,
          gateN != null ? { gateN, misses: run.blackEdgePityMisses ?? 0, cooldown: run.blackEdgePityCooldown ?? 0 } : undefined,
          allowedIds,
          allowedEnhancements,
        );
        const newIaa: RunIaaState = {
          ...prevIaa, iaaAssisted: true,
          totalAdsWatched: prevIaa.totalAdsWatched + 1,
          perStage: {
            ...prevIaa.perStage,
            [stageIdx]: { ...prevIaa.perStage[stageIdx], iaaRefreshUsed: true },
          },
        };
        set({
          run: { ...run, iaa: newIaa },
          reward: {
            ...reward, ...refreshed,
            refreshUsedWithIaa: true,
            iaaItemSlotIndex: -1,
            blackEdgeSeenThisShop:
              (reward.blackEdgeSeenThisShop ?? false) || refreshed.skillOptions.some(o => o.enhancement === 'black'),
          },
        });
      },

      // ─── IAA：补钻 +3（商店/关内共享，每局限 2 次）──────────
      iaaClaimDiamonds: () => {
        const { run } = get();
        if (!run || run.status !== 'running') return;
        const prevIaa: RunIaaState = run.iaa ?? {
          iaaAssisted: false, runReviveUsed: false,
          totalAdsWatched: 0, diamondsFromIaa: 0, perStage: {},
        };
        const usedCount = prevIaa.diamondRefillCount ?? Math.floor((prevIaa.diamondsFromIaa ?? 0) / 3);
        if (usedCount >= IAA_DIAMOND_REFILL_LIMIT) return;
        const gained = 3;
        const newIaa: RunIaaState = {
          ...prevIaa, iaaAssisted: true,
          totalAdsWatched: prevIaa.totalAdsWatched + 1,
          diamondRefillCount: usedCount + 1,
          diamondsFromIaa: prevIaa.diamondsFromIaa + gained,
        };
        set({
          run: {
            ...run,
            runDiamonds: clampRunDiamonds(run.runDiamonds + gained),
            diamondsEarnedTotal: run.diamondsEarnedTotal + gained,
            iaa: newIaa,
          },
        });
      },

      // ─── IAA：购买商店 IAA 商品（初始 Roll 限 1 次）──────────
      iaaBuyItem: () => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'unified') return;
        const slotIdx = reward.iaaItemSlotIndex;
        if (slotIdx === undefined || slotIdx < 0) return;
        const stageIdx = run.currentStageIndex;
        const prevIaa: RunIaaState = run.iaa ?? {
          iaaAssisted: false, runReviveUsed: false,
          totalAdsWatched: 0, diamondsFromIaa: 0, perStage: {},
        };
        if (prevIaa.perStage[stageIdx]?.shopIaaPurchaseUsed) return;

        const numSkills  = reward.skillOptions.length;
        const numUpgrades = reward.upgradeOptions.length;
        let newRun: RunState = { ...run };
        let newReward = { ...reward, iaaItemSlotIndex: -1 };

        if (slotIdx < numSkills) {
          const opt = reward.skillOptions[slotIdx];
          if (opt.purchased || newRun.acquiredSkillIds.includes(opt.skill.id)) return;
          const blacksAfter = countBlackEdgeSlots(newRun.skillEnhancements, newRun.acquiredSkillIds) + (opt.enhancement === 'black' ? 1 : 0);
          if (newRun.acquiredSkillIds.length >= newRun.skillSlotCap + blacksAfter) return;
          newRun = {
            ...newRun,
            acquiredSkillIds: [...newRun.acquiredSkillIds, opt.skill.id],
            skillEnhancements: { ...newRun.skillEnhancements, [opt.skill.id]: opt.enhancement },
          };
          if (opt.skill.id === SKILL_DIMINISHING_EFFECT) {
            newRun = { ...newRun, skillAccumulation: { ...newRun.skillAccumulation, [opt.skill.id]: 24 } };
          } else if (opt.skill.id === SKILL_FADING_BOOST) {
            newRun = { ...newRun, skillAccumulation: { ...newRun.skillAccumulation, [opt.skill.id]: 100 } };
          } else if (opt.skill.id === SKILL_REFRESH_SHOP_MULT) {
            newRun = { ...newRun, skillAccumulation: { ...newRun.skillAccumulation, [opt.skill.id]: 0 } };
          } else if (opt.skill.id === SKILL_ELITE_UNSHACKLED) {
            newRun = { ...newRun, skillAccumulation: { ...newRun.skillAccumulation, [opt.skill.id]: 3 } };
          }
          newReward = {
            ...newReward,
            skillOptions: reward.skillOptions.map((o, i) => i === slotIdx ? { ...o, purchased: true } : o),
          };
        } else if (slotIdx < numSkills + numUpgrades) {
          const upIdx = slotIdx - numSkills;
          const opt = reward.upgradeOptions[upIdx];
          if (opt.purchased) return;
          newRun = { ...newRun, handTypeUpgrades: applyUpgrade(newRun.handTypeUpgrades, opt.option) };
          newReward = {
            ...newReward,
            upgradeOptions: reward.upgradeOptions.map((o, i) => i === upIdx ? { ...o, purchased: true } : o),
          };
        } else {
          const atIdx = slotIdx - numSkills - numUpgrades;
          const opt = reward.attributeOptions[atIdx];
          if (opt.purchased) return;
          newRun = { ...newRun, attributeCards: [...newRun.attributeCards, opt.card] };
          newReward = {
            ...newReward,
            attributeOptions: reward.attributeOptions.map((o, i) => i === atIdx ? { ...o, purchased: true } : o),
          };
        }

        const newIaa: RunIaaState = {
          ...prevIaa, iaaAssisted: true,
          totalAdsWatched: prevIaa.totalAdsWatched + 1,
          perStage: {
            ...prevIaa.perStage,
            [stageIdx]: { ...prevIaa.perStage[stageIdx], shopIaaPurchaseUsed: true },
          },
        };
        newRun = { ...newRun, iaa: newIaa };
        set({ run: newRun, reward: newReward });
      },

      // ─── IAA：HOLD+1 授权（每关限 1 次）──────────────────────
      iaaGrantExtraHold: () => {
        const { run, handState } = get();
        if (!run || !handState || handState.phase !== 'hold') return;
        const stageIdx = run.currentStageIndex;
        const rawStage = run.stages[stageIdx];
        if (!rawStage) return;
        const stage = getEffectiveStage(rawStage, run.acquiredSkillIds);
        const curHandIdx = stage.usedHands;
        const holdBlockedByStageRule =
          (stage.blockHoldBefore > 0 && curHandIdx < stage.blockHoldBefore) ||
          (stage.blockHoldAfter > 0 && curHandIdx >= stage.totalHands - stage.blockHoldAfter);
        if (stage.holdTotal <= 0 || remainingHold(stage) > 0 || holdBlockedByStageRule) return;
        const prevIaa: RunIaaState = run.iaa ?? {
          iaaAssisted: false, runReviveUsed: false,
          totalAdsWatched: 0, diamondsFromIaa: 0, perStage: {},
        };
        const ps = prevIaa.perStage[stageIdx] ?? {};
        if (ps.extraHoldUsed || ps.extraHoldGranted) return;
        const newIaa: RunIaaState = {
          ...prevIaa, iaaAssisted: true,
          totalAdsWatched: prevIaa.totalAdsWatched + 1,
          perStage: {
            ...prevIaa.perStage,
            [stageIdx]: { ...ps, extraHoldGranted: true },
          },
        };
        set({ run: { ...run, iaa: newIaa } });
      },

      // ─── IAA：手数+1（最后一手失败后，每关限 1 次）──────────
      iaaExtraHand: () => {
        const { run } = get();
        if (!run || run.status !== 'defeat') return;
        const stageIdx = run.currentStageIndex;
        const stage = run.stages[stageIdx];
        if (!stage || stage.status !== 'lost') return;
        const prevIaa: RunIaaState = run.iaa ?? {
          iaaAssisted: false, runReviveUsed: false,
          totalAdsWatched: 0, diamondsFromIaa: 0, perStage: {},
        };
        if (prevIaa.perStage[stageIdx]?.extraHandUsed) return;

        const newIaa: RunIaaState = {
          ...prevIaa, iaaAssisted: true,
          totalAdsWatched: prevIaa.totalAdsWatched + 1,
          perStage: {
            ...prevIaa.perStage,
            [stageIdx]: { ...prevIaa.perStage[stageIdx], extraHandUsed: true },
          },
        };
        const restoredStage: StageState = { ...stage, status: 'active' };
        let newRun: RunState = {
          ...run,
          status: 'running',
          iaa: newIaa,
        };
        newRun = updateStageInRun(newRun, restoredStage);
        set({ run: newRun });
        get().dealInitialHand();
      },

      // ─── IAA：复活（最终失败，按胜利过关但不结算钻石，每局限 1 次）──
      iaaRevive: () => {
        const { run, handState } = get();
        if (!run || run.status !== 'defeat') return;
        if (run.iaa?.runReviveUsed) return;
        const stageIdx = run.currentStageIndex;
        const stage = run.stages[stageIdx];
        if (!stage || stage.status !== 'lost') return;

        const prevIaa: RunIaaState = run.iaa ?? {
          iaaAssisted: false, runReviveUsed: false,
          totalAdsWatched: 0, diamondsFromIaa: 0, perStage: {},
        };
        const newIaa: RunIaaState = {
          ...prevIaa, iaaAssisted: true, runReviveUsed: true,
          totalAdsWatched: prevIaa.totalAdsWatched + 1,
        };

        const wonStage: StageState = { ...stage, status: 'won' };
        let newRun: RunState = {
          ...run,
          status: 'running',
          iaa: newIaa,
          highestSingleStageTarget: Math.max(run.highestSingleStageTarget, stage.targetGold),
        };
        newRun = updateStageInRun(newRun, wonStage);

        const stageCount = newRun.runStageCount ?? TOTAL_STAGES;
        const isLastStage = stageIdx + 1 >= stageCount && !newRun.isEndless;

        if (isLastStage) {
          set({ run: { ...newRun, status: 'victory' }, handState, reward: null });
          return;
        }

        const allowedIds = newRun.difficulty !== 'freeplay' && newRun.allowedSkillOrders?.length
          ? getAllowedSkillIds(newRun.allowedSkillOrders) : undefined;
        const allowedEnhancements = getAllowedSkillEnhancementSet(newRun);
        const blackEdgePityAllowed = allowedEnhancements == null || allowedEnhancements.has('black');
        const ownedBlack = newRun.acquiredSkillIds.filter((id) => newRun.skillEnhancements[id] === 'black').length;
        const rewardState = generateRewardForStage(
          stageIdx,
          newRun.handTypeUpgrades,
          newRun.acquiredSkillIds,
          newRun.skillEnhancements,
          false,
          newRun.isEndless,
          newRun.soldSkillIds ?? [],
          {
            gateN: blackEdgePityAllowed ? computeBlackEdgePityGateN(stageIdx + 1, ownedBlack) : null,
            misses: newRun.blackEdgePityMisses ?? 0,
            cooldown: newRun.blackEdgePityCooldown ?? 0,
          },
          allowedIds,
          allowedEnhancements,
        );
        set({ run: newRun, handState, reward: rewardState });
      },

      // ─── 获取当前关卡 ─────────────────────────────────────────
      currentStage: () => {
        const { run } = get();
        if (!run) return null;
        return run.stages[run.currentStageIndex]
          ?? (run.isEndless ? run.stages[getEndlessStageIndex(run)] : null)
          ?? null;
      },
    }),
    {
      name: ROGUELIKE_ZUSTAND_PERSIST_NAME,
      partialize: (state) => ({
        run:       state.run,
        handState: state.handState,
        reward:    state.reward,
      }),
      // 旧版存档直接丢弃，避免类型不兼容
      migrate: (persisted: unknown, version: number) => {
        if (version < 9) return { run: null, handState: null, reward: null };
        let p = persisted as { run: RunState | null; handState: unknown; reward: unknown };
        if (version < 10 && p.run && p.run.skillSlotCap === 6 && p.run.acquiredSkillIds.length <= 5) {
          p = { ...p, run: { ...p.run, skillSlotCap: 5 } };
        }
        if (version < 11 && p.run && p.run.skillSellBonus === undefined) {
          p = { ...p, run: { ...p.run, skillSellBonus: {} } };
        }
        if (version < 12 && p.run) {
          const bonus = { ...(p.run.skillSellBonus ?? {}) };
          for (const k of Object.keys(bonus)) {
            bonus[k] = clampSkillSellExtraDiamonds(bonus[k]);
          }
          p = {
            ...p,
            run: {
              ...p.run,
              soldSkillIds: p.run.soldSkillIds ?? [],
              skillSellBonus: bonus,
            },
          };
        }
        if (version < 13 && p.run && p.run.skillSellBonus) {
          const bonus = { ...p.run.skillSellBonus };
          for (const k of Object.keys(bonus)) {
            bonus[k] = clampSkillSellExtraDiamonds(bonus[k]);
          }
          p = { ...p, run: { ...p.run, skillSellBonus: bonus } };
        }
        if (version < 14 && p.run?.stages) {
          p = {
            ...p,
            run: {
              ...p.run,
              stages: p.run.stages.map((s: StageState) => ({
                ...s,
                banJokers: (s as StageState & { banJokers?: boolean }).banJokers ?? false,
              })),
            },
          };
        }
        if (version < 15 && p.run) {
          const REM = 'two_pairs_all';
          const ids = p.run.acquiredSkillIds.filter((id: string) => id !== REM);
          const enh = { ...p.run.skillEnhancements };
          delete enh[REM];
          const acc = { ...p.run.skillAccumulation };
          delete acc[REM];
          const sold = (p.run.soldSkillIds ?? []).filter((id: string) => id !== REM);
          p = {
            ...p,
            run: {
              ...p.run,
              acquiredSkillIds: ids,
              skillEnhancements: enh,
              skillAccumulation: acc,
              soldSkillIds: sold,
            },
          };
        }
        if (version < 16 && p.run) {
          p = {
            ...p,
            run: {
              ...p.run,
              blackEdgePityGateN: (p.run as RunState & { blackEdgePityGateN?: number }).blackEdgePityGateN ?? undefined,
              blackEdgePityMisses: (p.run as RunState & { blackEdgePityMisses?: number }).blackEdgePityMisses ?? 0,
              blackEdgePityCooldown: (p.run as RunState & { blackEdgePityCooldown?: number }).blackEdgePityCooldown ?? 0,
            },
          };
        }
        // v17: 「精英关无限制」改为 3 次充能；老存档若已拥有该技能但未写入次数，则补 3
        if (version < 17 && p.run && p.run.acquiredSkillIds?.includes('elite_unshackled')) {
          const acc = { ...(p.run.skillAccumulation ?? {}) } as Record<string, unknown>;
          const raw = acc.elite_unshackled;
          const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 3;
          acc.elite_unshackled = Math.max(0, Math.min(3, Math.floor(n)));
          p = { ...p, run: { ...p.run, skillAccumulation: acc as RunState['skillAccumulation'] } };
        }
        // v18: 多局长线字段补默认值（老存档无这些字段）
        if (version < 18 && p.run) {
          p = {
            ...p,
            run: {
              ...p.run,
              runNo: (p.run as RunState & { runNo?: number }).runNo ?? 0,
              difficulty: (p.run as RunState & { difficulty?: string }).difficulty ?? 'freeplay',
              deckRule: (p.run as RunState & { deckRule?: string }).deckRule ?? 'standard',
              runBanJokers: (p.run as RunState & { runBanJokers?: boolean }).runBanJokers ?? false,
              runHoldDelta: (p.run as RunState & { runHoldDelta?: number }).runHoldDelta ?? 0,
              runHandsDelta: (p.run as RunState & { runHandsDelta?: number }).runHandsDelta ?? 0,
              runShopRefreshCostDelta: (p.run as RunState & { runShopRefreshCostDelta?: number }).runShopRefreshCostDelta ?? 0,
              runShopPriceDelta: (p.run as RunState & { runShopPriceDelta?: number }).runShopPriceDelta ?? 0,
              allowedSkillOrders: (p.run as RunState & { allowedSkillOrders?: number[] }).allowedSkillOrders ?? Array.from({ length: 27 }, (_, i) => i + 1),
              runTargetMultiplier: (p.run as RunState & { runTargetMultiplier?: number }).runTargetMultiplier ?? 1.0,
              runStageCount: (p.run as RunState & { runStageCount?: number }).runStageCount ?? 20,
            },
          };
        }
        // v20: 技能附加边跟随普通局进度解锁；老存档补充本局允许边
        if (version < 20 && p.run) {
          const run = p.run as RunState & { allowedSkillEnhancements?: SkillEnhancement[] };
          const fallbackCleared =
            run.difficulty === 'freeplay'
              ? Number.MAX_SAFE_INTEGER
              : (run.isEndless || run.status === 'victory' || run.difficulty === 'hard')
                ? Math.max(0, run.runNo ?? 0)
                : Math.max(0, (run.runNo ?? 0) - 1);
          p = {
            ...p,
            run: {
              ...p.run,
              allowedSkillEnhancements:
                run.allowedSkillEnhancements
                  ?? (run.difficulty === 'freeplay'
                    ? ['flash', 'gold', 'laser', 'black']
                    : getAllowedSkillEnhancementsAfterNormalRun(fallbackCleared)),
            },
          };
        }
        return p;
      },
      version: ROGUELIKE_PERSIST_SCHEMA_VERSION as number,
    }
  )
);

