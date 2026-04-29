import React from 'react';
import { Card as CardType } from '../shared/types/poker';
import { HandResult } from '../types/run';
import { Card } from '../shared/components/Card';

/** 乘倍类数值展示为 1 位小数，避免 IEEE754 连乘后出现长尾巴 */
function formatMultiplierDisplay(n: number): string {
  return n.toFixed(1);
}

interface Props {
  hand: CardType[];
  heldIndices: number[];
  phase: 'deal' | 'hold' | 'drew' | 'result';
  lastResult: HandResult | null;
  /** hold 阶段：与正式结算同布局的半透预览（整手评估，不把 hold 当过滤） */
  previewResult?: HandResult | null;
  onToggleHold: (index: number) => void;
}

function SettlementBlock({ r, preview }: { r: HandResult; preview: boolean }) {
  const baseMultiplier = +(r.multiplierTotal - r.skillAddedMultiplier).toFixed(2);
  const wrapCls = preview
    ? 'mb-[15px] flex flex-col items-center gap-1.5 text-center w-full max-w-xs opacity-30 pointer-events-none text-white'
    : 'animate-score-pop mb-[15px] flex flex-col items-center gap-1.5 text-center w-full max-w-xs';

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

      {r.skillLog.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-0.5">
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

export function HandView({
  hand,
  heldIndices,
  phase,
  lastResult,
  previewResult,
  onToggleHold,
}: Props) {
  const scoringIds = new Set(lastResult?.scoringCardIds ?? []);
  const r = lastResult;
  const isResult = phase === 'result';
  const isDeal = phase === 'deal';
  const canToggle = phase === 'hold' || phase === 'drew';
  const isHold = phase === 'hold';

  return (
    <div className="flex flex-col items-center">
      {isHold && previewResult && (
        <SettlementBlock r={previewResult} preview />
      )}

      {isResult && r && <SettlementBlock r={r} preview={false} />}

      {/* 手牌 */}
      <div className={`flex gap-1.5 sm:gap-2 justify-center ${isResult ? 'pt-2' : ''}`}>
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
