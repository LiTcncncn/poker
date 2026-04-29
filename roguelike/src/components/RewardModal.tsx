import React, { useMemo, useState } from 'react';
import { UpgradeOption, RewardState } from '../types/reward';
import { HandTypeUpgradeMap } from '../types/run';
import { SkillDef } from '../types/skill';
import { Card as CardType, HandType } from '../shared/types/poker';
import { Card } from '../shared/components/Card';
import SkillCard from './SkillCard';
import { HAND_NAMES } from '../engine/handEngine';

interface Props {
  reward: RewardState;
  stageIndex: number;
  /** 选择技能时展示：已拥有技能 / 牌型 LV / 超级牌（与主界面标签容器风格一致） */
  ownedSkills?: SkillDef[];
  skillAccumulation?: Record<string, number>;
  handTypeUpgrades?: HandTypeUpgradeMap;
  ownedAttributeCards?: CardType[];
  onChooseSkill:        (skill: SkillDef) => void;
  onChooseUpgrade:      (option: UpgradeOption) => void;
  onChooseAttributeCard:(card: CardType) => void;
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

/** 与主界面赔率区牌型顺序一致（皇家同花顺不单独列出升级项） */
const LV_TAB_HAND_ORDER: HandType[] = [
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

type RewardOwnedTab = 'skills' | 'lv' | 'pool';

/** 内容区高度：约等于主界面一行 5 张超级牌（3.3rem 宽、2:3）+ 内边距 */
const REWARD_OWNED_PANEL_CONTENT_H = 'h-[6rem]';

function RewardOwnedBuildTabs({
  ownedSkills,
  skillAccumulation,
  handTypeUpgrades,
  attributeCards,
}: {
  ownedSkills: SkillDef[];
  skillAccumulation: Record<string, number>;
  handTypeUpgrades: HandTypeUpgradeMap;
  attributeCards: CardType[];
}) {
  const [tab, setTab] = useState<RewardOwnedTab>('skills');

  const upgradedRows = useMemo(() => {
    const entries = (Object.entries(handTypeUpgrades) as [HandType, number][])
      .filter(([, lv]) => lv > 1);
    entries.sort((a, b) => {
      const ia = LV_TAB_HAND_ORDER.indexOf(a[0]);
      const ib = LV_TAB_HAND_ORDER.indexOf(b[0]);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return entries;
  }, [handTypeUpgrades]);

  const tabs: { key: RewardOwnedTab; label: string; badge?: number }[] = [
    { key: 'skills', label: '技能', badge: ownedSkills.length || undefined },
    { key: 'lv', label: 'LV', badge: upgradedRows.length || undefined },
    { key: 'pool', label: '超级牌', badge: attributeCards.length || undefined },
  ];

  return (
    <div className="w-full rounded-xl bg-rl-card border border-rl-border overflow-hidden text-left">
      <div className="flex border-b border-rl-border">
        {tabs.map(({ key, label, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 text-xs py-2 font-bold transition-colors ${
              tab === key
                ? 'text-rl-gold border-b-2 border-rl-gold bg-rl-gold/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {badge !== undefined && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-0 leading-4 font-black ${
                  tab === key ? 'bg-rl-gold text-black' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={`p-2 ${REWARD_OWNED_PANEL_CONTENT_H} overflow-y-auto`}>
        {tab === 'skills' && (
          ownedSkills.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {ownedSkills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  displayName={withAccumulatedName(skill, skillAccumulation)}
                  compact
                  owned
                  superCardCount={attributeCards.length}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-600 text-center py-3">暂无技能</div>
          )
        )}

        {tab === 'lv' && (
          upgradedRows.length > 0 ? (
            <div className="flex flex-col gap-1">
              {upgradedRows.map(([ht, lv]) => (
                <div
                  key={ht}
                  className="text-xs text-gray-200 rounded-lg border border-rl-gold/30 bg-rl-gold/10 px-2 py-1.5 font-bold"
                >
                  {HAND_NAMES[ht] ?? ht} Lv.{lv}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-600 text-center py-3">暂无牌型升级</div>
          )
        )}

        {tab === 'pool' && (
          attributeCards.length > 0 ? (
            <div className="grid grid-cols-5 gap-2 items-start justify-items-start">
              {attributeCards.map(card => (
                <Card
                  key={card.id}
                  card={card}
                  isFlipped={true}
                  isHeld={false}
                  isScoring={false}
                  onClick={() => {}}
                  style={{ width: '3.3rem', aspectRatio: '2/3' }}
                  className="cursor-default hover:!translate-y-0"
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-600 text-center py-3">暂无超级牌</div>
          )
        )}
      </div>
    </div>
  );
}

/** 升级 / 超级牌弹窗与技能弹窗共用的「已获得」标签区（默认选中技能） */
function ObtainedBuildSection({
  ownedSkills,
  skillAccumulation,
  handTypeUpgrades,
  ownedAttributeCards,
}: {
  ownedSkills: SkillDef[];
  skillAccumulation: Record<string, number>;
  handTypeUpgrades: HandTypeUpgradeMap;
  ownedAttributeCards: CardType[];
}) {
  return (
    <div className="border-t border-rl-border pt-4 flex flex-col gap-2 text-left">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">已获得</div>
      <RewardOwnedBuildTabs
        ownedSkills={ownedSkills}
        skillAccumulation={skillAccumulation}
        handTypeUpgrades={handTypeUpgrades}
        attributeCards={ownedAttributeCards}
      />
    </div>
  );
}

const STEP_TITLE: Record<RewardState['step'], string> = {
  skill:     '选择技能',
  upgrade:   '选择升级',
  attribute: '选择超级牌',
};

export function RewardModal({
  reward, stageIndex,
  ownedSkills = [],
  skillAccumulation = {},
  handTypeUpgrades = {},
  ownedAttributeCards = [],
  onChooseSkill,
  onChooseUpgrade,
  onChooseAttributeCard,
}: Props) {
  const isOpening = reward.isOpeningReward;
  const passedLabel = isOpening ? '开局奖励' : `第 ${stageIndex + 1} 关通过！`;

  // 让“同一次过关的连续两次三选一”也能重新触发面板弹入动效
  const panelKey = React.useMemo(() => {
    if (reward.step === 'skill') {
      const ids = reward.skillOptions.map(s => s.id).join(',');
      return `skill:${stageIndex}:${ids}`;
    }
    if (reward.step === 'upgrade') {
      const sig = reward.upgradeOptions
        .map(o => `${o.handName}:${o.currentLevel}`)
        .join(',');
      return `upgrade:${stageIndex}:${sig}`;
    }
    const ids = reward.attributeOptions.map(c => c.id).join(',');
    return `attribute:${stageIndex}:${ids}`;
  }, [reward, stageIndex]);

  // ── 技能三选一 ──────────────────────────────────────────────────
  if (reward.step === 'skill') {
    return (
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
        <div key={panelKey} className="animate-modal-pop-in relative bg-rl-surface border border-rl-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
          <Header passedLabel={passedLabel} title={STEP_TITLE.skill} />

          <div className="flex flex-col gap-3">
            {reward.skillOptions.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onClick={() => onChooseSkill(skill)}
                superCardCount={ownedAttributeCards.length}
              />
            ))}
            {reward.skillOptions.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">技能池已全部获取！</p>
            )}
          </div>

          <ObtainedBuildSection
            ownedSkills={ownedSkills}
            skillAccumulation={skillAccumulation}
            handTypeUpgrades={handTypeUpgrades}
            ownedAttributeCards={ownedAttributeCards}
          />

        </div>
      </div>
    );
  }

  // ── 升级三选一 ──────────────────────────────────────────────────
  if (reward.step === 'upgrade') {
    return (
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
        <div key={panelKey} className="animate-modal-pop-in relative bg-rl-surface border border-rl-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
          <Header passedLabel={passedLabel} title={STEP_TITLE.upgrade} />

          <div className="flex flex-col gap-3">
            {reward.upgradeOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => onChooseUpgrade(opt)}
                className="bg-rl-bg border border-rl-border hover:border-rl-gold hover:bg-rl-gold/10 rounded-xl p-4 text-left transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white group-hover:text-rl-gold">
                    {opt.handName} 升级卡
                  </span>
                  <span className="text-xs text-gray-500">
                    Lv.{opt.currentLevel} → {opt.currentLevel + 1}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  {opt.baseScoreDelta > 0 && (
                    <span className="text-rl-green">+{opt.baseScoreDelta} 基础分</span>
                  )}
                  {opt.multiplierDelta > 0 && (
                    <span className="text-rl-blue">+{opt.multiplierDelta} 倍率</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <ObtainedBuildSection
            ownedSkills={ownedSkills}
            skillAccumulation={skillAccumulation}
            handTypeUpgrades={handTypeUpgrades}
            ownedAttributeCards={ownedAttributeCards}
          />
        </div>
      </div>
    );
  }

  // ── 超级牌三选一 ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
      <div key={panelKey} className="animate-modal-pop-in relative bg-rl-surface border border-rl-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <Header passedLabel={passedLabel} title={STEP_TITLE.attribute} />

        <div className="flex justify-center gap-2 sm:gap-3 items-start">
          {reward.attributeOptions.map(card => (
            <AttrCardOption key={card.id} card={card} onSelect={() => onChooseAttributeCard(card)} />
          ))}
        </div>

        <ObtainedBuildSection
          ownedSkills={ownedSkills}
          skillAccumulation={skillAccumulation}
          handTypeUpgrades={handTypeUpgrades}
          ownedAttributeCards={ownedAttributeCards}
        />
      </div>
    </div>
  );
}

// ── 小组件 ──────────────────────────────────────────────────────
function Header({ passedLabel, title }: { passedLabel: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-gray-400 text-sm">{passedLabel}</p>
      <h2 className="text-white text-xl font-black mt-1">{title}</h2>
    </div>
  );
}

const QUALITY_LABEL: Record<string, string> = {
  green: '普通', blue: '稀有', purple: '史诗', gold: '传说', orange: '橙色', white: '白色', super: '超级',
};
const QUALITY_BG: Record<string, string> = {
  green: 'bg-green-600', blue: 'bg-blue-600', purple: 'bg-purple-600',
  gold: 'bg-yellow-600', white: 'bg-gray-600', orange: 'bg-orange-600', super: 'bg-pink-600',
};

/** 超级牌三选一专用：固定槽位宽高比，禁止 Card 默认 hover 上移（仅本界面） */
function AttrCardOption({ card, onSelect }: { card: CardType; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2 touch-manipulation rounded-lg p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-rl-border/60 bg-rl-bg/30 shadow-inner"
        style={{ aspectRatio: '2 / 3' }}
      >
        <Card
          card={card}
          isFlipped={true}
          className="absolute inset-0 h-full w-full min-h-0 max-w-none !translate-y-0 hover:!translate-y-0 active:!translate-y-0 transition-none"
          style={{ width: '100%', height: '100%', fontSize: '1rem' }}
        />
      </div>

      <span className={`text-[10px] text-white font-bold px-2 py-0.5 rounded-full ${QUALITY_BG[card.quality] ?? 'bg-gray-600'}`}>
        {QUALITY_LABEL[card.quality] ?? card.quality}
      </span>
    </button>
  );
}
