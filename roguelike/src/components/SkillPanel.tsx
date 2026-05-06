import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SkillDef, SkillEnhancement } from '../types/skill';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';

const ROW_GAP_PX = 4;
const SLOT_COUNT = 5;

interface Props {
  skills: SkillDef[];
  skillAccumulation?: Record<string, number>;
  /** 本局超级牌张数，用于「超级牌乘倍」显示当前 × */
  superCardCount?: number;
  /** 局内 💎；钻石估值/倍率牌面 */
  runDiamonds?: number;
  /** 剩手加倍牌面 */
  stageTotalHands?: number;
  stageUsedHands?: number;
  pendingRandomHandMult?: number;
  skillEnhancements?: Record<string, SkillEnhancement>;
  /** 与 `skills` 同局的已装备 id 列表（用于「技能数加倍」牌面/详情等） */
  acquiredSkillIds?: string[];
}

export default function SkillPanel({
  skills,
  skillAccumulation = {},
  superCardCount,
  runDiamonds,
  stageTotalHands,
  stageUsedHands,
  pendingRandomHandMult,
  skillEnhancements = {},
  acquiredSkillIds,
}: Props) {
  const [detail, setDetail] = useState<{ skill: SkillDef; enhancement: SkillEnhancement } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.min(window.innerWidth, 384) - 32 : 320,
  );

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRowWidth(el.clientWidth));
    ro.observe(el);
    setRowWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [skills.length]);

  const { cardWidthPx, marginLeftPx } = useMemo(() => {
    const w = Math.max(0, rowWidth - (SLOT_COUNT - 1) * ROW_GAP_PX);
    const slot = w / SLOT_COUNT;
    const n = skills.length;
    if (n === 0) return { cardWidthPx: 0, marginLeftPx: (_i: number) => 0 };
    if (n <= SLOT_COUNT) {
      return {
        cardWidthPx: slot,
        marginLeftPx: (i: number) => (i === 0 ? 0 : ROW_GAP_PX),
      };
    }
    const footprint = SLOT_COUNT * slot + (SLOT_COUNT - 1) * ROW_GAP_PX;
    const stride = (footprint - slot) / (n - 1);
    const ml = stride - slot;
    return {
      cardWidthPx: slot,
      marginLeftPx: (i: number) => (i === 0 ? 0 : ml),
    };
  }, [rowWidth, skills.length]);

  if (skills.length === 0) return null;

  return (
    <div className="relative w-full min-w-0">
      {/* 扑克技能牌单行：≤5 张等分不重叠；>5 张重叠，整体居中（仅手机宽度场景） */}
      <div ref={rowRef} className="flex w-full min-w-0 flex-nowrap items-center justify-center">
        {skills.map((s, i) => (
          <div
            key={s.id}
            className="relative shrink-0"
            style={{
              width: cardWidthPx > 0 ? cardWidthPx : undefined,
              marginLeft: marginLeftPx(i),
              zIndex: i,
            }}
          >
            <SkillPlayingCard
              skill={s}
              enhancement={skillEnhancements[s.id] ?? 'normal'}
              accumulated={skillAccumulation[s.id]}
              superCardCount={superCardCount}
              runDiamonds={runDiamonds}
              stageTotalHands={stageTotalHands}
              stageUsedHands={stageUsedHands}
              pendingRandomHandMult={pendingRandomHandMult}
              acquiredSkillIds={acquiredSkillIds ?? skills.map((x) => x.id)}
              className="!max-w-none w-full"
              onClick={() =>
                setDetail({ skill: s, enhancement: skillEnhancements[s.id] ?? 'normal' })
              }
            />
          </div>
        ))}
      </div>

      {detail ? (
        <SkillPlayingCardDetailModal
          skill={detail.skill}
          enhancement={detail.enhancement}
          accumulated={skillAccumulation[detail.skill.id]}
          superCardCount={superCardCount}
          runDiamonds={runDiamonds}
          stageTotalHands={stageTotalHands}
          stageUsedHands={stageUsedHands}
          pendingRandomHandMult={pendingRandomHandMult}
          acquiredSkillIds={acquiredSkillIds ?? skills.map((s) => s.id)}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
