import React from 'react';
import { createPortal } from 'react-dom';
import type { SkillEnhancement } from '../types/skill';
import { ENHANCEMENT_DISPLAY, enhancementBonusLine } from '../utils/skillEnhancementDisplay';

interface Props {
  enhancement: Exclude<SkillEnhancement, 'normal'>;
  onClose: () => void;
}

export function SkillEdgeCodexDetailSheet({ enhancement, onClose }: Props) {
  const label = ENHANCEMENT_DISPLAY[enhancement];
  const line = enhancementBonusLine(enhancement);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-10"
      role="dialog"
      aria-modal
      aria-label={`${label}说明`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[390px] rounded-t-2xl border border-rl-border bg-rl-surface px-5 py-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center text-lg font-black text-white">{label}</h3>
        {line ? (
          <p className="mt-3 text-center text-base font-bold text-rl-gold">{line}</p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-rl-gold py-3 text-base font-black text-black touch-manipulation"
        >
          关闭
        </button>
      </div>
    </div>,
    document.body,
  );
}
