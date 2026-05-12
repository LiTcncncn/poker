import React from 'react';
import { StageState } from '../types/run';
import { TOTAL_STAGES } from '../engine/runEngine';
import { getStageTargetGold } from '../engine/stageEngine';

interface Props {
  stage: StageState;
  runStageCount?: number;
}

export function ScoreDisplay({ stage, runStageCount }: Props) {
  const stageCount = runStageCount ?? TOTAL_STAGES;
  const targetGold = getStageTargetGold(stage);
  const pct = Math.min(stage.accumulatedGold / targetGold, 1);
  const handsLeft = stage.totalHands - stage.usedHands;

  return (
    <div className="flex flex-col gap-2 w-full px-4">
      {/* 目标金币 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">本关目标</span>
        <span className="font-bold text-rl-gold">
          {stage.accumulatedGold.toLocaleString()}
          <span className="text-gray-400 font-normal"> / {targetGold.toLocaleString()}</span>
        </span>
      </div>
      {/* 进度条 */}
      <div className="h-2 w-full bg-rl-border rounded-full overflow-hidden">
        <div
          className="h-full bg-rl-gold rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {/* 剩余手数 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          第 {stage.stageIndex + 1} 关
          {stage.stageIndex < stageCount ? ` / ${stageCount}` : ' · 无限'}
        </span>
        <span>剩余 <span className="text-white font-bold">{handsLeft}</span> 手</span>
      </div>
    </div>
  );
}
