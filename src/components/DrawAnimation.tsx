import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Card as CardType } from '../types/poker';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface DrawAnimationProps {
  card: CardType;
  onComplete: () => void;
}

const QUALITY_LABEL: Record<string, string> = {
  white: '白色',
  green: '绿色',
  blue: '蓝色',
  purple: '紫色',
  gold: '金色',
  orange: '橙色',
  super: '超级',
};

export const DrawAnimation: React.FC<DrawAnimationProps> = ({ card, onComplete }) => {
  const [stage, setStage] = useState<'start' | 'flip' | 'show'>('start');

  useEffect(() => {
    const t1 = setTimeout(() => setStage('flip'), 100);
    const t2 = setTimeout(() => setStage('show'), 600);
    const t3 = setTimeout(onComplete, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  const g = card.quality === 'green' ? 1 : 0;
  const b = card.quality === 'blue' ? 1 : 0;
  const p = card.quality === 'purple' ? 1 : 0;
  const isGbp = card.quality === 'green' || card.quality === 'blue' || card.quality === 'purple';
  const hasPurple = card.quality === 'purple';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-single-title"
    >
      <button
        type="button"
        onClick={onComplete}
        className="absolute right-4 top-4 z-10 rounded-lg p-2 transition-colors hover:bg-white/10"
        aria-label="关闭"
      >
        <X className="h-8 w-8 text-white" />
      </button>

      {/* 标题区 — 与 Draw10Animation 同构 */}
      <div className="mb-4 text-center sm:mb-8">
        <div className="mb-3 flex items-center justify-center sm:mb-4">
          <h2
            id="draw-single-title"
            className={clsx(
              'font-bold leading-tight text-white transition-all duration-500',
              'text-[2.25rem] sm:text-[3.375rem]',
              stage === 'start' && 'translate-y-2 opacity-0',
              (stage === 'flip' || stage === 'show') && 'translate-y-0 opacity-100'
            )}
          >
            {stage === 'show' ? '单抽' : '抽卡中…'}
          </h2>
        </div>

        <div
          className={clsx(
            'flex flex-wrap items-center justify-center gap-3 text-sm transition-opacity duration-500 sm:gap-6 sm:text-lg',
            stage === 'show' ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span className="text-green-400">绿色 ×{g}</span>
          <span className="text-blue-400">蓝色 ×{b}</span>
          <span
            className={clsx(
              'text-purple-400',
              p > 0 && 'animate-pulse font-bold'
            )}
          >
            紫色 ×{p}
          </span>
          {!isGbp && stage === 'show' && (
            <span className="text-slate-300">
              {QUALITY_LABEL[card.quality] ?? card.quality} ×1
            </span>
          )}
        </div>
      </div>

      {/* 卡牌 — 与十连抽相近的缩放，保留翻牌动画 */}
      <div className="relative perspective-1000">
        <div
          className={clsx(
            'transform transition-all duration-1000',
            stage === 'start' && 'scale-50 opacity-0 rotate-y-180',
            stage === 'flip' && 'scale-100 opacity-100 rotate-y-180',
            stage === 'show' && 'scale-100 rotate-y-0 sm:scale-105'
          )}
        >
          <div className="origin-center scale-[0.78] sm:scale-100">
            <Card
              card={card}
              isFlipped={stage === 'show'}
              showDetails={false}
              className="transition-transform hover:scale-110"
            />
          </div>
        </div>
      </div>

      {hasPurple && stage === 'show' && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 animate-ping rounded-full bg-purple-400"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
