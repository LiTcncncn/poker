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
import { IaaPlayMark } from './IaaPlayMark';

/** 翻牌前：与结算槽外层同 padding，不渲染假结算文案 */
function SettlementIdlePlaceholder() {
  return (
    <div
      className="flex h-full flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain px-0.5 pt-1"
      aria-hidden
    >
      {/* 为保证“公式矩形”位置固定：占位一行与 SettlementBlock 的牌型+收益同高 */}
      <div className="flex flex-col items-center gap-1.5 text-center w-full max-w-xs">
        <div className="w-full px-1 text-center">
          <span className="inline-flex items-baseline justify-center gap-4 text-4xl font-black tracking-wide opacity-0">
            <span>占位</span>
            <span className="text-3xl">+$0</span>
          </span>
        </div>

        {/* 未翻牌/无预结算时：常驻展示“计算公式”两矩形（不半透），数值为 0 */}
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono leading-5">
          <div className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-1.5 text-white shadow-sm">
            <span className="font-black tabular-nums text-lg">0</span>
          </div>
          <div className="text-2xl font-black leading-none text-white">×</div>
          <div className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-3 py-1.5 text-white shadow-sm">
            <span className="font-black tabular-nums text-lg">0.0×</span>
          </div>
        </div>
      </div>
    </div>
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
    iaaRefreshReward, iaaClaimDiamonds, iaaBuyItem,
    iaaGrantExtraHold, iaaExtraHand, iaaRevive,
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
      runHandsPlayedTotal: run.handsPlayedTotal ?? 0,
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

  // 主线胜利（非无尽）：由 App.tsx 的 EndlessChoiceModal 处理，StageView 不渲染
  if (run.status === 'victory' && !run.isEndless) return null;

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
  const modifier = stage.modifierId ? getModifierById(stage.modifierId) : null;

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
  /** 精英/Boss 且有关卡词缀时显示第二行，关名略小；无词缀行时关名放大，顶块高度保持一致 */
  const showStageModifierStrip = (stage.isElite || stage.isBoss) && !!modifier;

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
  /** 与顶部「剩余 X 手」一致：未打完的本关手数 / 本关总手数 */
  const handsRemainLabel = `（${handsLeft}/${effectiveStage.totalHands}）`;

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

  // ── IAA 状态（从 run.iaa 派生）──────────────────────────────
  const iaaState = run?.iaa;
  const stageIdx = stage?.stageIndex ?? 0;
  const iaaPerStage = iaaState?.perStage[stageIdx] ?? {};

  const currentHandIdx = effectiveStage.usedHands;
  const holdBlockedByStageRule =
    (effectiveStage.blockHoldBefore > 0 && currentHandIdx < effectiveStage.blockHoldBefore) ||
    (effectiveStage.blockHoldAfter > 0 && currentHandIdx >= effectiveStage.totalHands - effectiveStage.blockHoldAfter);

  // IAA HOLD+1：仅在正常补牌次数用尽时出现，不绕过“前/后 N 手不可补牌”词缀
  const canIaaGrantHold =
    isHold &&
    effectiveStage.holdTotal > 0 &&
    holdLeft <= 0 &&
    !holdBlockedByStageRule &&
    !iaaPerStage.extraHoldGranted &&
    !iaaPerStage.extraHoldUsed;

  // IAA HOLD+1 已授权（让补牌按钮可用）
  const iaaHoldGranted = iaaPerStage.extraHoldGranted ?? false;

  // 是否显示 IAA 手数+1（最后一手失败后，本关未用）
  const showIaaExtraHand =
    run?.status === 'defeat' &&
    stage?.status === 'lost' &&
    !iaaPerStage.extraHandUsed;

  // 是否显示 IAA 复活（手数+1 已用或不再出现，本局复活未用）
  const showIaaRevive =
    run?.status === 'defeat' &&
    stage?.status === 'lost' &&
    iaaPerStage.extraHandUsed &&    // 手数+1 已用
    !iaaState?.runReviveUsed;

  // ── 底部按钮区 ──────────────────────────────────────────────
  function renderButtons() {
    if (isResult) {
      const isLost = stage!.status === 'lost';
      const isWon  = stage!.status === 'won';
      const label = isWon
        ? (run!.isEndless ? '下一挑战关 →' : '下一关 →')
        : isLost
          ? (run!.isEndless ? '挑战结束 →' : '本局失败 →')
          : `下一手 →${handsRemainLabel}`;
      const primaryCls = isWon
        ? 'w-full bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors'
        : 'w-full bg-rl-green/20 border border-rl-green text-rl-green hover:bg-rl-green hover:text-black font-black py-3 rounded-xl transition-colors';

      if (isLost && (showIaaExtraHand || showIaaRevive)) {
        return (
          <div className="flex gap-2">
            {showIaaExtraHand && (
              <button
                type="button"
                onClick={iaaExtraHand}
                className="flex-1 flex items-center justify-center gap-1.5 bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors"
              >
                手数+1 <IaaPlayMark />
              </button>
            )}
            {showIaaRevive && (
              <button
                type="button"
                onClick={iaaRevive}
                className="flex-1 flex items-center justify-center gap-1.5 bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors"
              >
                <IaaPlayMark /> 复活
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 bg-rl-green/20 border border-rl-green text-rl-green hover:bg-rl-green hover:text-black font-black py-3 rounded-xl transition-colors"
            >
              {label}
            </button>
          </div>
        );
      }

      return (
        <button
          onClick={handleNext}
          disabled={stageDone && !reward && !isLost}
          className={primaryCls}
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
      const canDrawFinal = canDrawNow || iaaHoldGranted || canIaaGrantHold;
      const handleDrawClick = () => {
        if (canDrawNow || iaaHoldGranted) {
          drawCards();
          return;
        }
        if (canIaaGrantHold) {
          iaaGrantExtraHold();
          drawCards();
        }
      };
      return (
        <div className="flex gap-2">
          {/* 补牌（左）：普通补牌 / 播放标识补牌共用同一个按钮 */}
          <button
            onClick={canDrawFinal ? handleDrawClick : undefined}
            disabled={!canDrawFinal}
            className={`flex-1 flex items-center justify-center gap-2 font-black py-3 rounded-xl transition-colors ${
              canDrawFinal
                ? 'bg-rl-blue hover:bg-blue-400 text-white shadow-md shadow-blue-900/30'
                : 'bg-transparent border border-rl-border text-gray-600 cursor-not-allowed'
            }`}
          >
            {canIaaGrantHold && <IaaPlayMark />}
            <span className="font-black">
              {canIaaGrantHold ? '补牌' : `补牌（${holdLeft}/${effectiveStage.holdTotal}）`}
            </span>
            {iaaHoldGranted && <IaaPlayMark />}
          </button>
          {/* 结算（右） */}
          <button
            onClick={scoreHand}
            className="flex-1 bg-rl-gold hover:bg-yellow-300 text-black font-black py-3 rounded-xl transition-colors shadow-md shadow-yellow-900/20"
          >
            结算{handsRemainLabel}
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
            {/* 顶：关名 + 可选词缀；固定最小高度，无词缀时关名放大 */}
            <div className="flex min-h-[5.75rem] shrink-0 flex-col justify-center gap-1">
              <div className="relative flex min-h-9 items-center justify-center">
                <div className="absolute left-0 flex items-center gap-1.5">
                  <span
                    className="text-sm font-bold text-amber-200/95 tabular-nums"
                    title="局内商店代币，本局失败不保留"
                  >
                    💎{run.runDiamonds}
                  </span>
                  {!iaaPerStage.diamondRefillUsed && (
                    <button
                      type="button"
                      onClick={iaaClaimDiamonds}
                      title="看广告获得 +💎3"
                      className="flex items-center gap-0.5 rounded-[5px] border border-rl-gold/50 bg-rl-gold/10 px-1.5 py-0.5 text-[11px] font-bold text-rl-gold active:bg-rl-gold/20"
                    >
                      <IaaPlayMark />
                      <span>+💎3</span>
                    </button>
                  )}
                </div>
                <span
                  className={`px-10 text-center font-black leading-tight text-white tracking-wide ${
                    showStageModifierStrip ? 'text-lg' : 'text-2xl'
                  }`}
                >
                  {stageTitle}
                </span>
                <button
                  type="button"
                  onClick={abandonRun}
                  className="absolute right-0 rounded border border-rl-border/50 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-rl-border hover:text-gray-300"
                >
                  退出
                </button>
              </div>

              {showStageModifierStrip && (
                <div className="shrink-0 px-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEliteModifierSheet(
                        modifierDisabled
                          ? `${modifier.description}（禁止类限制已由「精英关无限制」抵消，手数/补牌削减仍生效）`
                          : modifier.description,
                      )
                    }
                    className={`w-full rounded-lg px-2 py-1.5 text-center text-xs font-bold leading-snug ${
                      modifierDisabled
                        ? 'text-gray-400 bg-gray-700/10 border border-gray-500/40'
                        : 'text-rl-red bg-rl-red/10 border border-rl-red/40'
                    }`}
                  >
                    {modifier.description}
                  </button>
                </div>
              )}
            </div>

            {/* 技能 / 赔率 / 超级牌 */}
            <div className="max-h-[min(44vh,360px)] min-h-0 shrink-0 overflow-y-auto [-webkit-overflow-scrolling:touch]">
              <InfoTabs run={run} />
            </div>

            {/* 关卡目标：目标、进度条 */}
            <div className="flex shrink-0 flex-col gap-1.5">
        {/* 本关目标 */}
        <div className="flex items-center justify-center text-sm px-1">
          <span className="text-gray-300">
            本关目标 <span className="text-rl-gold font-bold">${stage.accumulatedGold.toLocaleString()}/{stageTargetGold.toLocaleString()}</span>
          </span>
        </div>

        {/* 进度条：底层半透为「若此刻结算」总进度，上层实线为当前已入账；橘红外圈闪烁＝将过关未入账或已超分 */}
        <div className={`w-full rounded-full ${showGoalBarGlow ? 'rl-goal-bar-glow' : ''}`}>
          <div className="h-2 w-full bg-rl-border rounded-full overflow-hidden relative">
            {isHold && previewHandResult != null && (
              <div
                className={`absolute inset-y-0 left-0 bg-rl-gold/35 rounded-full transition-all duration-300 z-0 ${
                  showGoalBarGlow ? 'rl-goal-bar-fill-flash-soft' : ''
                }`}
                style={{ width: `${previewProgressPct * 100}%` }}
              />
            )}
            <div
              className={`absolute inset-y-0 left-0 h-full bg-rl-gold rounded-full transition-all duration-500 z-10 ${
                showGoalBarGlow ? 'rl-goal-bar-fill-flash' : ''
              }`}
              style={{ width: `${progressPct * 100}%` }}
            />
          </div>
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
          stageIndex={run.currentStageIndex}
          iaaClaimDiamondsUsed={run.iaa?.perStage[run.currentStageIndex]?.diamondRefillUsed ?? false}
          onChooseSkill={chooseSkill}
          onSellSkill={sellSkill}
          onChooseUpgrade={(opt) => chooseUpgrade(opt as UpgradeOption)}
          onChooseAttributeCard={(card: CardType) => chooseAttributeCard(card)}
          onRefreshWithDiamonds={refreshRewardWithDiamonds}
          onIaaRefreshReward={iaaRefreshReward}
          onIaaClaimDiamonds={iaaClaimDiamonds}
          onIaaBuyItem={iaaBuyItem}
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
