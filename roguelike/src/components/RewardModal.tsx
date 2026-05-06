import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  AttributeShopOption,
  RewardState,
  SkillShopOption,
  UpgradeOption,
  UpgradeShopOption,
} from '../types/reward';
import { SkillDef, SkillEnhancement } from '../types/skill';
import { Card as CardType, HandType } from '../shared/types/poker';
import { Card } from '../shared/components/Card';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';
import { UpgradePlayingCard } from './UpgradePlayingCard';
import { clampSkillSellExtraDiamonds } from '../engine/runEngine';
import { getHandTypeStats, HAND_NAMES } from '../engine/handEngine';
import type { HandTypeUpgradeMap } from '../types/run';

interface Props {
  reward: RewardState;
  /** 选择技能时展示：已拥有技能 / 牌型 LV / 超级牌（与主界面标签容器风格一致） */
  ownedSkills?: SkillDef[];
  ownedSkillEnhancements?: Record<string, SkillEnhancement>;
  skillAccumulation?: Record<string, number>;
  /** 卖方市场等：按技能 id 叠加的卖出回收价加成 */
  skillSellBonus?: Record<string, number>;
  ownedAttributeCards?: CardType[];
  handTypeUpgrades: HandTypeUpgradeMap;
  diamonds: number;
  skillSlotCap: number;
  onChooseSkill:        (skill: SkillDef, enhancement: SkillEnhancement, price: number) => void;
  onSellSkill:          (skillId: string) => void;
  onChooseUpgrade:      (option: UpgradeOption) => void;
  onChooseAttributeCard:(card: CardType) => void;
  onRefreshWithDiamonds: () => void;
  onContinue:           () => void;
}

type UnifiedShopSlot =
  | { kind: 'skill'; opt: SkillShopOption }
  | { kind: 'upgrade'; opt: UpgradeShopOption; slotKey: string }
  | { kind: 'attr'; opt: AttributeShopOption };

function buildUnifiedShopSlots(reward: RewardState): UnifiedShopSlot[] {
  return [
    ...reward.skillOptions.map(opt => ({ kind: 'skill' as const, opt })),
    ...reward.upgradeOptions.map((opt, i) => ({
      kind: 'upgrade' as const,
      opt,
      slotKey: `${opt.option.handType}-${opt.option.currentLevel}-${i}`,
    })),
    ...reward.attributeOptions.map(opt => ({ kind: 'attr' as const, opt })),
  ];
}

const STEP_TITLE: Record<RewardState['step'], string> = {
  skill:     '技能商店',
  upgrade:   '升级商店',
  attribute: '超级牌商店',
  unified:   '商店',
};

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

const ODDS_DISPLAY_ORDER: HandType[] = (() => {
  const half = ORDERED_HAND_TYPES.length / 2;
  const left = ORDERED_HAND_TYPES.slice(0, half);
  const right = ORDERED_HAND_TYPES.slice(half);
  return left.flatMap((ht, i) => [ht, right[i]]);
})();

type OwnedTabKey = 'skills' | 'odds' | 'pool';

