import React from 'react';
import { X, Gem } from 'lucide-react';
import clsx from 'clsx';

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
  const canDraw = diamonds >= 100;
  const canDraw10 = diamonds >= 900;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">抽卡</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            {/* 单抽按钮 */}
            <button
              onClick={onDraw}
              disabled={!canDraw}
              className={clsx(
                "w-full px-6 py-6 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 border-2 flex items-center justify-center gap-3",
                canDraw
                  ? "border-green-500 text-green-400 hover:bg-green-500/10 shadow-green-500/20 animate-button-pulse-strong animate-button-glow-green"
                  : "border-slate-700 text-slate-600 cursor-not-allowed"
              )}
            >
              <span>单抽</span>
              <Gem className="w-5 h-5" />
              <span>100</span>
            </button>

            {/* 十连抽按钮 */}
            <button
              onClick={onDraw10}
              disabled={!canDraw10}
              className={clsx(
                "w-full px-6 py-6 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 border-2 flex flex-col items-center gap-2 relative",
                canDraw10
                  ? "border-purple-500 text-purple-400 hover:bg-purple-500/10 shadow-purple-500/30 animate-button-pulse-strong animate-button-glow-purple"
                  : "border-slate-700 text-slate-600 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-2">
                <span>十连抽</span>
                <Gem className="w-6 h-6" />
                <span>900</span>
              </div>
              {canDraw10 && (
                <span className="text-sm text-purple-300">
                  {drawsSincePurple >= 20 
                    ? `距保底 ${30 - drawsSincePurple} 抽` 
                    : '30抽保底紫卡'}
                </span>
              )}
            </button>

            {/* 当前钻石显示 */}
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="flex items-center justify-center gap-2 text-cyan-400">
                <Gem className="w-5 h-5" />
                <span className="text-xl font-bold font-mono">{diamonds}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};






