import React from 'react';
import clsx from 'clsx';
import type { SkillEnhancement } from '../types/skill';
import { ENHANCEMENT_DISPLAY, enhancementBadgeParts } from '../utils/skillEnhancementDisplay';
import { SkillEdgeValueBottomStrip, SkillEdgeValueOneLine } from './SkillPlayingCard';
import { SkillCodexLockedTile } from './SkillCodexLockedTile';

interface Props {
  enhancement: Exclude<SkillEnhancement, 'normal'>;
  unlocked: boolean;
  onOpenUnlock: () => void;
  onOpenDetail: () => void;
}

function edgeRingClass(enhancement: Exclude<SkillEnhancement, 'normal'>): string {
  if (enhancement === 'flash') return 'skill-edge-ring-silver';
  if (enhancement === 'gold') return 'skill-edge-pan-gold';
  if (enhancement === 'laser') return 'skill-edge-pan-prismatic';
  return 'skill-edge-ring-black';
}

export function SkillEdgeCodexTile({
  enhancement,
  unlocked,
  onOpenUnlock,
  onOpenDetail,
}: Props) {
  if (!unlocked) {
    return <SkillCodexLockedTile onClick={onOpenUnlock} />;
  }

  const parts = enhancementBadgeParts(enhancement);
  const label = ENHANCEMENT_DISPLAY[enhancement];
  const pan = enhancement === 'gold' || enhancement === 'laser';

  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={clsx(
        'relative aspect-[2/3] w-full min-w-0 overflow-hidden rounded-[14px]',
        'shadow-[0_4px_12px_rgba(15,23,40,0.22)] touch-manipulation',
        'flex flex-col active:scale-[0.98] transition-transform',
      )}
      aria-label={label}
    >
      <div className="absolute inset-0 rounded-[14px] overflow-hidden">
        {enhancement === 'black' ? (
          <div className="skill-edge-mask-ring absolute inset-0 overflow-hidden rounded-[14px]">
            <div className="absolute inset-0 skill-edge-ring-black rounded-[14px]" />
            <div className="absolute inset-0 skill-edge-black-spots rounded-[14px]" />
          </div>
        ) : pan ? (
          <div className="skill-edge-mask-ring absolute inset-0 overflow-hidden rounded-[14px]">
            <div className="absolute inset-0 overflow-hidden rounded-[14px]">
              <div className={clsx('absolute left-0 top-0 h-full min-h-full w-[200%] max-w-none', edgeRingClass(enhancement))} />
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              'skill-edge-mask-ring absolute inset-0 rounded-[14px]',
              edgeRingClass(enhancement),
            )}
          />
        )}
      </div>
      <div className="absolute inset-[5px] z-10 flex min-h-0 flex-col overflow-hidden rounded-[9px] bg-[#0f1f35]">
        <div className="flex flex-1 items-center justify-center px-1">
          <span className="text-center text-[11px] font-black leading-tight text-white">{label}</span>
        </div>
        {parts ? (
          <SkillEdgeValueBottomStrip enhancement={enhancement} faceScale={1}>
            <SkillEdgeValueOneLine value={parts.value} enhancement={enhancement} />
          </SkillEdgeValueBottomStrip>
        ) : null}
      </div>
    </button>
  );
}
