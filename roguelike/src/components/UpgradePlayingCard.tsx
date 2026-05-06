import React, { useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import type { UpgradeOption } from '../types/reward';

export interface UpgradePlayingCardProps {
  option: Pick<UpgradeOption, 'handName' | 'currentLevel' | 'baseScoreDelta' | 'multiplierDelta'>;
  className?: string;
  onClick?: () => void;
}

/** LV 行：字多时随容器宽度缩小字号（如 LV11→12） */
function UpgradeLevelOneLine({ currentLevel, nextLevel }: { currentLevel: number; nextLevel: number }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const depKey = `${currentLevel}→${nextLevel}`;
  const maxPx = 13;
  const minPx = 5.5;
  const initialPx = 13;

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      const cw = outer.clientWidth;
      if (cw <= 0) return;
      let fs = maxPx;
      inner.style.fontSize = `${fs}px`;
      while (inner.scrollWidth > cw && fs > minPx) {
        fs -= 0.5;
        inner.style.fontSize = `${fs}px`;
      }
    };
    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    fit();
    return () => ro.disconnect();
  }, [depKey, maxPx, minPx]);

  return (
    <div ref={outerRef} className="mt-auto w-full min-w-0 shrink-0 px-[2%]">
      <span
        ref={innerRef}
        className="inline-flex w-full min-w-0 justify-center whitespace-nowrap font-black tabular-nums leading-none tracking-tight"
        style={{ fontSize: `${initialPx}px` }}
      >
        <span className="text-[#2d4a6e]">
          LV{currentLevel}→
        </span>
        <span className="text-[#2563eb]">{nextLevel}</span>
      </span>
    </div>
  );
}

/**
 * 升级商店扑克比例牌（2:3）。外环厚度与技能牌 EdgeChrome 一致：整圈约 5px（outset 底色 + inset-[5px] 内面板）。
 * 字号对齐 SkillPlayingCard：标题档 / 数值档 clamp。
 */
export function UpgradePlayingCard({ option, className, onClick }: UpgradePlayingCardProps) {
  const { handName, currentLevel } = option;
  const interactive = Boolean(onClick);
  const nextLevel = currentLevel + 1;

  /** 外环与「升级」顶栏同色 */
  const ringBg = 'bg-[#4a6fa5]';

  return (
    <div
      className={clsx(
        'group relative aspect-[2/3] w-full min-w-0 max-w-20 select-none [container-type:inline-size]',
        interactive && 'cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-[0.98]',
        className,
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="absolute inset-0 overflow-hidden rounded-[14px] pb-px shadow-[0_4px_12px_rgba(15,23,40,0.22)]">
        <div className={clsx('relative h-full w-full overflow-hidden rounded-[14px]', ringBg)}>
          <div
            className={clsx(
              'absolute inset-[5px] z-10 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[9px]',
              'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
            )}
          >
            {/* 与外环同色顶栏：紧贴内面板顶边与左右，与内描边齐平 */}
            <div
              className={clsx(
                'flex w-full shrink-0 items-center justify-center rounded-t-[9px] px-1 py-0.5 leading-none',
                ringBg,
              )}
            >
              <span className="text-[12px] font-black uppercase tracking-[0.18em] text-white">
                升级
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-[#f4f7fb] to-[#dce8f2] px-[6%] pb-[8%] pt-2 text-center">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                <h3 className="w-full text-[clamp(0.875rem,11cqw,1.125rem)] font-black leading-[1.15] tracking-tight text-[#1e3a5f] break-words [text-wrap:balance]">
                  {handName}
                </h3>
              </div>
              <UpgradeLevelOneLine currentLevel={currentLevel} nextLevel={nextLevel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
