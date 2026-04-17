import React from 'react';
import { StageState } from '../types/run';

interface Props {
  stage: StageState;
}

export function HoldBar({ stage }: Props) {
  const remaining = stage.holdTotal - stage.holdUsed;
  const dots = Array.from({ length: stage.holdTotal }, (_, i) => i < remaining);

  return (
    <div className="flex items-center gap-2 px-4">
      <span className="text-xs text-gray-400 shrink-0">补牌</span>
      <div className="flex gap-1.5">
        {dots.map((active, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border transition-colors ${
              active
                ? 'bg-rl-blue border-rl-blue shadow-[0_0_6px_rgba(96,165,250,0.6)]'
                : 'bg-transparent border-rl-border'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">{remaining}/{stage.holdTotal}</span>
    </div>
  );
}
