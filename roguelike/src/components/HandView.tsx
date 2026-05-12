import React from 'react';
import { createPortal } from 'react-dom';
import { Card as CardType } from '../shared/types/poker';
import { HandResult } from '../types/run';
import { Card } from '../shared/components/Card';

/** 乘倍类数值展示为 1 位小数，避免 IEEE754 连乘后出现长尾巴 */
function formatMultiplierDisplay(n: number): string {
  return n.toFixed(1);
}

function clampModalMaxHeightPx(vhPx: number): number {
  return Math.min(Math.round(vhPx * 0.7), 520);
}

interface SettlementBlockProps {
  r: HandResult;
  preview: boolean;
}

function ValueChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'base' | 'score' | 'mult' | 'indep';
}) {
  const cls = (() => {
    if (tone === 'score') return 'border-green-500/30 text-green-200';
    if (tone === 'mult') return 'border-orange-500/30 text-orange-200';
    if (tone === 'indep') return 'border-purple-500/30 text-purple-200';
    return 'border-gray-700 text-gray-200';
  })();
  return (
    <span className={`text-[11px] bg-gray-800/80 border rounded px-2 py-1 font-mono tabular-nums ${cls}`}>
      {children}
    </span>
  );
}

function SkillLogChips({ r }: { r: HandResult }) {
  if (r.skillLog.length === 0) return null;
  return (
    <>
      {r.skillLog.map((log, i) => (
        <span
          key={`${log.skillId}-${i}`}
          className="text-[11px] bg-gray-800/80 border border-gray-700 rounded px-2 py-1 text-gray-200"
        >
          {log.skillName}
          {log.addedScore !== undefined && (
            <span className="text-green-300 ml-1">+${log.addedScore}</span>
          )}
          {log.addedMultiplier !== undefined && (
            <span className="text-orange-300 ml-1">+{log.addedMultiplier}×</span>
          )}
          {log.multiplyFactor !== undefined && (
            <span className="text-purple-300 ml-1">×{formatMultiplierDisplay(log.multiplyFactor)}</span>
          )}
        </span>
      ))}
    </>
  );
}

function FormulaSourceModal({
  r,
  onClose,
}: {
  r: HandResult;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;
  const leftValue = r.cardScoreSum + r.skillAddedScore;
  const rightValue = r.multiplierTotal * r.independentMultiplier;
  const maxH =
    typeof window !== 'undefined'
      ? clampModalMaxHeightPx(window.innerHeight || 800)
      : 520;

  return createPortal((
    <div
      role="dialog"
      aria-modal
      aria-label="数值来源"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-3 py-[max(12px,env(safe-area-inset-bottom,0px))]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-rl-border bg-rl-surface shadow-xl animate-modal-pop-in"
        style={{ maxHeight: maxH }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rl-border/70 px-4 py-3">
          <div className="text-sm font-black text-white">数值来源</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-rl-border/70 bg-white/[0.02] px-2 py-1 text-xs font-bold text-gray-300 hover:text-white"
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]">
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-rl-border/70 bg-white/[0.02] p-3">
              <div className="text-[11px] font-bold text-gray-400">计算公式（本手）</div>
              <div className="mt-1 flex items-center justify-center gap-2 font-mono text-xs">
                <span className="rounded-md border-4 border-rl-border bg-black/20 px-2 py-1">
                  <span className="text-gray-400">$</span>{' '}
                  <span className="font-black tabular-nums text-yellow-300">{leftValue}</span>
                </span>
                <span className="text-white opacity-100">×</span>
                <span className="rounded-md border-4 border-rl-border bg-black/20 px-2 py-1">
                  <span className="text-gray-400">x</span>{' '}
                  <span className="font-black tabular-nums text-red-300">{formatMultiplierDisplay(rightValue)}×</span>
                </span>
                <span className="text-gray-500">=</span>
                <span className="font-black tabular-nums text-rl-gold">{r.finalGold.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              <ValueChip tone="base">牌面+牌型 ${r.cardScoreSum}</ValueChip>
              {r.skillAddedScore > 0 && <ValueChip tone="score">技能+$ +${r.skillAddedScore}</ValueChip>}
              <ValueChip tone="mult">牌型倍+技能倍 {formatMultiplierDisplay(r.multiplierTotal)}×</ValueChip>
              {r.independentMultiplier !== 1 && (
                <ValueChip tone="indep">独立乘区 ×{formatMultiplierDisplay(r.independentMultiplier)}</ValueChip>
              )}
              <ValueChip tone="base">右侧x(合并) {formatMultiplierDisplay(rightValue)}×</ValueChip>
              <SkillLogChips r={r} />
            </div>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

/** 与原先嵌入 HandView 时完全一致的结算区 UI（字号、间距、skillLog 容器均未改） */
export function SettlementBlock({ r, preview }: SettlementBlockProps) {
  const wrapCls = preview
    ? 'flex flex-col items-center gap-1.5 text-center w-full max-w-xs text-white'
    : 'flex flex-col items-center gap-1.5 text-center w-full max-w-xs';
  const [formulaOpen, setFormulaOpen] = React.useState(false);
  const leftValue = r.cardScoreSum + r.skillAddedScore;
  const rightValue = r.multiplierTotal * r.independentMultiplier;
  const previewFade = preview ? 'opacity-30' : '';
  const numberPopCls = preview ? '' : 'animate-score-pop inline-block';

  return (
    <>
    <div className={wrapCls}>
      <div className={`w-full px-1 text-center ${previewFade}`}>
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

      <button
        type="button"
        onClick={() => setFormulaOpen(true)}
        className={[
          'w-full select-none touch-manipulation',
          'flex items-center justify-center',
          'font-mono leading-5',
          'cursor-pointer hover:opacity-95 active:opacity-90',
        ].join(' ')}
        aria-label="计算公式"
      >
        <span className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span
            className={[
              'inline-flex w-full items-center justify-center rounded-xl px-3 py-1.5',
              'bg-blue-600 text-white shadow-sm',
            ].join(' ')}
          >
            <span className={`font-black tabular-nums text-lg text-white ${numberPopCls}`}>
              {leftValue}
            </span>
          </span>
          <span className="text-2xl font-black leading-none text-white">×</span>
          <span
            className={[
              'inline-flex w-full items-center justify-center rounded-xl px-3 py-1.5',
              'bg-red-600 text-white shadow-sm',
            ].join(' ')}
          >
            <span className={`font-black tabular-nums text-lg text-white ${numberPopCls}`}>
              {formatMultiplierDisplay(rightValue)}×
            </span>
          </span>
        </span>
      </button>

      {(r.diamondReward ?? 0) > 0 && (
        <div
          className={
            preview
              ? 'text-sm font-bold text-amber-200/90'
              : 'text-sm font-black text-amber-300 drop-shadow-sm'
          }
          style={preview ? { opacity: 0.3 } : undefined}
        >
          本手局内 💎 +{r.diamondReward}
        </div>
      )}

      {/* 主界面不展示任何“数值来源”信息；来源仅在弹窗内展示 */}
    </div>
    {formulaOpen && (
      <FormulaSourceModal
        r={r}
        onClose={() => setFormulaOpen(false)}
      />
    )}
    </>
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
