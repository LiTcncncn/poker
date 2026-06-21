import React from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title: string;
  unlockRunTitle: string;
  onClose: () => void;
}

/** 未解锁技能/边：点击后居中弹层展示解锁条件（风格对齐技能详情 Modal） */
export function SkillCodexUnlockModal({ title, unlockRunTitle, onClose }: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal
      aria-label={`${title}解锁条件`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-[#0f1f35] px-5 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center text-lg font-black text-white">{title}</h3>
        <p className="mt-5 text-center text-sm text-gray-400">解锁条件</p>
        <p className="mt-2 text-center text-base font-bold text-rl-gold">
          普通通关「{unlockRunTitle}」
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-rl-gold py-3 text-base font-black text-black touch-manipulation"
        >
          关闭
        </button>
      </div>
    </div>,
    document.body,
  );
}
