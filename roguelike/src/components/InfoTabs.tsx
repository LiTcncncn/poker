import React, { useState } from 'react';
import { RunState } from '../types/run';
import { getHandTypeStats, HAND_NAMES } from '../engine/handEngine';
import { HandType } from '../shared/types/poker';
import SkillPanel from './SkillPanel';
import { getSkillsByIds } from '../engine/skillEngine';
import { getEffectiveSkillSlotCap } from '../engine/runEngine';
import { getEffectiveStage } from '../engine/stageEngine';
import { Card } from '../shared/components/Card';

// 主界面赔率区：5x2 两列展示（共 10 个牌型）
// 皇家同花顺与同花顺数值相同，不单独列出
const ORDERED_HAND_TYPES: HandType[] = [
  'high_card',
  'one_pair',
  'two_pairs',
  'three_of_a_kind',
  'straight',
  'flush',
  'full_house',
  'four_of_a_kind',
  'five_of_a_kind',
  'straight_flush',
];
// 赔率区显示顺序：左列 1-5，右列 6-10（按 grid 行优先渲染）
const ODDS_DISPLAY_ORDER: HandType[] = (() => {
  const half = ORDERED_HAND_TYPES.length / 2;
  const left = ORDERED_HAND_TYPES.slice(0, half);
  const right = ORDERED_HAND_TYPES.slice(half);
  return left.flatMap((ht, i) => [ht, right[i]]);
})();

interface Props {
  run: RunState;
}

type TabKey = 'skills' | 'odds' | 'pool';

export default function InfoTabs({ run }: Props) {
  const [tab, setTab] = useState<TabKey>('skills');

  const acquiredSkills = getSkillsByIds(run.acquiredSkillIds);
  const attrCards = run.attributeCards ?? [];
  const skillSlotEffective = getEffectiveSkillSlotCap(run);
  const skillCountLabel = `${acquiredSkills.length}/${skillSlotEffective}`;
  const rawStage = run.stages[run.currentStageIndex];
  const effStage = rawStage ? getEffectiveStage(rawStage, run.acquiredSkillIds) : null;

  const tabs: { key: TabKey; label: string; badge?: string | number }[] = [
    { key: 'skills', label: '技能', badge: skillCountLabel },
    { key: 'odds',   label: '赔率' },
    { key: 'pool',   label: '超级牌', badge: attrCards.length || undefined },
  ];

  return (
    <div className="w-full overflow-visible rounded-xl border border-rl-border bg-rl-card">
      {/* ── 标签栏（仅顶部圆角裁切，避免技能牌区域被 overflow:hidden 切边） ── */}
      <div className="flex overflow-hidden rounded-t-xl border-b border-rl-border">
        {tabs.map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 text-xs py-2 font-bold transition-colors ${
              tab === key
                ? 'text-rl-gold border-b-2 border-rl-gold bg-rl-gold/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {badge !== undefined && badge !== '' && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-0 leading-4 font-black tabular-nums ${
                  tab === key ? 'bg-rl-gold text-black' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 内容区：三 Tab 同高 h-48；技能 tab overflow-visible 避免叠放牌被裁切 ── */}
      <div
        className={`box-border flex h-48 flex-col p-2 ${
          tab === 'skills' ? 'overflow-visible' : 'overflow-y-auto'
        }`}
      >
        {/* ── 技能 ── */}
        {tab === 'skills' && (
          acquiredSkills.length > 0 ? (
            <div className="my-auto w-full min-w-0 overflow-visible">
              <SkillPanel
                casualHudRow
                skills={acquiredSkills}
                acquiredSkillIds={run.acquiredSkillIds}
                skillAccumulation={run.skillAccumulation}
                skillEnhancements={run.skillEnhancements}
                superCardCount={attrCards.length}
                runDiamonds={run.runDiamonds}
                stageTotalHands={effStage?.totalHands}
                stageUsedHands={effStage?.usedHands}
                pendingRandomHandMult={run.pendingRandomHandMult}
              />
            </div>
          ) : (
            <div className="my-auto text-center text-xs text-gray-600">
              暂无技能 · 过关后选择
            </div>
          )
        )}

        {/* ── 赔率（5x2） ── */}
        {tab === 'odds' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {ODDS_DISPLAY_ORDER.map(ht => {
                const stats    = getHandTypeStats(ht, run.handTypeUpgrades);
                const level    = run.handTypeUpgrades[ht] ?? 1;
                const upgraded = level > 1;
                return (
                  <div
                    key={ht}
                    className={`rounded-lg border px-2 py-1.5 ${
                      upgraded
                        ? 'border-rl-gold/40 bg-rl-gold/10'
                        : 'border-rl-border bg-white/[0.02]'
                    }`}
                  >
                    <div className="grid grid-cols-[1fr_2.7rem_2.8rem_2.2rem] items-center text-[11px] leading-4 whitespace-nowrap">
                      <span className={`font-bold truncate ${
                        upgraded ? 'text-rl-gold' : 'text-gray-300'
                      }`}>
                        {HAND_NAMES[ht]}
                      </span>
                      <span className={`text-center font-bold tabular-nums ${upgraded ? 'text-rl-gold' : 'text-gray-400'}`}>
                        Lv.{level}
                      </span>
                      <span className="text-right text-yellow-300 font-mono tabular-nums">
                        ${stats.baseScore}
                      </span>
                      <span className={`text-right font-mono font-black tabular-nums ${
                        upgraded ? 'text-rl-gold' : 'text-red-400'
                      }`}>
                        {stats.multiplier}×
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 超级牌 ── */}
        {tab === 'pool' && (
          attrCards.length > 0
            ? (
              <div className="flex flex-col gap-1 py-1">
                {/* 5x2：从左往右排列，最多 10 张 */}
                <div className="max-h-[9.25rem] overflow-y-auto pr-1">
                  <div className="grid grid-cols-5 gap-2 items-start justify-items-start">
                    {attrCards.map(card => (
                      <Card
                        key={card.id}
                        card={card}
                        isFlipped={true}
                        isHeld={false}
                        isScoring={false}
                        onClick={() => {}}
                        // 固定宽度，保证轮廓比例不变且不会被网格挤到不可见
                        style={{ width: '3.3rem', aspectRatio: '2/3' }}
                        className="cursor-default hover:!translate-y-0"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
            : (
              <div className="text-xs text-gray-600 text-center py-4">
                暂无超级牌 · 过关后选择
              </div>
            )
        )}
      </div>
    </div>
  );
}
