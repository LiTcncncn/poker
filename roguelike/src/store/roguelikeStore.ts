import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RunState, StageState, HandState, HandResult } from '../types/run';
import { RewardState, UpgradeOption } from '../types/reward';
import { SkillDef } from '../types/skill';
import { Card } from '../shared/types/poker';
import { initRun, updateStageInRun, advanceToNextStage, advanceToNextEndlessStage, enterEndlessMode, defeatRun, TOTAL_STAGES } from '../engine/runEngine';
import { applyHandGold, consumeDraw, canDraw, getEffectiveStage } from '../engine/stageEngine';
import { buildBaseDeck, injectJokers, shuffle, dealCards, replaceUnheld, capJokersInHand } from '../engine/deckEngine';
import { applyUpgrade, generateRewardForStage, generateOpeningRewardState, generateSkillOptions } from '../engine/rewardEngine';
import { evaluateHandWithSkills, applyHoldSkillAccumulation, getSkillsByIds } from '../engine/skillEngine';

const HAND_SIZE = 5;

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

  const evalResult = evaluateHandWithSkills({
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
  });

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
    skillLog:              evalResult.skillLog,
  };

  // 进入结算展示时统一清空 HOLD 标记，避免“直接结算”场景残留 HOLD UI
  const newHandState: HandState = { ...handState, heldIndices: [], phase: 'result', lastResult: handResult };

  // 更新统计数据
  let newRun: RunState = {
    ...run,
    skillAccumulation: evalResult.newAccumulation,
    totalGoldEarned: run.totalGoldEarned + evalResult.finalGold,
  };

  const newStage = applyHandGold(stage, evalResult.finalGold);
  newRun = updateStageInRun(newRun, newStage);

  if (newStage.status === 'won') {
    // 更新最高单关目标记录
    newRun = { ...newRun, highestSingleStageTarget: Math.max(newRun.highestSingleStageTarget, newStage.targetGold) };

    if (run.isEndless) {
      // 无限阶段：按 endlessStagesCleared % 3 决定奖励类型（与主线节奏相同）
      const afterElite = stage.isElite;
      const rewardState = generateRewardForStage(run.endlessStagesCleared, newRun.handTypeUpgrades, newRun.acquiredSkillIds, afterElite);
      set({ run: newRun, handState: newHandState, reward: rewardState });
    } else {
      const isLastStage = stage.stageIndex + 1 >= TOTAL_STAGES;
      if (isLastStage) {
        // 主线最后一关通关 → 进入胜利画面，用户选择是否继续挑战
        const victoryRun: RunState = { ...newRun, status: 'victory' };
        set({ run: victoryRun, handState: newHandState, reward: null });
      } else {
        // 按关卡位置（stageIndex % 3）决定奖励类型
        const afterElite = stage.isElite || stage.isBoss;
        const rewardState = generateRewardForStage(stage.stageIndex, newRun.handTypeUpgrades, newRun.acquiredSkillIds, afterElite);
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
  chooseSkill:          (skill: SkillDef) => void;
  skipSkill:            () => void;
  chooseUpgrade:        (option: UpgradeOption) => void;
  chooseAttributeCard:  (card: Card) => void;
  skipAttributeCard:    () => void;

  // ── 计算 ──────────────────────────────────
  currentStage: () => StageState | null;
}

// ─── 构建一手牌组（含 Joker 概率） ─────────────────────────────────
function buildDeck(acquiredSkillIds: string[]): ReturnType<typeof dealCards> & { deck_: ReturnType<typeof buildBaseDeck> } {
  const hasJokerRate = acquiredSkillIds.includes('joker_rate');
  const jokerProb = hasJokerRate ? 0.06 : 0.03;
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
        // 先发一手面朝下的牌
        const deck = shuffle(injectJokers(buildBaseDeck(), 0.03));
        const dealt = dealCards(deck, HAND_SIZE);
        const { hand, remaining } = capJokersInHand(dealt.hand, dealt.remaining);
        // 开局技能三选一（isOpeningReward）
        const startReward = generateOpeningRewardState([]);
        set({
          run,
          reward: startReward,
          handState: { deck: remaining, hand, heldIndices: [], phase: 'deal', drawsUsed: 0, lastResult: null },
        });
      },

      abandonRun: () => set({ run: null, handState: null, reward: null }),

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
        const { run } = get();
        if (!run || run.status !== 'running') return;
        const hasJokerRate = run.acquiredSkillIds.includes('joker_rate');
        const jokerProb = hasJokerRate ? 0.06 : 0.03;
        // 属性牌混入牌池（防御 undefined）
        const base = injectJokers(buildBaseDeck(), jokerProb);
        const deck = shuffle([...base, ...(run.attributeCards ?? [])]);
        const dealt = dealCards(deck, HAND_SIZE);
        const { hand, remaining } = capJokersInHand(dealt.hand, dealt.remaining);
        set({
          handState: { deck: remaining, hand, heldIndices: [], phase: 'deal', drawsUsed: 0, lastResult: null },
          reward: null,
        });
      },

      // ─── 翻牌：deal → hold ────────────────────────────────────
      flipCards: () => {
        const { handState } = get();
        if (!handState || handState.phase !== 'deal') return;
        set({ handState: { ...handState, phase: 'hold' } });
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
        const { hand: newHand, remaining } = capJokersInHand(replaced.newHand, replaced.remaining);

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

      // ─── 选择技能（开局奖励 / 精英双步技能 / 单步技能） ──────
      chooseSkill: (skill: SkillDef) => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'skill') return;
        const newRun: RunState = { ...run, acquiredSkillIds: [...run.acquiredSkillIds, skill.id] };

        if (reward.isOpeningReward) {
          // 开局奖励：记录技能，清奖励，留在关卡 0 等待翻牌
          set({ run: newRun, reward: null });
          return;
        }

        const pending = reward.pendingSteps ?? [];
        if (pending.length > 0) {
          // 还有后续步骤（如精英双技能的第二步）：切换并动态生成新选项
          const [nextStep, ...remaining] = pending;
          const freshSkillOptions = nextStep === 'skill'
            ? generateSkillOptions(newRun.acquiredSkillIds, reward.afterElite ?? false)
            : [];
          set({
            run: newRun,
            reward: { ...reward, step: nextStep, skillOptions: freshSkillOptions, pendingSteps: remaining },
          });
        } else {
          // 无后续步骤：推进到下一关
          const advanced = newRun.isEndless
            ? advanceToNextEndlessStage(newRun, newRun.handTypeUpgrades, [], [])
            : advanceToNextStage(newRun, newRun.handTypeUpgrades, [], []);
          set({ run: advanced, reward: null });
          if (advanced.status === 'running') get().dealInitialHand();
        }
      },

      // ─── 跳过技能选择 ─────────────────────────────────────────
      skipSkill: () => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'skill') return;

        if (reward.isOpeningReward) {
          set({ reward: null });
          return;
        }

        const pending = reward.pendingSteps ?? [];
        if (pending.length > 0) {
          // 跳过当前技能步骤，切换到下一步，仍生成新选项
          const [nextStep, ...remaining] = pending;
          const freshSkillOptions = nextStep === 'skill'
            ? generateSkillOptions(run.acquiredSkillIds, reward.afterElite ?? false)
            : [];
          set({ reward: { ...reward, step: nextStep, skillOptions: freshSkillOptions, pendingSteps: remaining } });
        } else {
          const advanced = run.isEndless
            ? advanceToNextEndlessStage(run, run.handTypeUpgrades, [], [])
            : advanceToNextStage(run, run.handTypeUpgrades, [], []);
          set({ run: advanced, reward: null });
          if (advanced.status === 'running') get().dealInitialHand();
        }
      },

      // ─── 选择升级（若有 pendingSteps 则切步骤，否则推进到下一关） ──
      chooseUpgrade: (option: UpgradeOption) => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'upgrade') return;

        const newUpgrades = applyUpgrade(run.handTypeUpgrades, option);
        const newRun: RunState = { ...run, handTypeUpgrades: newUpgrades };

        const pending = reward.pendingSteps ?? [];
        if (pending.length > 0) {
          // 还有后续步骤（如属性牌），切换到下一步
          const [nextStep, ...remaining] = pending;
          set({
            run: newRun,
            reward: { ...reward, step: nextStep, pendingSteps: remaining },
          });
        } else {
          // 无后续步骤，推进到下一关
          const advanced = newRun.isEndless
            ? advanceToNextEndlessStage(newRun, newRun.handTypeUpgrades, [], [])
            : advanceToNextStage(newRun, newRun.handTypeUpgrades, [], []);
          set({ run: advanced, reward: null });
          if (advanced.status === 'running') get().dealInitialHand();
        }
      },

      // ─── 选择属性牌（奖励第三步），推进到下一关 ──────────────
      chooseAttributeCard: (card: Card) => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'attribute') return;

        const newRun = run.isEndless
          ? advanceToNextEndlessStage(run, run.handTypeUpgrades, [], [card])
          : advanceToNextStage(run, run.handTypeUpgrades, [], [card]);
        set({ run: newRun, reward: null });
        if (newRun.status === 'running') get().dealInitialHand();
      },

      // ─── 跳过属性牌选择 ──────────────────────────────────────
      skipAttributeCard: () => {
        const { run, reward } = get();
        if (!run || !reward || reward.step !== 'attribute') return;

        const newRun = run.isEndless
          ? advanceToNextEndlessStage(run, run.handTypeUpgrades, [], [])
          : advanceToNextStage(run, run.handTypeUpgrades, [], []);
        set({ run: newRun, reward: null });
        if (newRun.status === 'running') get().dealInitialHand();
      },

      // ─── 获取当前关卡 ─────────────────────────────────────────
      currentStage: () => {
        const { run } = get();
        if (!run) return null;
        return run.stages[run.currentStageIndex] ?? null;
      },
    }),
    {
      name: 'poker-roguelike-storage-v7',  // v7: 统一补牌次数，去除 rehold，简化手牌 phase
      partialize: (state) => ({
        run:       state.run,
        handState: state.handState,
        reward:    state.reward,
      }),
      // 旧版存档直接丢弃，避免类型不兼容
      migrate: (_persisted: unknown, version: number) => {
        if (version < 7) return { run: null, handState: null, reward: null };
        return _persisted as { run: RunState | null; handState: unknown; reward: unknown };
      },
      version: 7,
    }
  )
);

// ─── 忽略 buildDeck 的 unused 警告（供后续属性牌阶段使用）──
void buildDeck;
