import React, { useEffect, useMemo, useState } from 'react';
import { useRLStore } from '../store/roguelikeStore';
import { HandView, SettlementBlock } from './HandView';
import { RewardModal } from './RewardModal';
import { RunResult } from './RunResult';
import InfoTabs from './InfoTabs';
import { UpgradeOption } from '../types/reward';
import { Card as CardType } from '../shared/types/poker';
import { getModifierById, canDraw, remainingHold, getEffectiveStage, isModifierSuppressed, getStageTargetGold } from '../engine/stageEngine';
import { evaluateHandWithSkills, getSkillsByIds } from '../engine/skillEngine';
import { TOTAL_STAGES, getEffectiveSkillSlotCap } from '../engine/runEngine';
import type { HandResult } from '../types/run';

/** 翻牌前：与结算槽外层同 padding，不渲染假结算文案 */
function SettlementIdlePlaceholder() {
  return (
    <div
      className="flex h-full flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pt-1"
      aria-hidden
    />
  );
}

export function StageView() {
  const {
    run, handState, reward,
    flipCards, toggleHold, drawCards, scoreHand,
    chooseSkill, chooseUpgrade,
    chooseAttributeCard,
    refreshRewardWithDiamonds, proceedRewardStep, sellSkill,
    abandonRun, dealInitialHand, currentStage,
    enterEndlessMode,
  } = useRLStore();

  // rewardVisible: 结算后先停留在 result，点击「下一关」才弹出
  // 例外：开局三选一（第一关第一手前）自动弹出
  const [rewardVisible, setRewardVisible] = useState(false);
  useEffect(() => { if (!reward) setRewardVisible(false); }, [reward]);

  // defeatReady: 失败时先显示最后一手结果，点击「本局失败 →」才跳转结束画面
  const [defeatReady, setDefeatReady] = useState(false);
  /** 精英/Boss 词缀条截断时点击展开全文 */
  const [eliteModifierSheet, setEliteModifierSheet] = useState<string | null>(null);
  useEffect(() => { setDefeatReady(false); }, [run?.runId]);
  useEffect(() => {
    setEliteModifierSheet(null);
  }, [run?.runId, run?.currentStageIndex]);
  useEffect(() => {
    if (reward && run && handState?.phase === 'deal') {
      const s = run.stages[run.currentStageIndex];
      if (s && s.usedHands === 0 && run.currentStageIndex === 0) {
        setRewardVisible(true);
      }
    }
  }, [reward, run, handState?.phase]);

  const previewHandResult = useMemo<HandResult | null>(() => {
    if (!run || !handState || handState.phase !== 'hold') return null;
    const stage = currentStage();
    if (!stage) return null;

    const effectiveStage = getEffectiveStage(stage, run.acquiredSkillIds);
    const skills = getSkillsByIds(run.acquiredSkillIds);
    const ev = evaluateHandWithSkills({
      hand: handState.hand,
      upgradeMap: run.handTypeUpgrades,
      acquiredSkills: skills,
      skillAccumulation: run.skillAccumulation,
      bannedHandTypes: effectiveStage.bannedHandTypes,
      bannedSuits: effectiveStage.bannedSuits,
      bannedRankMax: effectiveStage.bannedRankMax,
      banFaceCardScore: effectiveStage.banFaceCardScore,
      handTypeLevelDownshift: effectiveStage.handTypeLevelDownshift,
      isLastHand: effectiveStage.usedHands + 1 >= effectiveStage.totalHands,
      isFirstHandOfStage: effectiveStage.usedHands === 0,
      drawsUsedThisHand: handState.drawsUsed,
      superCardCount:    run.attributeCards?.length ?? 0,
      skillEnhancements: run.skillEnhancements,
      runDiamonds:       run.runDiamonds,
      stageTotalHands:   effectiveStage.totalHands,
      stageUsedHands:    effectiveStage.usedHands,
      randomHandAddMultiplier: run.pendingRandomHandMult,
    });

    return {
      handType: ev.handType,
      handName: ev.handName,
      scoringCardIds: ev.scoringCardIds,
      cardScoreSum: ev.cardScoreSum,
      multiplierTotal: ev.multiplierTotal,
      skillAddedScore: ev.skillAddedScore,
      skillAddedMultiplier: ev.skillAddedMultiplier,
      independentMultiplier: ev.independentMultiplier,
      finalGold: ev.finalGold,
      diamondReward: ev.diamondReward,
      skillLog: ev.skillLog,
    };
  }, [currentStage, handState, run]);

  if (!run || !handState) return null;

  if (run.status === 'victory' || (run.status === 'defeat' && defeatReady)) {
    return (
      <RunResult
        run={run}
        onRestart={abandonRun}
        onContinueChallenge={run.status === 'victory' && !run.isEndless ? enterEndlessMode : undefined}
      />
    );
  }

  const stage = currentStage();
  if (!stage) return null;
  const effectiveStage = getEffectiveStage(stage, run.acquiredSkillIds);
  const modifierDisabled = isModifierSuppressed(stage, run.acquiredSkillIds);

  const phase     = handState.phase;
  const isResult  = phase === 'result';
  const isDeal    = phase === 'deal';
  const isHold    = phase === 'hold';
  const stageDone = stage.status === 'won' || stage.status === 'lost';
  const stageTargetGold = getStageTargetGold(effectiveStage);
  /** 预览结算即可达标但尚未入账，或结算后累计严格超过目标（超分） */
  const showGoalBarGlow =
    (isHold &&
      previewHandResult != null &&
      stage.accumulatedGold < stageTargetGold &&
      stage.accumulatedGold + previewHandResult.finalGold >= stageTargetGold) ||
    (isResult && stage.accumulatedGold > stageTargetGold);
  const holdLeft  = remainingHold(effectiveStage); // 剩余补牌次数
  const canDrawNow = isHold && canDraw(effectiveStage);

  const displayStageNumber = run.isEndless
    ? TOTAL_STAGES + 1 + run.endlessStagesCleared
    : stage.stageIndex + 1;
  const stageTitle = (() => {
    const base = `第 ${displayStageNumber} 关`;
    if (stage.isBoss) return `${base} · BOSS`;
    if (stage.isElite) return `${base} · 精英`;
    return base;
  })();
  const handsLeft = effectiveStage.totalHands - effectiveStage.usedHands;
  const progressPct = Math.min(stage.accumulatedGold / stageTargetGold, 1);

  const previewProgressPct =
    previewHandResult != null
      ? Math.min((stage.accumulatedGold + previewHandResult.finalGold) / stageTargetGold, 1)
      : progressPct;
  // 圆点：剩余为实心，用掉为空心
  const holdDots = Array.from({ length: effectiveStage.holdTotal }, (_, i) => i < holdLeft);
  const modifier   = stage.modifierId ? getModifierById(stage.modifierId) : null;

  // ── 结算后下一步 ────────────────────────────────────────────
  function handleNext() {
    if (reward && stage!.status === 'won') {
      setRewardVisible(true);
    } else if (stage!.status === 'lost') {
      setDefeatReady(true);   // 先显示最后一手结果，再跳转本局失败画面
    } else {
      dealInitialHand();
    }
  }

  // ── 底部按钮区 ──────────────────────────────────────────────
  function renderButtons() {
    if (isResult) {
      const label = stage!.status === 'won'
        ? (run!.isEndless ? '下一挑战关 →' : '下一关 →')
        : stage!.status === 'lost'
          ? (run!.isEndless ? '挑战结束 →' : '本局失败 →')
          : '下一手 →';
      const cls   = stage!.status === 'won'
        ? 'w-full bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors'
        : 'w-full bg-rl-green/20 border border-rl-green text-rl-green hover:bg-rl-green hover:text-black font-black py-3 rounded-xl transition-colors';
      return (
        <button
          onClick={handleNext}
          disabled={stageDone && !reward && stage!.status !== 'lost'}
          className={cls}
        >
          {label}
        </button>
      );
    }

    if (isDeal) {
      return (
        <button
          onClick={flipCards}
          className="w-full bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors shadow-md shadow-yellow-900/30"
        >
          翻牌
        </button>
      );
    }

    if (isHold) {
      return (
        <div className="flex gap-2">
          {/* 补牌（左） */}
          <button
            onClick={canDrawNow ? drawCards : undefined}
            disabled={!canDrawNow}
            className={`flex-1 flex items-center justify-center gap-2 font-black py-3 rounded-xl transition-colors ${
              canDrawNow
                ? 'bg-rl-blue hover:bg-blue-400 text-white shadow-md shadow-blue-900/30'
                : 'bg-transparent border border-rl-border text-gray-600 cursor-not-allowed'
            }`}
          >
            <span className="font-black">
              补牌（{holdLeft}/{effectiveStage.holdTotal}）
            </span>
          </button>
          {/* 结算（右） */}
          <button
            onClick={scoreHand}
            className="flex-1 bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors shadow-md shadow-yellow-900/20"
          >
            结算
          </button>
        </div>
      );
    }

    return null;
  }

  /** 底栏（手牌 + 主按钮 + 安全区）占位，避免与中部结算区重叠 */
  const dockBottomReserve =
    'pb-[calc(268px+env(safe-area-inset-bottom,0px))]';

  return (
    <>
      {/* 纵向：顶—技能—目标 上对齐小间距 → 中部结算区 flex 吃满 → 底栏 fixed 仅手牌+按钮 */}
      <div className="flex w-full flex-1 min-h-0 flex-col">
        <div
          className={`mx-auto flex w-full max-w-[390px] flex-1 min-h-0 flex-col px-3 pt-4 ${dockBottomReserve}`}
        >
          <div className="flex shrink-0 flex-col gap-2">
            {/* 顶：钻石 / 第 n 关 / 退出 */}
            <div className="relative flex shrink-0 items-center justify-center">
              <span
                className="absolute left-0 text-xs font-bold text-amber-200/95 tabular-nums"
                title="局内商店代币，本局失败不保留"
              >
                💎{run.runDiamonds}
              </span>
              <span className="text-lg font-black text-white tracking-wide">{stageTitle}</span>
              <button
                type="button"
                onClick={abandonRun}
                className="absolute right-0 text-[11px] text-gray-500 hover:text-gray-300 border border-rl-border/50 hover:border-rl-border rounded px-2 py-0.5 transition-colors"
              >
                退出
              </button>
            </div>

            {/* 技能 / 赔率 / 超级牌 */}
            <div className="max-h-[min(44vh,360px)] min-h-0 shrink-0 overflow-y-auto [-webkit-overflow-scrolling:touch]">
              <InfoTabs run={run} />
            </div>

            {/* 关卡目标：目标、进度条、补牌、手数 */}
            <div className="flex shrink-0 flex-col gap-1.5">
        {/* 目标 + 精英词缀 */}
        <div className="flex items-center justify-between text-sm px-1">
          <span className="text-gray-300">
            本关目标 <span className="text-rl-gold font-bold">${stage.accumulatedGold.toLocaleString()}/{stageTargetGold.toLocaleString()}</span>
          </span>
          {(stage.isElite || stage.isBoss) && modifier && (
            <button
              type="button"
              onClick={() =>
                setEliteModifierSheet(
                  modifierDisabled
                    ? `${modifier.description}（禁止类限制已由「精英关无限制」抵消，手数/补牌削减仍生效）`
                    : modifier.description,
                )
              }
              className={`min-w-0 max-w-[55%] shrink text-right text-xs font-bold rounded px-1.5 py-0.5 truncate ${
                modifierDisabled
                  ? 'text-gray-400 bg-gray-700/10 border border-gray-500/40'
                  : 'text-rl-red bg-rl-red/10 border border-rl-red/40'
              }`}
            >
              {modifier.description}
            </button>
          )}
        </div>

        {/* 进度条：底层半透为「若此刻结算」总进度，上层实线为当前已入账；橘红外圈闪烁＝将过关未入账或已超分 */}
        <div className={`w-full rounded-full ${showGoalBarGlow ? 'rl-goal-bar-glow' : ''}`}>
          <div className="h-2 w-full bg-rl-border rounded-full overflow-hidden relative">
            {isHold && previewHandResult != null && (
              <div
                className="absolute inset-y-0 left-0 bg-rl-gold/35 rounded-full transition-all duration-300 z-0"
                style={{ width: `${previewProgressPct * 100}%` }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0 h-full bg-rl-gold rounded-full transition-all duration-500 z-10"
              style={{ width: `${progressPct * 100}%` }}
            />
          </div>
        </div>

        {/* 进度条下方：补牌 + 剩余手数 */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">补牌（{holdLeft}/{effectiveStage.holdTotal}）</span>
            <div className="flex gap-1">
              {holdDots.map((filled, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full border ${
                    filled ? 'bg-rl-blue border-rl-blue' : 'bg-transparent border-rl-border'
                  }`}
                />
              ))}
            </div>
          </div>
          <span className="text-gray-400">
            剩余 <span className="text-white font-bold">{handsLeft}</span> 手
          </span>
        </div>
            </div>
          </div>

          {/* 结算区：与原先 HandView 内层包裹一致；与底栏手牌区无叠压 */}
          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              {isHold && previewHandResult ? (
                <div className="flex h-full flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pt-1">
                  <SettlementBlock r={previewHandResult} preview />
                </div>
              ) : isResult && handState.lastResult ? (
                <div className="flex h-full flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pt-1">
                  <SettlementBlock r={handState.lastResult} preview={false} />
                </div>
              ) : (
                <SettlementIdlePlaceholder />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底栏：仅牌区 + 主按钮，下对齐 + 安全区 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <div
          className="pointer-events-auto w-full max-w-[390px] border-t border-rl-border/40 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom,0px))]"
        >
          <div className="flex flex-col gap-2">
            <HandView
              hand={handState.hand}
              heldIndices={handState.heldIndices}
              phase={phase}
              lastResult={handState.lastResult}
              onToggleHold={toggleHold}
            />
            {renderButtons()}
          </div>
        </div>
      </div>

      {/* 奖励弹窗 */}
      {reward && rewardVisible && (
        <RewardModal
          reward={reward}
          ownedSkills={getSkillsByIds(run.acquiredSkillIds)}
          ownedSkillEnhancements={run.skillEnhancements}
          skillAccumulation={run.skillAccumulation}
          skillSellBonus={run.skillSellBonus ?? {}}
          ownedAttributeCards={run.attributeCards ?? []}
          handTypeUpgrades={run.handTypeUpgrades}
          diamonds={run.runDiamonds}
          skillSlotCap={getEffectiveSkillSlotCap(run)}
          onChooseSkill={chooseSkill}
          onSellSkill={sellSkill}
          onChooseUpgrade={(opt) => chooseUpgrade(opt as UpgradeOption)}
          onChooseAttributeCard={(card: CardType) => chooseAttributeCard(card)}
          onRefreshWithDiamonds={refreshRewardWithDiamonds}
          onContinue={proceedRewardStep}
        />
      )}

      {eliteModifierSheet != null && (
        <div
          role="dialog"
          aria-modal
          aria-label="关卡词缀说明"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-10"
          onClick={() => setEliteModifierSheet(null)}
        >
          <div
            className="w-full max-w-[390px] max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain rounded-t-2xl border border-rl-border bg-rl-surface p-4 shadow-xl [-webkit-overflow-scrolling:touch]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
              {eliteModifierSheet}
            </p>
            <button
              type="button"
              onClick={() => setEliteModifierSheet(null)}
              className="mt-4 w-full rounded-xl bg-rl-gold py-2.5 text-[15px] font-black text-black touch-manipulation"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}
