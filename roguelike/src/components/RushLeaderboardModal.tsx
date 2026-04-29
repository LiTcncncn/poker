import React, { useMemo, useState } from 'react';
import {
  loadRushLeaderboard,
  clearRushLeaderboard,
  formatRushLeaderboardTime,
  rushMaxHandLabel,
} from '../storage/rushLeaderboard';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RushLeaderboardModal({ open, onClose }: Props) {
  const [listVersion, setListVersion] = useState(0);
  const rows = useMemo(
    () => (open ? loadRushLeaderboard() : []),
    [open, listVersion],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="rush-lb-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-rl-border bg-rl-surface shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center px-10 py-3 border-b border-rl-border min-h-[2.75rem]">
          <h2 id="rush-lb-title" className="text-sm font-black text-white tracking-wide">
            冲关排行
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="关闭"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="px-3 py-3 max-h-[min(70vh,420px)] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-8">暂无记录，完成一局后会自动上榜</p>
          ) : (
            <div className="font-mono text-[11px] sm:text-xs text-gray-200 leading-relaxed">
              <div className="grid grid-cols-[2rem_2.5rem_minmax(3rem,1fr)_4.5rem_5.5rem] gap-x-2 gap-y-1 pb-2 border-b border-rl-border/80 text-gray-500 font-sans text-[10px]">
                <span>排名</span>
                <span>冲关</span>
                <span className="truncate">峰值牌型</span>
                <span className="text-right">单手最高收益</span>
                <span className="text-right">时间</span>
              </div>
              {rows.map((e, i) => (
                <div
                  key={`${e.endedAt}-${i}`}
                  className="grid grid-cols-[2rem_2.5rem_minmax(3rem,1fr)_4.5rem_5.5rem] gap-x-2 gap-y-0.5 py-1 border-b border-rl-border/40 last:border-0 items-baseline"
                >
                  <span className="text-gray-400">{i + 1}</span>
                  <span className="text-white font-bold tabular-nums">{e.clearedTotal}</span>
                  <span className="truncate text-gray-300" title={rushMaxHandLabel(e.maxHandType)}>
                    {rushMaxHandLabel(e.maxHandType)}
                  </span>
                  <span className="text-right text-rl-gold font-bold tabular-nums">
                    {e.maxSingleHandGold}
                  </span>
                  <span className="text-right text-gray-400 tabular-nums">
                    {formatRushLeaderboardTime(e.endedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-rl-border px-3 py-2.5 flex justify-center bg-rl-surface/80">
          <button
            type="button"
            onClick={() => {
              clearRushLeaderboard();
              setListVersion(v => v + 1);
            }}
            className="text-xs font-bold text-gray-500 hover:text-rl-red border border-transparent hover:border-rl-red/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            清除记录
          </button>
        </div>
      </div>
    </div>
  );
}
