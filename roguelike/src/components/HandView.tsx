import React from 'react';
import { Card as CardType } from '../shared/types/poker';
import { HandResult } from '../types/run';
import { Card } from '../shared/components/Card';

/** 乘倍类数值展示为 1 位小数，避免 IEEE754 连乘后出现长尾巴 */
function formatMultiplierDisplay(n: number): string {
  return n.toFixed(1);
}

interface SettlementBlockProps {
  r: HandResult;
  preview: boolean;
}

/** 与原先嵌入 HandView 时完全一致的结算区 UI（字号、间距、skillLog 容器均未改） */
export function SettlementBlock({ r, preview }: SettlementBlockProps) {
  const baseMultiplier = +(r.multiplierTotal - r.skillAddedMultiplier).toFixed(2);
  const wrapCls = preview
    ? 'flex flex-col items-center gap-1.5 text-center w-full max-w-xs opacity-30 pointer-events-none text-white'
    : 'animate-score-pop flex flex-col items-center gap-1.5 text-center w-full max-w-xs';

  return (
    <div className={wrapCls}>
      <div className="w-full px-1 text-center">
        <span
          className={
            preview
              ? 'inline-flex items-baseline justify-center gap-4 text-4xl font-black text-white tracking-wide'
              : 'inline-flex items-baseline justify-center gap-4 text-4xl font-black text-rl-gold tracking-wide'
          }
        >
          {r.handName}
          <span className={preview ? 'text-3xl text-white' : 'text-3xl text-cyan-300'}>
            +${r.finalGold.toLocaleString()}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-center gap-0.5 font-mono text-xs leading-5 flex-wrap">
        <span className={preview ? 'text-white' : 'text-gray-500'}>(</span>
        <span className={preview ? 'text-white font-bold' : 'text-yellow-300 font-bold'}>{r.cardScoreSum}</span>
        {r.skillAddedScore > 0 && (
          <>
            <span className={preview ? 'text-white' : 'text-gray-600'}>+</span>
            <span className={preview ? 'text-white font-bold' : 'text-green-400 font-bold'}>↑{r.skillAddedScore}</span>
          </>
        )}
        <span className={preview ? 'text-white' : 'text-gray-500'}>)</span>

        <span className={preview ? 'text-white mx-1' : 'text-gray-500 mx-1'}>×</span>

        <span className={preview ? 'text-white' : 'text-gray-500'}>(</span>
        <span className={preview ? 'text-white font-bold' : 'text-red-400 font-bold'}>{baseMultiplier}×</span>
        {r.skillAddedMultiplier > 0 && (
          <>
            <span className={preview ? 'text-white' : 'text-gray-600'}>+</span>
            <span className={preview ? 'text-white font-bold' : 'text-orange-400 font-bold'}>↑{r.skillAddedMultiplier}×</span>
          </>
        )}
        <span className={preview ? 'text-white' : 'text-gray-500'}>)</span>

        {r.independentMultiplier !== 1 && (
          <>
            <span className={preview ? 'text-white mx-1' : 'text-gray-500 mx-1'}>×</span>
            <span className={preview ? 'text-white font-bold' : 'text-purple-400 font-bold'}>
              ↑{formatMultiplierDisplay(r.independentMultiplier)}
            </span>
          </>
        )}

        <span className={preview ? 'text-white mx-1' : 'text-gray-500 mx-1'}>=</span>
        <span className={preview ? 'text-white font-black' : 'text-rl-gold font-black'}>{r.finalGold.toLocaleString()}</span>
      </div>

      {(r.diamondReward ?? 0) > 0 && (
        <div
          className={
            preview
              ? 'text-sm font-bold text-amber-200/90'
              : 'text-sm font-black text-amber-300 drop-shadow-sm'
          }
        >
          本手局内 💎 +{r.diamondReward}
        </div>
      )}

      {r.skillLog.length > 0 && (
        <div className="flex max-h-[72px] flex-wrap justify-center gap-1 mt-0.5 overflow-y-auto overscroll-contain">
          {r.skillLog.slice(0, 6).map((log, i) => (
            <span
              key={i}
              className={
                preview
                  ? 'text-[10px] text-white bg-white/10 border border-white/25 rounded px-1.5 py-0.5'
                  : 'text-[10px] bg-gray-800/80 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300'
              }
            >
              {log.skillName}
              {log.addedScore !== undefined && (
                <span className={preview ? 'text-white ml-0.5' : 'text-green-400 ml-0.5'}>+${log.addedScore}</span>
              )}
              {log.addedMultiplier !== undefined && (
                <span className={preview ? 'text-white ml-0.5' : 'text-orange-400 ml-0.5'}>+{log.addedMultiplier}×</span>
              )}
              {log.multiplyFactor !== undefined && (
                <span className={preview ? 'text-white ml-0.5' : 'text-purple-400 ml-0.5'}>
                  ×{formatMultiplierDisplay(log.multiplyFactor)}
                </span>
              )}
            </span>
          ))}
          {r.skillLog.length > 6 && (
            <span className={preview ? 'text-[10px] text-white' : 'text-[10px] text-gray-500'}>
              +{r.skillLog.length - 6}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface HandViewProps {
  hand: CardType[];
  heldIndices: number[];
  phase: 'deal' | 'hold' | 'drew' | 'result';
  lastResult: HandResult | null;
  onToggleHold: (index: number) => void;
}

/** 仅手牌区（结算在 StageView 中部独立展示） */
export function HandView({
  hand,
  heldIndices,
  phase,
  lastResult,
  onToggleHold,
}: HandViewProps) {
  const scoringIds = new Set(lastResult?.scoringCardIds ?? []);
  const isResult = phase === 'result';
  const isDeal = phase === 'deal';
  const canToggle = phase === 'hold' || phase === 'drew';

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div
        className={`flex w-full min-w-0 gap-1.5 justify-center px-0.5 ${isResult ? 'pt-2' : 'pt-1'}`}
      >
        {hand.map((card, i) => {
          const held = heldIndices.includes(i);
          const scoring = isResult && scoringIds.has(card.id);

          return (
            <Card
              key={card.id}
              card={card}
              isFlipped={!isDeal}
              isHeld={held}
              isScoring={scoring}
              onClick={() => canToggle && onToggleHold(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
