import React from 'react';
import { X, Gem } from 'lucide-react';
import clsx from 'clsx';
import { DRAW_SINGLE_DIAMOND_COST, DRAW_TEN_DIAMOND_COST } from '../constants/drawDiamondCosts';

interface DrawViewProps {
  diamonds: number;
  drawsSincePurple: number;
  onDraw: () => void;
  onDraw10: () => void;
  onClose: () => void;
}

export const DrawView: React.FC<DrawViewProps> = ({
  diamonds,
  drawsSincePurple,
  onDraw,
  onDraw10,
  onClose
}) => {
  const canDraw = diamonds >= DRAW_SINGLE_DIAMOND_COST;
  const canDraw10 = diamonds >= DRAW_TEN_DIAMOND_COST;

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-view-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-600/50 bg-slate-900/35 px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <h2 id="draw-view-title" className="text-2xl font-bold text-slate-100 sm:text-3xl">
            抽卡
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 transition-colors hover:bg-slate-700/80"
        >
          <X className="h-6 w-6 text-slate-400" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] sm:p-4">
        <button
          type="button"
          onClick={onDraw}
          disabled={!canDraw}
          className={clsx(
            'flex w-full transform items-center justify-center gap-3 rounded-xl border-2 px-6 py-6 text-lg font-bold shadow-lg transition-all active:scale-95',
            canDraw
              ? 'animate-button-glow-green animate-button-pulse-strong border-green-500 text-green-400 shadow-green-500/20 hover:bg-green-500/10'
              : 'cursor-not-allowed border-slate-700 text-white'
          )}
        >
          <span>单抽</span>
          <Gem className="h-5 w-5" />
          <span>{DRAW_SINGLE_DIAMOND_COST}</span>
        </button>

        <button
          type="button"
          onClick={onDraw10}
          disabled={!canDraw10}
          className={clsx(
            'relative flex w-full transform flex-col items-center gap-2 rounded-xl border-2 px-6 py-6 text-lg font-bold shadow-lg transition-all active:scale-95',
            canDraw10
              ? 'animate-button-glow-purple animate-button-pulse-strong border-purple-500 text-purple-400 shadow-purple-500/30 hover:bg-purple-500/10'
              : 'cursor-not-allowed border-slate-700 text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <span>十连抽</span>
            <Gem className="h-6 w-6" />
            <span>{DRAW_TEN_DIAMOND_COST}</span>
          </div>
          {canDraw10 && (
            <span className="text-sm text-purple-300">
              {drawsSincePurple >= 20
                ? `距保底 ${30 - drawsSincePurple} 抽`
                : '30抽保底紫卡'}
            </span>
          )}
        </button>

        <div className="rounded-xl border border-slate-600/50 bg-slate-900/35 p-4">
          <div className="flex items-center justify-center gap-2 text-cyan-400">
            <Gem className="h-5 w-5" />
            <span className="font-mono text-xl font-bold">{diamonds}</span>
          </div>
        </div>
      </div>
    </div>
  );
};






