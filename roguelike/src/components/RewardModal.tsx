import React from 'react';
import { UpgradeOption, RewardState } from '../types/reward';
import { SkillDef } from '../types/skill';
import { Card as CardType } from '../shared/types/poker';
import { Card } from '../shared/components/Card';
import SkillCard from './SkillCard';

interface Props {
  reward: RewardState;
  stageIndex: number;
  onChooseSkill:        (skill: SkillDef) => void;
  onChooseUpgrade:      (option: UpgradeOption) => void;
  onChooseAttributeCard:(card: CardType) => void;
}

const STEP_TITLE: Record<RewardState['step'], string> = {
  skill:     '选择技能',
  upgrade:   '选择升级',
  attribute: '选择超级牌',
};

export function RewardModal({
  reward, stageIndex,
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
              <SkillCard key={skill.id} skill={skill} onClick={() => onChooseSkill(skill)} />
            ))}
            {reward.skillOptions.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">技能池已全部获取！</p>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ── 升级三选一 ──────────────────────────────────────────────────
  if (reward.step === 'upgrade') {
    return (
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
        <div key={panelKey} className="animate-modal-pop-in relative bg-rl-surface border border-rl-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">
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
        </div>
      </div>
    );
  }

  // ── 超级牌三选一 ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
      <div key={panelKey} className="animate-modal-pop-in relative bg-rl-surface border border-rl-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">
        <Header passedLabel={passedLabel} title={STEP_TITLE.attribute} />

        <div className="flex justify-center gap-3">
          {reward.attributeOptions.map(card => (
            <AttrCardOption key={card.id} card={card} onSelect={() => onChooseAttributeCard(card)} />
          ))}
        </div>
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

function AttrCardOption({ card, onSelect }: { card: CardType; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-2 group focus:outline-none"
    >
      <div className="transition-transform duration-200 group-hover:-translate-y-1 group-active:scale-95">
        <Card
          card={card}
          isFlipped={true}
          style={{ width: '4.5rem', aspectRatio: '2/3', fontSize: '1rem' }}
        />
      </div>

      <span className={`text-[10px] text-white font-bold px-2 py-0.5 rounded-full ${QUALITY_BG[card.quality] ?? 'bg-gray-600'}`}>
        {QUALITY_LABEL[card.quality] ?? card.quality}
      </span>
    </button>
  );
}
