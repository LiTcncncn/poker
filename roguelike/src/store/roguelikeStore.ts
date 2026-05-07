import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RunState, StageState, HandState, HandResult } from '../types/run';
import { RewardState, UpgradeOption } from '../types/reward';
import { SkillDef, SkillEnhancement } from '../types/skill';
import { Card } from '../shared/types/poker';
import {
  initRun,
  updateStageInRun,
  advanceToNextStage,
  advanceToNextEndlessStage,
  enterEndlessMode,
  defeatRun,
  TOTAL_STAGES,
  countBlackEdgeSlots,
  clampRunDiamonds,
  clampSkillSellExtraDiamonds,
  SKILL_SELL_BONUS_CAP,
} from '../engine/runEngine';
import { applyHandGold, consumeDraw, canDraw, getEffectiveStage } from '../engine/stageEngine';
import { buildBaseDeck, injectJokers, shuffle, dealCards, replaceUnheld, capJokersInHand } from '../engine/deckEngine';
import { applyUpgrade, generateRewardForStage, getDefaultDiamondRefreshCost, regenerateShopOptionsForStep } from '../engine/rewardEngine';
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

const HAND_SIZE = 5;

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
    stage.accumulatedGold + evalBase.finalGold >= stage.targetGold;
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
          gateN: computeBlackEdgePityGateN(displayK, newRun.acquiredSkillIds.filter((id) => newRun.skillEnhancements[id] === 'black').length),
          misses: newRun.blackEdgePityMisses ?? 0,
          cooldown: newRun.blackEdgePityCooldown ?? 0,
        },
      );
      set({ run: newRun, handState: newHandState, reward: rewardState });
    } else {
      const isLastStage = stage.stageIndex + 1 >= TOTAL_STAGES;
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
            gateN: computeBlackEdgePityGateN(stage.stageIndex + 1, newRun.acquiredSkillIds.filter((id) => newRun.skillEnhancements[id] === 'black').length),
            misses: newRun.blackEdgePityMisses ?? 0,
            cooldown: newRun.blackEdgePityCooldown ?? 0,
          },
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
  startNewRun:        () => void;
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

  // ── 计算 ──────────────────────────────────
  currentStage: () => StageState | null;
}

function calcSkillSellValue(quality: SkillDef['quality'], enhancement: SkillEnhancement): number {
  const qualityVal: Record<SkillDef['quality'], number> = { green: 1, blue: 2, purple: 3 };
  const enhancementVal: Record<SkillEnhancement, number> = { normal: 0, flash: 1, gold: 2, laser: 3, black: 2 };
  return qualityVal[quality] + enhancementVal[enhancement];
}

function calcStageDiamondReward(stage: StageState): number {
  const base = stage.isElite || stage.isBoss ? 5 : 3;
  const handsLeft = stage.totalHands - stage.usedHands;
  const handBonus = handsLeft >= 2 ? 2 : handsLeft === 1 ? 1 : 0;
  const holdLeft = stage.holdTotal - stage.holdUsed;
  const holdBonus = holdLeft >= 1 ? 1 : 0;
  return base + handBonus + holdBonus;
}

// ─── 构建一手牌组（含 Joker 概率） ─────────────────────────────────
function buildDeck(acquiredSkillIds: string[]): ReturnType<typeof dealCards> & { deck_: ReturnType<typeof buildBaseDeck> } {
  const jokerProb = jokerInjectProbability(acquiredSkillIds, false);
  const base = buildBaseDeck();
  const withJokers = injectJokers(base, jokerProb);
  return { deck_: withJokers } as unknown as ReturnType<typeof dealCards> & { deck_: ReturnType<typeof buildBaseDeck> };
}

export const useRLStore = create<RLStore>()(
  persist(
    (set, get) => ({
      run: null,
      handState: null,
      reward: null,

      // ─── 开始新 Run ────────────────────────────────────────────
      startNewRun: () => {
        const run = initRun();
        const stage0 = getEffectiveStage(run.stages[0], run.acquiredSkillIds);
        const jP = jokerInjectProbability(run.acquiredSkillIds, stage0.banJokers === true);
        const maxJ = maxJokersInHandCap(run.acquiredSkillIds);
        const deck = shuffle(injectJokers(buildBaseDeck(), jP));
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
        const endlessRun = enterEndlessMode(run);
        set({ run: endlessRun, reward: null });
        get().dealInitialHand();
      },

      // ─── 发初始手牌（新一手，含属性牌） ─────────────────────────
      dealInitialHand: () => {
        let { run } = get();
        if (!run || run.status !== 'running') return;
        const rawStage = run.stages[run.currentStageIndex];
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
        const jokerProb = jokerInjectProbability(run.acquiredSkillIds, stage.banJokers === true);
        const maxJ = maxJokersInHandCap(run.acquiredSkillIds);
        // 属性牌混入牌池（防御 undefined）
        const base = injectJokers(buildBaseDeck(), jokerProb);
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
        if (!canDraw(stage)) return;

        // 消耗一次补牌次数
        const updatedStage = consumeDraw(stage);
        let updatedRun = updateStageInRun(run, updatedStage);

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
        const ownedBlack = run.acquiredSkillIds.filter((id) => run.skillEnhancements[id] === 'black').length;
        const gateN = reward.shopStageK != null ? computeBlackEdgePityGateN(reward.shopStageK, ownedBlack) : null;
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
        );
        const nextReward: RewardState = {
          ...reward,
          ...refreshed,
          refreshUsedWithDiamonds: true,
          blackEdgeSeenThisShop:
            (reward.blackEdgeSeenThisShop ?? false) || refreshed.skillOptions.some((o) => o.enhancement === 'black'),
        };
        set({
          run: {
            ...run,
            runDiamonds: clampRunDiamonds(run.runDiamonds - refreshCost),
            diamondsSpentTotal: run.diamondsSpentTotal + refreshCost,
          },
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
          const gateN = computeBlackEdgePityGateN(k, ownedAfter);
          const prevGateN = run.blackEdgePityGateN ?? null;
          let misses = run.blackEdgePityMisses ?? 0;
          let cooldown = run.blackEdgePityCooldown ?? 0;

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

      // ─── 获取当前关卡 ─────────────────────────────────────────
      currentStage: () => {
        const { run } = get();
        if (!run) return null;
        return run.stages[run.currentStageIndex] ?? null;
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
        return p;
      },
      version: ROGUELIKE_PERSIST_SCHEMA_VERSION,
    }
  )
);

// ─── 忽略 buildDeck 的 unused 警告（供后续属性牌阶段使用）──
void buildDeck;