export function RewardModal({
  reward,
  ownedSkills = [],
  ownedSkillEnhancements = {},
  skillAccumulation = {},
  skillSellBonus = {},
  ownedAttributeCards = [],
  handTypeUpgrades,
  diamonds,
  skillSlotCap,
  onChooseSkill,
  onSellSkill,
  onChooseUpgrade,
  onChooseAttributeCard,
  onRefreshWithDiamonds,
  onContinue,
}: Props) {
  const [skillDetail, setSkillDetail] = useState<{
    skill: SkillDef;
    enhancement: SkillEnhancement;
  } | null>(null);
  const [ownedTab, setOwnedTab] = useState<OwnedTabKey>('skills');

  const refreshCost = Math.max(0, reward.diamondRefreshCost ?? 5);
  const canRefresh = !reward.refreshUsedWithDiamonds && diamonds >= refreshCost;
  const acquiredSkillIdsForDetail = useMemo(() => ownedSkills.map((s) => s.id), [ownedSkills]);
  /** `skillSlotCap` 为当前有效上限（基础槽 + 已持有黑边数）；购入黑边候选时上限再 +1 */
  function skillSlotsAfterBuying(enhancement: SkillEnhancement): number {
    return skillSlotCap + (enhancement === 'black' ? 1 : 0);
  }

  function calcSellPrice(skill: SkillDef): number {
    const qualityVal: Record<SkillDef['quality'], number> = { green: 1, blue: 2, purple: 3 };
    const enhancementVal: Record<SkillEnhancement, number> = { normal: 0, flash: 1, gold: 2, laser: 3, black: 2 };
    const enhancement = ownedSkillEnhancements[skill.id] ?? 'normal';
    const extra = clampSkillSellExtraDiamonds(skillSellBonus[skill.id]);
    return qualityVal[skill.quality] + enhancementVal[enhancement] + extra;
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in justify-center bg-slate-950/88 backdrop-blur-md">
      <div className="animate-modal-pop-in relative flex h-[100dvh] max-h-[100dvh] w-full max-w-[390px] flex-col overflow-hidden bg-rl-surface border-x border-rl-border/80 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex shrink-0 flex-col gap-3 px-4">
          <Header title={STEP_TITLE[reward.step]} />
          <div className="text-[16px] font-bold text-gray-200">
            当前拥有：<span className="text-[16px] font-bold text-rl-gold">💎{diamonds}</span>
          </div>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {reward.step === 'unified' ? (
          <div className="mx-auto grid w-max max-w-full grid-cols-[repeat(3,4.5rem)] grid-rows-2 justify-center gap-x-3 gap-y-4">
            {buildUnifiedShopSlots(reward).map(slot => {
              if (slot.kind === 'skill') {
                const opt = slot.opt;
                const slotFull = ownedSkills.length >= skillSlotsAfterBuying(opt.enhancement);
                const disabled = diamonds < opt.price || slotFull || opt.purchased;
                return (
                  <div key={`skill-${opt.skill.id}`} className="flex w-full flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSkillDetail({ skill: opt.skill, enhancement: opt.enhancement })}
                      className={clsx(
                        'relative w-full touch-manipulation rounded-[14px] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50',
                        opt.purchased && 'opacity-55',
                      )}
                      aria-label={`查看 ${opt.skill.name} 详情`}
                    >
                      <div
                        className="relative w-full overflow-visible rounded-[14px] border border-rl-border/50 bg-rl-bg/20 shadow-inner"
                        style={{ aspectRatio: '2 / 3' }}
                      >
                        <SkillPlayingCard
                          skill={opt.skill}
                          enhancement={opt.enhancement}
                          accumulated={skillAccumulation[opt.skill.id]}
                          superCardCount={ownedAttributeCards.length}
                          runDiamonds={diamonds}
                          acquiredSkillIds={acquiredSkillIdsForDetail}
                          className="absolute inset-0 h-full w-full min-h-0 !max-w-none hover:!translate-y-0 active:!scale-100"
                        />
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChooseSkill(opt.skill, opt.enhancement, opt.price)}
                      className="w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg py-1.5"
                    >
                      {opt.purchased ? '已购' : `💎${opt.price}`}
                    </button>
                  </div>
                );
              }
              if (slot.kind === 'upgrade') {
                const opt = slot.opt;
                const disabled = diamonds < opt.price || !!opt.purchased;
                return (
                  <div key={`up-${slot.slotKey}`} className="flex w-full flex-col items-center gap-1">
                    <div className={clsx('relative w-full rounded-[14px]', opt.purchased && 'opacity-55')}>
                      <div
                        className="relative w-full overflow-visible rounded-[14px] border border-rl-border/50 bg-rl-bg/20 shadow-inner"
                        style={{ aspectRatio: '2 / 3' }}
                      >
                        <UpgradePlayingCard
                          option={opt.option}
                          className="absolute inset-0 h-full w-full min-h-0 !max-w-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChooseUpgrade(opt.option)}
                      className="w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg py-1.5"
                    >
                      {opt.purchased ? '已购' : `💎${opt.price}`}
                    </button>
                  </div>
                );
              }
              const opt = slot.opt;
              return (
                <div key={`attr-${opt.card.id}`} className="flex w-full flex-col items-center gap-1">
                  <AttrCardOption
                    card={opt.card}
                    onSelect={() => {
                      if (diamonds >= opt.price && !opt.purchased) onChooseAttributeCard(opt.card);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (diamonds >= opt.price && !opt.purchased) onChooseAttributeCard(opt.card);
                    }}
                    disabled={diamonds < opt.price || !!opt.purchased}
                    className="w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg py-1.5"
                  >
                    {opt.purchased ? '已购' : `💎${opt.price}`}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {reward.step === 'skill' && (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-3">
                {reward.skillOptions.map(opt => {
                  const slotFull = ownedSkills.length >= skillSlotsAfterBuying(opt.enhancement);
                  const disabled = diamonds < opt.price || slotFull || opt.purchased;
                  return (
                    <div key={opt.skill.id} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSkillDetail({ skill: opt.skill, enhancement: opt.enhancement })}
                        className={clsx(
                          'relative w-full touch-manipulation rounded-[14px] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50',
                          opt.purchased && 'opacity-55',
                        )}
                        aria-label={`查看 ${opt.skill.name} 详情`}
                      >
                        <div
                          className="relative w-full overflow-visible rounded-[14px] border border-rl-border/50 bg-rl-bg/20 shadow-inner"
                          style={{ aspectRatio: '2 / 3' }}
                        >
                          <SkillPlayingCard
                            skill={opt.skill}
                            enhancement={opt.enhancement}
                            accumulated={skillAccumulation[opt.skill.id]}
                            superCardCount={ownedAttributeCards.length}
                            runDiamonds={diamonds}
                            acquiredSkillIds={acquiredSkillIdsForDetail}
                            className="absolute inset-0 h-full w-full min-h-0 !max-w-none hover:!translate-y-0 active:!scale-100"
                          />
                        </div>
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChooseSkill(opt.skill, opt.enhancement, opt.price)}
                        className="w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg py-1.5"
                      >
                        {opt.purchased ? '已购' : `💎${opt.price}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {reward.step === 'upgrade' && (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-3">
                {reward.upgradeOptions.map((opt, i) => {
                  const disabled = diamonds < opt.price || !!opt.purchased;
                  return (
                    <div
                      key={`${opt.option.handType}-${opt.option.currentLevel}-${i}`}
                      className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1"
                    >
                      <div className={clsx('relative w-full rounded-[14px]', opt.purchased && 'opacity-55')}>
                        <div
                          className="relative w-full overflow-visible rounded-[14px] border border-rl-border/50 bg-rl-bg/20 shadow-inner"
                          style={{ aspectRatio: '2 / 3' }}
                        >
                          <UpgradePlayingCard
                            option={opt.option}
                            className="absolute inset-0 h-full w-full min-h-0 !max-w-none"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChooseUpgrade(opt.option)}
                        className="w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg py-1.5"
                      >
                        {opt.purchased ? '已购' : `💎${opt.price}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {reward.step === 'attribute' && (
              <div className="flex justify-center gap-2 items-start">
                {reward.attributeOptions.map(opt => (
                  <div key={opt.card.id} className="flex flex-col items-center gap-1">
                    <AttrCardOption card={opt.card} onSelect={() => {
                      if (diamonds >= opt.price && !opt.purchased) onChooseAttributeCard(opt.card);
                    }} />
                    <button
                      type="button"
                      onClick={() => {
                        if (diamonds >= opt.price && !opt.purchased) onChooseAttributeCard(opt.card);
                      }}
                      disabled={diamonds < opt.price || !!opt.purchased}
                      className="w-16 bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg py-1.5"
                    >
                      {opt.purchased ? '已购' : `💎${opt.price}`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </div>

        <div className="flex h-[12.5rem] shrink-0 flex-col border-t border-rl-border bg-rl-surface">
          <div className="flex items-center justify-between px-4 pt-2">
            <div className="text-xs text-gray-400">已拥有技能 {ownedSkills.length}/{skillSlotCap}</div>
            <div className="inline-flex rounded-lg border border-rl-border bg-rl-bg/30 p-0.5">
              {([
                { key: 'skills', label: '技能' },
                { key: 'odds', label: '赔率' },
                { key: 'pool', label: '超级牌' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOwnedTab(key)}
                  className={clsx(
                    'rounded-md px-2 py-1 text-[11px] font-bold transition-colors',
                    ownedTab === key
                      ? 'bg-rl-gold text-black'
                      : 'text-gray-400 hover:text-gray-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 px-4 pb-2 pt-1">
            {ownedTab === 'skills' && (
              reward.step === 'unified' ? (
                <div className="h-full overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch]">
                  <OwnedSkillsSellStrip
                    skills={ownedSkills}
                    skillEnhancements={ownedSkillEnhancements}
                    skillAccumulation={skillAccumulation}
                    superCardCount={ownedAttributeCards.length}
                    runDiamonds={diamonds}
                    acquiredSkillIds={acquiredSkillIdsForDetail}
                    calcSellPrice={calcSellPrice}
                    onSellSkill={onSellSkill}
                    onOpenDetail={(skill, enhancement) => setSkillDetail({ skill, enhancement })}
                  />
                </div>
              ) : (
                <div className="flex h-full flex-wrap content-start justify-center gap-x-3 gap-y-4 overflow-x-auto pb-1">
                  {ownedSkills.map(skill => {
                    const enhancement = ownedSkillEnhancements[skill.id] ?? 'normal';
                    return (
                      <div key={skill.id} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSkillDetail({ skill, enhancement })}
                          className="relative w-full touch-manipulation rounded-[14px] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
                          aria-label={`查看 ${skill.name} 详情`}
                        >
                          <div
                            className="relative w-full overflow-visible rounded-[14px] ring-2 ring-rl-gold/35 ring-offset-2 ring-offset-rl-surface"
                            style={{ aspectRatio: '2 / 3' }}
                          >
                            <SkillPlayingCard
                              skill={skill}
                              enhancement={enhancement}
                              accumulated={skillAccumulation[skill.id]}
                              superCardCount={ownedAttributeCards.length}
                              runDiamonds={diamonds}
                              acquiredSkillIds={acquiredSkillIdsForDetail}
                              className="absolute inset-0 h-full w-full min-h-0 !max-w-none hover:!translate-y-0 active:!scale-100"
                            />
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const sellPrice = calcSellPrice(skill);
                            const ok = window.confirm(`确认卖出「${skill.name}」吗？将返还 💎${sellPrice}`);
                            if (ok) onSellSkill(skill.id);
                          }}
                          className="w-full rounded border border-gray-700 bg-gray-800 py-1.5 text-[10px] text-gray-300 hover:border-rl-gold"
                        >
                          卖出 +<span className="text-[12px] font-bold tabular-nums">💎{calcSellPrice(skill)}</span>
                        </button>
                      </div>
                    );
                  })}
                  {ownedSkills.length === 0 && (
                    <div className="flex w-full items-center justify-center py-6 text-center text-xs text-gray-600">
                      暂无技能可卖出
                    </div>
                  )}
                </div>
              )
            )}

            {ownedTab === 'odds' && (
              <div className="h-full overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                <div className="grid grid-cols-2 gap-2">
                  {ODDS_DISPLAY_ORDER.map(ht => {
                    const stats = getHandTypeStats(ht, handTypeUpgrades);
                    const level = handTypeUpgrades[ht] ?? 1;
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
                        <div className="grid grid-cols-[1fr_2.2rem_2.6rem_2rem] items-center text-[10px] leading-4 whitespace-nowrap">
                          <span className={`font-bold truncate ${upgraded ? 'text-rl-gold' : 'text-gray-300'}`}>
                            {HAND_NAMES[ht]}
                          </span>
                          <span className={`text-center font-bold tabular-nums ${upgraded ? 'text-rl-gold' : 'text-gray-400'}`}>
                            {level}
                          </span>
                          <span className="text-right text-yellow-300 font-mono tabular-nums">
                            ${stats.baseScore}
                          </span>
                          <span className={`text-right font-mono font-black tabular-nums ${upgraded ? 'text-rl-gold' : 'text-red-400'}`}>
                            {stats.multiplier}x
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {ownedTab === 'pool' && (
              ownedAttributeCards.length > 0 ? (
                <div className="h-full overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                  <div className="grid grid-cols-5 gap-2">
                    {ownedAttributeCards.map(card => (
                      <Card
                        key={card.id}
                        card={card}
                        isFlipped={true}
                        isHeld={false}
                        isScoring={false}
                        onClick={() => {}}
                        style={{ width: '3.1rem', aspectRatio: '2/3' }}
                        className="cursor-default hover:!translate-y-0"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-gray-600">
                  暂无超级牌 · 过关后选择
                </div>
              )
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={onRefreshWithDiamonds}
            disabled={!canRefresh}
            className="flex-1 bg-rl-blue disabled:bg-gray-700 disabled:text-gray-400 rounded-lg py-2 font-bold"
          >
            刷新 💎{refreshCost} {reward.refreshUsedWithDiamonds ? '(本阶段已用)' : ''}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 bg-rl-gold text-black rounded-lg py-2 font-bold"
          >
            继续
          </button>
        </div>
      </div>

      {skillDetail && (
        <SkillPlayingCardDetailModal
          skill={skillDetail.skill}
          enhancement={skillDetail.enhancement}
          accumulated={skillAccumulation[skillDetail.skill.id]}
          superCardCount={ownedAttributeCards.length}
          runDiamonds={diamonds}
          acquiredSkillIds={acquiredSkillIdsForDetail}
          onClose={() => setSkillDetail(null)}
        />
      )}
    </div>
  );
}

// ── 小组件 ──────────────────────────────────────────────────────
const SELL_ROW_GAP_PX = 4;
const SELL_SLOT_COUNT = 5;

function OwnedSkillsSellStrip({
  skills,
  skillEnhancements,
  skillAccumulation,
  superCardCount,
  runDiamonds,
  acquiredSkillIds,
  calcSellPrice,
  onSellSkill,
  onOpenDetail,
}: {
  skills: SkillDef[];
  skillEnhancements: Record<string, SkillEnhancement>;
  skillAccumulation: Record<string, number>;
  superCardCount: number;
  runDiamonds: number;
  acquiredSkillIds: string[];
  calcSellPrice: (skill: SkillDef) => number;
  onSellSkill: (id: string) => void;
  onOpenDetail: (skill: SkillDef, enhancement: SkillEnhancement) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.min(window.innerWidth, 384) - 48 : 300,
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
    const w = Math.max(0, rowWidth - (SELL_SLOT_COUNT - 1) * SELL_ROW_GAP_PX);
    const slot = w / SELL_SLOT_COUNT;
    const n = skills.length;
    if (n === 0) return { cardWidthPx: 0, marginLeftPx: (_i: number) => 0 };
    if (n <= SELL_SLOT_COUNT) {
      return {
        cardWidthPx: slot,
        marginLeftPx: (i: number) => (i === 0 ? 0 : SELL_ROW_GAP_PX),
      };
    }
    const footprint = SELL_SLOT_COUNT * slot + (SELL_SLOT_COUNT - 1) * SELL_ROW_GAP_PX;
    const stride = (footprint - slot) / (n - 1);
    const ml = stride - slot;
    return {
      cardWidthPx: slot,
      marginLeftPx: (i: number) => (i === 0 ? 0 : ml),
    };
  }, [rowWidth, skills.length]);

  if (skills.length === 0) {
    return <div className="w-full text-center text-xs text-gray-600 py-2">暂无技能可卖出</div>;
  }

  return (
    <div ref={rowRef} className="flex w-full min-w-0 flex-nowrap items-end justify-center pb-1">
      {skills.map((skill, i) => {
        const enhancement = skillEnhancements[skill.id] ?? 'normal';
        return (
          <div
            key={skill.id}
            className="relative flex shrink-0 flex-col items-stretch gap-0.5"
            style={{
              width: cardWidthPx > 0 ? cardWidthPx : undefined,
              marginLeft: marginLeftPx(i),
              zIndex: i,
            }}
          >
            <button
              type="button"
              onClick={() => onOpenDetail(skill, enhancement)}
              className="relative w-full touch-manipulation rounded-[14px] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
              aria-label={`查看 ${skill.name} 详情`}
            >
              <div
                className="relative w-full overflow-visible rounded-[14px] ring-2 ring-rl-gold/35 ring-offset-1 ring-offset-rl-surface"
                style={{ aspectRatio: '2 / 3' }}
              >
                <SkillPlayingCard
                  skill={skill}
                  enhancement={enhancement}
                  accumulated={skillAccumulation[skill.id]}
                  superCardCount={superCardCount}
                  runDiamonds={runDiamonds}
                  acquiredSkillIds={acquiredSkillIds}
                  className="absolute inset-0 h-full w-full min-h-0 !max-w-none hover:!translate-y-0 active:!scale-100"
                />
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                const sellPrice = calcSellPrice(skill);
                const ok = window.confirm(`确认卖出「${skill.name}」吗？将返还 💎${sellPrice}`);
                if (ok) onSellSkill(skill.id);
              }}
              className="w-full shrink-0 rounded border border-gray-700 bg-gray-800 py-1.5 text-[10px] font-semibold leading-tight text-gray-300 hover:border-rl-gold"
            >
              卖+<span className="text-[12px] font-bold tabular-nums">💎{calcSellPrice(skill)}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="text-center">
      <h2
        className={clsx(
          'font-black text-white tracking-tight',
          title === '商店' ? 'text-3xl' : 'text-xl',
        )}
      >
        {title}
      </h2>
    </div>
  );
}

/** 超级牌候选：与旧「超级牌商店」一致 — 4.5rem 宽、2:3、边框壳 + Card 牌面 */
function AttrCardOption({ card, onSelect }: { card: CardType; onSelect: () => void }) {
  const cornerClass =
    card.quality === 'super' && !card.isJoker ? 'rounded-2xl' : 'rounded-[14px]';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 touch-manipulation rounded-lg p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
    >
      <div
        className={clsx(
          'relative w-full overflow-visible border border-rl-border/60 bg-rl-bg/30 pb-px shadow-inner',
          cornerClass,
        )}
        style={{ aspectRatio: '2 / 3' }}
      >
        <Card
          card={card}
          isFlipped={true}
          className="absolute inset-0 h-full w-full min-h-0 max-w-none !translate-y-0 hover:!translate-y-0 active:!translate-y-0 transition-none"
          style={{ width: '100%', height: '100%', fontSize: '1rem' }}
        />
      </div>
    </button>
  );
}
