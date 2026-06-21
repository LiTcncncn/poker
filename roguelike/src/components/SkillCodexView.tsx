import React, { useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';
import { SkillCodexLockedTile } from './SkillCodexLockedTile';
import { SkillCodexUnlockModal } from './SkillCodexUnlockModal';
import { SkillEdgeCodexDetailSheet } from './SkillEdgeCodexDetailSheet';
import { SkillEdgeCodexTile } from './SkillEdgeCodexTile';
import type { SkillDef, SkillEnhancement } from '../types/skill';
import { ENHANCEMENT_DISPLAY } from '../utils/skillEnhancementDisplay';
import {
  CODEX_EDGE_ITEMS,
  getCodexUnlockRunTitleForEdge,
  getCodexUnlockRunTitleForSkill,
  isEnhancementUnlockedInCodex,
  isSkillUnlockedInCodex,
  listSkillsForCodex,
} from '../utils/skillCodexUnlock';

interface Props {
  onBack: () => void;
}

type UnlockModalState = {
  title: string;
  unlockRunTitle: string;
};

export function SkillCodexView({ onBack }: Props) {
  const highestNormalCleared = useProfileStore((s) => s.profile.highestNormalRunCleared);
  const skills = listSkillsForCodex();

  const [skillDetail, setSkillDetail] = useState<SkillDef | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<Exclude<SkillEnhancement, 'normal'> | null>(null);
  const [unlockModal, setUnlockModal] = useState<UnlockModalState | null>(null);

  const openUnlockModal = (title: string, unlockRunTitle: string | null) => {
    if (!unlockRunTitle) return;
    setUnlockModal({ title, unlockRunTitle });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a192e]">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0a192e]/95 px-3 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-sm font-bold text-rl-gold touch-manipulation"
        >
          ← 返回
        </button>
        <h1 className="text-base font-black text-white">技能图鉴</h1>
        <span className="w-12" aria-hidden />
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4">
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-gray-300">附加边</h2>
          <div className="mx-auto grid max-w-[320px] grid-cols-4 gap-2">
            {CODEX_EDGE_ITEMS.map(({ key, enhancement }) => {
              const unlocked = isEnhancementUnlockedInCodex(enhancement, highestNormalCleared);
              const unlockRunTitle = getCodexUnlockRunTitleForEdge(enhancement);
              return (
                <SkillEdgeCodexTile
                  key={key}
                  enhancement={enhancement}
                  unlocked={unlocked}
                  onOpenUnlock={() =>
                    openUnlockModal(ENHANCEMENT_DISPLAY[enhancement], unlockRunTitle)
                  }
                  onOpenDetail={() => setEdgeDetail(enhancement)}
                />
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-300">技能牌</h2>
          <div className="grid grid-cols-5 gap-2">
            {skills.map((skill) => {
              const unlocked = isSkillUnlockedInCodex(skill.id, highestNormalCleared);
              if (!unlocked) {
                return (
                  <SkillCodexLockedTile
                    key={skill.id}
                    onClick={() =>
                      openUnlockModal('未解锁技能', getCodexUnlockRunTitleForSkill(skill.id))
                    }
                  />
                );
              }
              return (
                <SkillPlayingCard
                  key={skill.id}
                  skill={skill}
                  enhancement="normal"
                  className="max-w-none"
                  onClick={() => setSkillDetail(skill)}
                />
              );
            })}
          </div>
        </section>
      </div>

      {skillDetail ? (
        <SkillPlayingCardDetailModal
          skill={skillDetail}
          enhancement="normal"
          onClose={() => setSkillDetail(null)}
        />
      ) : null}

      {edgeDetail ? (
        <SkillEdgeCodexDetailSheet enhancement={edgeDetail} onClose={() => setEdgeDetail(null)} />
      ) : null}

      {unlockModal ? (
        <SkillCodexUnlockModal
          title={unlockModal.title}
          unlockRunTitle={unlockModal.unlockRunTitle}
          onClose={() => setUnlockModal(null)}
        />
      ) : null}
    </div>
  );
}
