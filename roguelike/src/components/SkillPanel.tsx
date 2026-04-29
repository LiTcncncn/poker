import React, { useState } from 'react';
import { SkillDef } from '../types/skill';
import SkillCard from './SkillCard';

interface Props {
  skills: SkillDef[];
  skillAccumulation?: Record<string, number>;
  /** 本局超级牌张数，用于「超级牌乘倍」显示当前 × */
  superCardCount?: number;
}

function withAccumulatedName(skill: SkillDef, skillAccumulation: Record<string, number>): string {
  const accumulated = skillAccumulation[skill.id] ?? 0;
  const hasScoreAccum = skill.effects.some(
    e => e.type === 'accumulate_score' || e.type === 'accumulate_score_saved_hands',
  );
  const hasMultAccum = skill.effects.some(
    e => e.type === 'accumulate_multiplier' || e.type === 'accumulate_multiplier_no_draw',
  );

  if (hasScoreAccum) return `${skill.name}+$${accumulated}`;
  if (hasMultAccum) return `${skill.name}+${accumulated}倍`;
  return skill.name;
}

export default function SkillPanel({ skills, skillAccumulation = {}, superCardCount }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (skills.length === 0) return null;
  const visibleSkills = skills.slice(0, 15);

  return (
    <div className="mt-2 relative pb-6">
      {/* 概览：每行等宽 3 个技能 */}
      <div className="grid grid-cols-3 gap-1.5">
        {visibleSkills.map(s => (
          <SkillCard
            key={s.id}
            skill={s}
            displayName={withAccumulatedName(s, skillAccumulation)}
            compact
            owned
            superCardCount={superCardCount}
          />
        ))}
      </div>

      {/* 全屏技能详情弹层 */}
      {detailOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-md">
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto w-full max-w-md">
              <div className="relative mb-3">
                <h3 className="text-center text-lg font-black text-white">技能详情</h3>
                <button
                  onClick={() => setDetailOpen(false)}
                  className="absolute right-0 top-0 h-6 w-6 inline-flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  aria-label="关闭技能详情"
                >
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {skills.map(s => (
                  <SkillCard
                    key={s.id}
                    skill={s}
                    displayName={withAccumulatedName(s, skillAccumulation)}
                    owned
                    superCardCount={superCardCount}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 底部居中：详细按钮 */}
      <button
        onClick={() => setDetailOpen(true)}
        className="absolute left-1/2 -translate-x-1/2 bottom-0 text-xs text-gray-400 hover:text-gray-200 transition-colors"
      >
        详细 ↓
      </button>
    </div>
  );
}
