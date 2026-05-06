import React, { useState } from 'react';
import { TOTAL_STAGES } from '../engine/runEngine';
import { RushLeaderboardModal } from './RushLeaderboardModal';

interface Props {
  onStart: () => void;
}

export function RunEntry({ onStart }: Props) {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight leading-tight">
          <span className="block text-white">难上加难的</span>
          <span className="block text-yellow-400">扑克游戏</span>
        </h1>
        <p className="text-gray-400 text-sm max-w-xs">
          {TOTAL_STAGES} 关闯关 · 每关 6 手 · 构筑你的牌型流派
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm text-gray-500 bg-rl-surface border border-rl-border rounded-xl p-4 w-full max-w-xs text-left">
        <div className="font-bold text-gray-300 mb-1">玩法说明</div>
        <div>• 每手 5 张牌，按牌型赔率结算</div>
        <div>• 每手可通过“hold-补牌”增强牌型</div>
        <div>• 通过技能、升级、超级牌三选一构筑</div>
        <div>• 每关赚取 💎，在商店挥霍</div>
        <div>• 第 3、6、9、12、15、18 为精英关；第 {TOTAL_STAGES} 关为 Boss</div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={onStart}
          className="bg-rl-gold hover:bg-yellow-300 text-black font-black text-lg px-10 py-3 rounded-xl transition-colors shadow-lg shadow-yellow-900/30"
        >
          开始游戏
        </button>
        <button
          type="button"
          onClick={() => setLeaderboardOpen(true)}
          className="bg-rl-surface hover:bg-rl-border border border-rl-border text-gray-200 hover:text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
        >
          冲关排行
        </button>
      </div>

      <RushLeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
    </div>
  );
}
