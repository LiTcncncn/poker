import React from 'react';

/**
 * IAA 播放标记：黑色圆角方块包裹红色 ▶。
 * 作为 IAA 按钮的左侧图标与文案组合使用。
 */
export function IaaPlayMark({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-[4px] bg-black shrink-0 ${className ?? ''}`}
      aria-hidden
    >
      <span className="text-red-500 text-[10px] leading-none">▶</span>
    </span>
  );
}
