import React from 'react';
import { RunState } from '../types/run';
import { TOTAL_STAGES } from '../engine/runEngine';
import { HAND_NAMES, handTypeCategoryLabel } from '../engine/handEngine';
import { HandType } from '../shared/types/poker';
import { getSkillsByIds } from '../engine/skillEngine';
import SkillPanel from './SkillPanel';
import { IaaPlayMark } from './IaaPlayMark';
import { enhancementBonusLine } from '../utils/skillEnhancementDisplay';

interface Props {
  run: RunState;
  onRestart: () => void;
  onContinueChallenge?: () => void;   // 仅主线胜利时提供
}

export function RunResult({ run, onRestart, onContinueChallenge }: Props) {
  const isVictory    = run.status === 'victory';
  const isEndless    = run.isEndless;
  const isMainVictory = isVictory && !isEndless;   // 主线通关胜利，未进无限
  const isEndlessDefeat = run.status === 'defeat' && isEndless;

  const runStageCount = run.runStageCount ?? TOTAL_STAGES;
  const mainStagesCleared = run.stages.filter(
    s => s.stageIndex < runStageCount && s.status === 'won',
  ).length;
  const endlessCleared     = run.endlessStagesCleared;
  const clearedTotal = mainStagesCleared + endlessCleared;

  const allSkills = getSkillsByIds(run.acquiredSkillIds);
  const upgrades = (Object.entries(run.handTypeUpgrades) as [HandType, number][])
    .filter(([, lv]) => lv > 1);
  const handOrder: HandType[] = [
    'high_card',
    'one_pair',
    'two_pairs',
    'three_of_a_kind',
    'straight',
    'flush',
    'full_house',
    'four_of_a_kind',
    'five_of_a_kind',
    'six_of_a_kind',
    'seven_of_a_kind',
    'straight_flush',
    'royal_flush',
  ];
  upgrades.sort((a, b) => handOrder.indexOf(a[0]) - handOrder.indexOf(b[0]));
  const qualityOrder = ['white', 'green', 'blue', 'purple', 'gold', 'orange', 'super'] as const;
  const qualityLabel: Record<(typeof qualityOrder)[number], string> = {
    white: '白',
    green: '绿',
    blue: '蓝',
    purple: '紫',
    gold: '金',
    orange: '橙',
    super: '超级',
  };
  const qualityTextClass: Record<(typeof qualityOrder)[number], string> = {
    white: 'text-gray-300',
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    gold: 'text-yellow-300',
    orange: 'text-orange-300',
    super: 'text-pink-300',
  };
  const qualityCountMap = run.attributeCards.reduce<Record<string, number>>((acc, card) => {
    acc[card.quality] = (acc[card.quality] ?? 0) + 1;
    return acc;
  }, {});
  const qualityRows = qualityOrder
    .map(q => ({ quality: q, label: qualityLabel[q], count: qualityCountMap[q] ?? 0 }))
    .filter(row => row.count > 0);

  const maxSingleHandGold = run.maxSingleHandGold ?? 0;
  const peakHand = run.bestHandThisRun ?? null;
  const enhancedSkillRows = allSkills
    .map(skill => ({
      skill,
      enhancement: run.skillEnhancements[skill.id] ?? 'normal',
    }))
    .filter(row => row.enhancement !== 'normal');

  const withAccumulatedName = (skillId: string, fallbackName: string): string => {
    const accumulated = run.skillAccumulation[skillId] ?? 0;
    const skill = allSkills.find(s => s.id === skillId);
    if (!skill) return fallbackName;
    const hasScoreAccum = skill.effects.some(
      e => e.type === 'accumulate_score' || e.type === 'accumulate_score_saved_hands',
    );
    const hasMultAccum = skill.effects.some(
      e => e.type === 'accumulate_multiplier' || e.type === 'accumulate_multiplier_no_draw',
    );
    if (hasScoreAccum) return `${fallbackName}+$${accumulated}`;
    if (hasMultAccum) return `${fallbackName}+${accumulated}倍`;
    return fallbackName;
  };

  const iaaAssisted = run.iaa?.iaaAssisted ?? false;
  const totalAdsWatched = run.iaa?.totalAdsWatched ?? 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6 text-center">

      {/* ── 标题区 ── */}
      {isMainVictory ? (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <div className="text-6xl">🏆</div>
          <h2 className="text-3xl font-black text-rl-gold">主线通关！</h2>
          <p className="text-gray-400 text-sm">恭喜你完成全部 {runStageCount} 关主线挑战</p>
        </div>
      ) : isEndlessDefeat ? (
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl">💀</div>
          <h2 className="text-3xl font-black text-rl-red">无限模式结束</h2>
          <p className="text-gray-400 text-sm">本次挑战成功 {clearedTotal} 关</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl">💀</div>
          <h2 className="text-3xl font-black text-rl-red">本局失败</h2>
          <p className="text-gray-400 text-sm">通过了 {mainStagesCleared} / {runStageCount} 关</p>
        </div>
      )}

      {/* ── Build 详情 ── */}
      <div className="bg-rl-surface border border-rl-border rounded-xl p-4 w-full max-w-[390px] text-left flex flex-col gap-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">最终 Build</div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-300 font-semibold">解锁的技能牌</div>
          {allSkills.length > 0 ? (
            <>
              <div className="flex h-48 w-full min-w-0 items-center overflow-visible">
                <SkillPanel
                  skills={allSkills}
                  acquiredSkillIds={run.acquiredSkillIds}
                  skillAccumulation={run.skillAccumulation}
                  skillEnhancements={run.skillEnhancements}
                  superCardCount={run.attributeCards.length}
                  runDiamonds={run.runDiamonds}
                />
              </div>
              {enhancedSkillRows.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg border border-rl-border/70 bg-rl-bg/25 px-2 py-2">
                  <div className="text-[11px] font-bold text-gray-400">带边技能说明</div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] leading-snug">
                    {enhancedSkillRows.map(({ skill, enhancement }) => (
                      <span key={skill.id} className="text-gray-300">
                        <span className="font-bold text-rl-gold">{skill.name}</span>
                        <span className="text-gray-500"> · </span>
                        {enhancementBonusLine(enhancement)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-500">无</div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-400 leading-snug">
            <span className="text-gray-300 font-semibold">超级牌</span>
            {run.attributeCards.length > 0 ? (
              <>
                {' '}{run.attributeCards.length} 张
                <span className="text-gray-600 mx-1">·</span>
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 align-middle">
                  {qualityRows.map((row, i) => (
                    <React.Fragment key={row.quality}>
                      {i > 0 && <span className="text-gray-600">·</span>}
                      <span className={qualityTextClass[row.quality]}>
                        {row.quality === 'super' ? '超级' : `${row.label}品质`} {row.count} 张
                      </span>
                    </React.Fragment>
                  ))}
                </span>
              </>
            ) : (
              <span className="text-gray-500"> 无</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-400 leading-snug">
            <span className="text-gray-300 font-semibold">升级过的牌型</span>
            {upgrades.length > 0 ? (
              <>
                {' '}{upgrades.length} 项
                <span className="text-gray-600 mx-1">·</span>
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 align-middle">
                  {upgrades.map(([ht, lv], i) => (
                    <React.Fragment key={ht}>
                      {i > 0 && <span className="text-gray-600">·</span>}
                      <span className="text-gray-300">
                        {HAND_NAMES[ht] ?? ht} <span className="text-rl-gold font-bold">Lv.{lv}</span>
                      </span>
                    </React.Fragment>
                  ))}
                </span>
              </>
            ) : (
              <span className="text-gray-500"> 无</span>
            )}
          </div>
        </div>

        <div className="text-xs leading-snug border-t border-rl-border pt-3">
          <span className="text-gray-500">单手最高收益</span>
          {maxSingleHandGold > 0 ? (
            <>
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-gray-200 font-bold">
                {peakHand ? handTypeCategoryLabel(peakHand.handType) : '—'}
              </span>
              <span className="text-rl-gold font-black ml-1.5">
                +${maxSingleHandGold.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-gray-600 ml-1">—</span>
          )}
        </div>

        {/* IAA 辅助标记 */}
        {iaaAssisted && (
          <div className="flex items-center gap-1.5 border-t border-rl-border pt-3 text-xs text-gray-400">
            <IaaPlayMark />
            <span>本局使用了 IAA 辅助（共 {totalAdsWatched} 次）</span>
          </div>
        )}
      </div>

      {/* ── 按钮区 ── */}
      {isMainVictory ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {onContinueChallenge && (
            <button
              onClick={onContinueChallenge}
              className="w-full bg-rl-purple hover:bg-purple-400 text-white font-black text-lg py-3 rounded-xl transition-colors shadow-lg shadow-purple-900/40"
            >
              继续挑战 🚀
            </button>
          )}
          <button
            onClick={onRestart}
            className="w-full bg-rl-surface hover:bg-rl-border border border-rl-border text-gray-300 hover:text-white font-bold py-3 rounded-xl transition-colors"
          >
            结算本局
          </button>
        </div>
      ) : (
        <button
          onClick={onRestart}
          className="w-full max-w-xs bg-rl-gold hover:bg-yellow-300 text-black font-black text-lg py-3 rounded-xl transition-colors"
        >
          再来一局
        </button>
      )}
    </div>
  );
}
