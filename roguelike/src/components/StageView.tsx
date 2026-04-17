import React, { useEffect, useMemo, useState } from 'react';
import { useRLStore } from '../store/roguelikeStore';
import { HandView } from './HandView';
import { RewardModal } from './RewardModal';
import { RunResult } from './RunResult';
import InfoTabs from './InfoTabs';
import { UpgradeOption } from '../types/reward';
import { Card as CardType } from '../shared/types/poker';
import { getModifierById, canDraw, remainingHold, getEffectiveStage, isModifierSuppressed } from '../engine/stageEngine';
import { evaluateHandWithSkills, getSkillsByIds } from '../engine/skillEngine';
import type { HandResult } from '../types/run';

export function StageView() {
  const {
    run, handState, reward,
    flipCards, toggleHold, drawCards, scoreHand,
    chooseSkill, chooseUpgrade,
    chooseAttributeCard,
    abandonRun, dealInitialHand, currentStage,
    enterEndlessMode,
  } = useRLStore();

  // rewardVisible: 结算后先停留在 result，点击「下一关」才弹出
  // 例外：开局三选一（第一关第一手前）自动弹出
  const [rewardVisible, setRewardVisible] = useState(false);
  useEffect(() => { if (!reward) setRewardVisible(false); }, [reward]);

  // defeatReady: 失败时先显示最后一手结果，点击「本局失败 →」才跳转结束画面
  const [defeatReady, setDefeatReady] = useState(false);
  useEffect(() => { setDefeatReady(false); }, [run?.runId]);
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
      isLastHand: effectiveStage.usedHands + 1 >= effectiveStage.totalHands,
      isFirstHandOfStage: effectiveStage.usedHands === 0,
      drawsUsedThisHand: handState.drawsUsed,
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
  const holdLeft  = remainingHold(effectiveStage); // 剩余补牌次数
  const canDrawNow = isHold && canDraw(effectiveStage);

  const displayStageNumber = run.isEndless
    ? 16 + run.endlessStagesCleared
    : stage.stageIndex + 1;
  const stageTitle = stage.isBoss
    ? 'BOSS 关'
    : stage.isElite
      ? '精英关'
      : `第 ${displayStageNumber} 关`;
  const handsLeft = effectiveStage.totalHands - effectiveStage.usedHands;
  const progressPct = Math.min(stage.accumulatedGold / stage.targetGold, 1);

  const previewProgressPct =
    previewHandResult != null
      ? Math.min((stage.accumulatedGold + previewHandResult.finalGold) / stage.targetGold, 1)
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
          {/* 结算（左） */}
          <button
            onClick={scoreHand}
            className="flex-1 bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors shadow-md shadow-yellow-900/20"
          >
            结算
          </button>
          {/* 补牌（右） */}
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
        </div>
      );
    }

    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between py-6 px-3 gap-4">
      {/* 顶部 */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        {/* 顶部标题 + 退出 */}
        <div className="relative flex items-center justify-center min-h-7">
          <span className="text-lg font-black text-white tracking-wide">{stageTitle}</span>
          <button
            onClick={abandonRun}
            className="absolute right-0 text-[11px] text-gray-500 hover:text-gray-300 border border-rl-border/50 hover:border-rl-border rounded px-2 py-0.5 transition-colors"
          >
            退出
          </button>
        </div>

        {/* 目标 + 精英词缀 */}
        <div className="flex items-center justify-between text-sm px-1">
          <span className="text-gray-300">
            本关目标 <span className="text-rl-gold font-bold">${stage.accumulatedGold.toLocaleString()}/{stage.targetGold.toLocaleString()}</span>
          </span>
          {(stage.isElite || stage.isBoss) && modifier && (
            <span
              className={`text-xs font-bold rounded px-1.5 py-0.5 max-w-[55%] truncate text-right ${
                modifierDisabled
                  ? 'text-gray-400 bg-gray-700/10 border border-gray-500/40 line-through'
                  : 'text-rl-red bg-rl-red/10 border border-rl-red/40'
              }`}
              title={modifier.description}
            >
              {modifier.description}
            </span>
          )}
        </div>

        {/* 进度条：底层半透为「若此刻结算」总进度，上层实线为当前已入账 */}
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

        <div className="mt-[10px]">
          <InfoTabs run={run} />
        </div>
      </div>

      {/* 中部：手牌（稳定下对齐到主按钮上方） */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4 flex-1 justify-end pb-1 -translate-y-[10px]">
        <HandView
          hand={handState.hand}
          heldIndices={handState.heldIndices}
          phase={phase}
          lastResult={handState.lastResult}
          previewResult={previewHandResult}
          onToggleHold={toggleHold}
        />
      </div>

      {/* 底部：操作按钮 */}
      <div className="w-full max-w-sm flex flex-col gap-3 -translate-y-[10px]">
        {renderButtons()}
      </div>

      {/* 奖励弹窗 */}
      {reward && rewardVisible && (
        <RewardModal
          reward={reward}
          stageIndex={stage.stageIndex}
          onChooseSkill={chooseSkill}
          onChooseUpgrade={(opt) => chooseUpgrade(opt as UpgradeOption)}
          onChooseAttributeCard={(card: CardType) => chooseAttributeCard(card)}
        />
      )}
    </div>
  );
}
