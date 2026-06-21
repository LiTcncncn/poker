import React from 'react';
import clsx from 'clsx';

interface Props {
  onClick: () => void;
  className?: string;
}

/** 图鉴未解锁：牌背仅「？」；点击由父级打开解锁条件弹层 */
export function SkillCodexLockedTile({ onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'relative aspect-[2/3] w-full min-w-0 overflow-hidden rounded-[14px]',
        'border border-white/10 bg-[#0c1828] shadow-[0_4px_12px_rgba(15,23,40,0.22)]',
        'flex flex-col items-center justify-center touch-manipulation',
        className,
      )}
      aria-label="未解锁"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 6px, transparent 6px 12px)',
        }}
        aria-hidden
      />
      <span className="relative z-[1] text-2xl font-black text-gray-400">？</span>
    </button>
  );
}
