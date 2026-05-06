import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { SkillDef, SkillEnhancement } from '../types/skill';
import { enhancementBadgeParts, enhancementBonusLine } from '../utils/skillEnhancementDisplay';
import {
  getSkillCardFaceStats,
  getSkillCumulativeFinalSegments,
  getSkillFaceBaseNumericSegments,
} from '../utils/skillCardFaceStats';
import { SKILL_FACE_NUMERIC_CLASS } from '../utils/skillNumericDisplay';
import {
  SkillEdgeValueBottomStrip,
  SkillEdgeValueOneLine,
  SkillFaceNumericOneLineRow,
  SkillPlayingCardDetailShell,
} from './SkillPlayingCard';
export function SkillPlayingCardDetailModal({
  skill,
  enhancement,
  accumulated,
  superCardCount,
  runDiamonds,
  stageTotalHands,
  stageUsedHands,
  pendingRandomHandMult,
  acquiredSkillIds,
  onClose,
}: {
  skill: SkillDef;
  enhancement: SkillEnhancement;
  accumulated?: number;
  superCardCount?: number;
  runDiamonds?: number;
  stageTotalHands?: number;
  stageUsedHands?: number;
  pendingRandomHandMult?: number;
  /** 当前局已装备技能 id；用于「技能数加倍」等局内动态牌面 */
  acquiredSkillIds?: string[];
  onClose: () => void;
}) {
  const baseNumericSegments = getSkillFaceBaseNumericSegments(skill, {
    runDiamonds,
    stageTotalHands,
    stageUsedHands,
    pendingRandomHandMult,
    acquiredSkillIds,
  });
  const cumulativeSegments = getSkillCumulativeFinalSegments(skill, { accumulated, superCardCount });
  const edgeParts = enhancementBadgeParts(enhancement);
  const faceStats = getSkillCardFaceStats(skill, { accumulated, superCardCount });
  const hasEdgeValue = Boolean(edgeParts && enhancement !== 'normal');

  const showSuperPoolHint =
    skill.effects.some((e) => e.type === 'super_card_independent_multiply') &&
    superCardCount === undefined &&
    Boolean(faceStats.superCardText);

  const cardStyle: React.CSSProperties = {
    height: 'min(22.5rem, 90dvh)',
    width: 'min(15rem, calc(100vw - 2rem), calc(min(22.5rem, 90dvh) * 2 / 3))',
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="relative isolate overflow-hidden rounded-[42px] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-1 top-1 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-2xl font-bold leading-none text-white backdrop-blur-sm transition-colors active:bg-black/55"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
        <SkillPlayingCardDetailShell
          quality={skill.quality}
          enhancement={enhancement}
          faceScale={3}
          className="h-full min-h-0 w-full"
        >
          <div className="flex h-full min-h-0 flex-col text-center">
            <div
              className={clsx(
                'flex min-h-0 flex-1 flex-col px-[6%] text-center',
                hasEdgeValue ? 'pb-4 pt-[11%]' : 'pb-[7%] pt-[11%]',
              )}
            >
              <h2 className="shrink-0 text-[1.375rem] font-black leading-[1.15] tracking-tight break-words">
                {skill.name}
              </h2>

              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden text-left [scrollbar-width:thin]">
                <p className="text-[0.9375rem] font-medium leading-relaxed opacity-[0.96]">{skill.description}</p>

                {baseNumericSegments.length > 0 ? (
                  <div className="border-t border-current/15 pt-3">
                    <div className="mb-1 text-[0.6875rem] font-black uppercase tracking-wide opacity-60">基础数值</div>
                    <div className="flex justify-center">
                      <SkillFaceNumericOneLineRow segments={baseNumericSegments} variant="detail" />
                    </div>
                  </div>
                ) : null}

                {(cumulativeSegments.length > 0 || showSuperPoolHint) && (
                  <div className="border-t border-current/15 pt-3">
                    <div className="mb-1.5 text-[0.6875rem] font-black uppercase tracking-wide opacity-60">
                      当前 / 累积
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {cumulativeSegments.map((seg, i) => (
                        <span
                          key={`${i}:${seg.kind}:${seg.text}`}
                          className={clsx(
                            SKILL_FACE_NUMERIC_CLASS[seg.kind],
                            'text-[1.0625rem] font-black tabular-nums leading-snug',
                          )}
                        >
                          {seg.text}
                        </span>
                      ))}
                      {showSuperPoolHint ? (
                        <span className="text-[0.9375rem] font-bold tabular-nums leading-snug opacity-85">
                          {faceStats.superCardText}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {hasEdgeValue && enhancement !== 'normal' ? (
              <SkillEdgeValueBottomStrip enhancement={enhancement} faceScale={3}>
                <SkillEdgeValueOneLine
                  value={enhancementBonusLine(enhancement) ?? ''}
                  enhancement={enhancement}
                  variant="detail"
                />
              </SkillEdgeValueBottomStrip>
            ) : null}
          </div>
        </SkillPlayingCardDetailShell>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
