import React from 'react';
import { useRLStore } from '../store/roguelikeStore';

/** 局内轻提示（IAA 失败原因等），2.2s 自动消失 */
export function GameToast() {
  const message = useRLStore((s) => s.gameToast);
  if (!message) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-[max(4.5rem,env(safe-area-inset-top))] z-[200] w-[min(340px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-white/15 bg-slate-900/92 px-4 py-2.5 text-center text-sm font-semibold leading-snug text-slate-100 shadow-lg backdrop-blur-sm animate-fade-in"
    >
      {message}
    </div>
  );
}
