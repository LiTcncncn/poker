import React from 'react';
import { RunState } from '../types/run';
import { HAND_NAMES } from '../engine/handEngine';
import { HandType } from '../shared/types/poker';

interface Props {
  run: RunState;
  onRestart: () => void;
  onContinueChallenge?: () => void;   // 仅主线胜利时提供
}

export function RunResult({ run, onRestart, onContinueChallenge }: Props) {
  const isVictory    = run.status === 'victory';
  const isEndless    = run.isEndless;
  const isMainVictory = isVictory && !isEndless;   // 主线 15 关胜利，未进无限
  const isEndlessDefeat = run.status === 'defeat' && isEndless;

  const mainStagesCleared  = Math.min(run.stages.filter(s => s.status === 'won').length, 15);
  const endlessCleared     = run.endlessStagesCleared;
  const totalStagesCleared = mainStagesCleared + endlessCleared;

  const upgrades = Object.entries(run.handTypeUpgrades) as [HandType, number][];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6 text-center">

      {/* ── 标题区 ── */}
      {isMainVictory ? (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <div className="text-6xl">🏆</div>
          <h2 className="text-3xl font-black text-rl-gold">主线通关！</h2>
          <p className="text-gray-400 text-sm">恭喜你完成全部 15 关主线挑战</p>
        </div>
      ) : isEndlessDefeat ? (
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl">💀</div>
          <h2 className="text-3xl font-black text-rl-red">继续挑战结束</h2>
          <p className="text-gray-400 text-sm">无限挑战第 {endlessCleared + 1} 关阵亡</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="text-5xl">💀</div>
          <h2 className="text-3xl font-black text-rl-red">本局失败</h2>
          <p className="text-gray-400 text-sm">通过了 {mainStagesCleared} / 15 关</p>
        </div>
      )}

      {/* ── 成绩卡片 ── */}
      <div className="bg-rl-surface border border-rl-border rounded-xl p-4 w-full max-w-xs text-left flex flex-col gap-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">本局成绩</div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <span className="text-gray-400">主线通关</span>
          <span className={mainStagesCleared >= 15 ? 'text-rl-gold font-bold' : 'text-gray-300'}>
            {mainStagesCleared >= 15 ? '✓ 全部 15 关' : `${mainStagesCleared} / 15 关`}
          </span>

          {(isEndless || isEndlessDefeat) && (
            <>
              <span className="text-gray-400">无限挑战</span>
              <span className="text-rl-purple font-bold">+{endlessCleared} 关</span>
            </>
          )}

          <span className="text-gray-400">总通关数</span>
          <span className="text-gray-300">{totalStagesCleared} 关</span>

          <span className="text-gray-400">总累计金币</span>
          <span className="text-rl-gold font-bold">${run.totalGoldEarned.toLocaleString()}</span>

          <span className="text-gray-400">最高单关目标</span>
          <span className="text-gray-300">${run.highestSingleStageTarget.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Build 概览 ── */}
      {(upgrades.length > 0 || run.acquiredSkillIds.length > 0 || run.attributeCards.length > 0) && (
        <div className="bg-rl-surface border border-rl-border rounded-xl p-4 w-full max-w-xs text-left flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">最终 Build</div>

          {run.acquiredSkillIds.length > 0 && (
            <div className="text-xs text-gray-400">
              <span className="text-gray-300 font-semibold">技能</span>
              {' '}{run.acquiredSkillIds.length} 个
            </div>
          )}

          {run.attributeCards.length > 0 && (
            <div className="text-xs text-gray-400">
              <span className="text-gray-300 font-semibold">属性牌</span>
              {' '}{run.attributeCards.length} 张
            </div>
          )}

          {upgrades.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-1">
              {upgrades.map(([ht, lv]) => (
                <div key={ht} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-400">{HAND_NAMES[ht] ?? ht}</span>
                  <span className="text-rl-gold">Lv.{lv}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
