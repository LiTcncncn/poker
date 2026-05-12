import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SkillDef, SkillEnhancement } from '../types/skill';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';

const ROW_GAP_PX = 4;
const SLOT_COUNT = 5;
/** 2～4 张时牌与牌之间的目标间距（行宽不够时会压窄，必要时略重叠） */
const BETWEEN_CARDS_GAP_PX = 10;
/** 关内技能条牌面视觉放大（可与既有重叠规则共存） */
const SKILL_CARD_VISUAL_SCALE = 1.15;

function hashU32(str: string, salt: number): number {
  let h = salt >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** 主界面 HUD 用：每张牌稳定、微小的旋转/缩放/轻 skew，避免一排过于整齐（仅关内 Tab 开启） */
function stableCasualCardTransform(skillId: string, index: number): React.CSSProperties {
  const n1 = (hashU32(skillId, index * 7919) % 1001) / 1000;
  const n2 = (hashU32(skillId, index * 8191) % 1001) / 1000;
  const n3 = (hashU32(skillId, index * 65537) % 1001) / 1000;
  const n4 = (hashU32(skillId, index * 9973) % 1001) / 1000;
  const rotDeg = (n1 - 0.5) * 4.2;
  const scale = 0.991 + n2 * 0.018;
  const ty = (n3 - 0.5) * 2.8;
  const skewDeg = (n4 - 0.5) * 1.4;
  return {
    transform: `rotate(${rotDeg.toFixed(2)}deg) scale(${scale.toFixed(4)}) skewX(${skewDeg.toFixed(2)}deg) translateY(${ty.toFixed(2)}px)`,
    transformOrigin: '50% 92%',
  };
}

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
  /**
   * 仅主界面技能 Tab：每张牌轻微旋转/缩放/skew，一排更自然；商店/结算等勿开。
   */
  casualHudRow?: boolean;
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
  casualHudRow = false,
}: Props) {
  const [detail, setDetail] = useState<{ skill: SkillDef; enhancement: SkillEnhancement } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
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

  /**
   * 1 张：居中；2～4 张：整组居中、牌间留合理间距（不贴齐左右两侧）；5 张及以上：步进重叠排满行宽（zIndex 递增）。
   */
  const { cardWidthPx, marginLeftPx, rowJustify } = useMemo(() => {
    const rw = Math.max(0, rowWidth);
    const inner = Math.max(0, rw - (SLOT_COUNT - 1) * ROW_GAP_PX);
    const slot = inner / SLOT_COUNT;
    const cardW = slot * SKILL_CARD_VISUAL_SCALE;
    const n = skills.length;
    if (n === 0) {
      return { cardWidthPx: 0, marginLeftPx: (_i: number) => 0, rowJustify: 'center' as const };
    }
    if (n === 1) {
      return {
        cardWidthPx: Math.min(cardW, rw),
        marginLeftPx: (_i: number) => 0,
        rowJustify: 'center' as const,
      };
    }
    if (n < SLOT_COUNT) {
      let gap = Math.max(ROW_GAP_PX * 2, BETWEEN_CARDS_GAP_PX);
      const totalNoOverlap = n * cardW + (n - 1) * gap;
      if (totalNoOverlap > rw) {
        gap = Math.max(ROW_GAP_PX, (rw - n * cardW) / Math.max(1, n - 1));
      }
      return {
        cardWidthPx: cardW,
        marginLeftPx: (i: number) => (i === 0 ? 0 : gap),
        rowJustify: 'center' as const,
      };
    }
    const stride = (rw - cardW) / (n - 1);
    const ml = stride - cardW;
    return {
      cardWidthPx: cardW,
      marginLeftPx: (i: number) => (i === 0 ? 0 : ml),
      rowJustify: 'start' as const,
    };
  }, [rowWidth, skills.length]);

  const applyCasual = casualHudRow && !reduceMotion;

  if (skills.length === 0) return null;

  return (
    <div className="relative w-full min-w-0 overflow-visible py-1">
      {/* 扑克技能牌单行：少张数居中留距，满 5 张步进重叠排满版心 */}
      <div
        ref={rowRef}
        className={`flex w-full min-w-0 flex-nowrap items-center overflow-visible ${
          rowJustify === 'center' ? 'justify-center' : 'justify-start'
        }`}
      >
        {skills.map((s, i) => (
          <div
            key={s.id}
            className="relative shrink-0 overflow-visible"
            style={{
              width: cardWidthPx > 0 ? cardWidthPx : undefined,
              marginLeft: marginLeftPx(i),
              zIndex: i,
              ...(applyCasual ? stableCasualCardTransform(s.id, i) : {}),
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
