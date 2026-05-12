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
import { Card as CardType } from '../shared/types/poker';
import { Card } from '../shared/components/Card';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';
import { UpgradePlayingCard } from './UpgradePlayingCard';
import { clampSkillSellExtraDiamonds } from '../engine/runEngine';
import type { HandTypeUpgradeMap } from '../types/run';
import { IaaPlayMark } from './IaaPlayMark';

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
  /** 当前关卡 stageIndex（保留给商店上下文使用） */
  stageIndex?: number;
  /** 本局 IAA 补钻是否已达到共享上限 */
  iaaClaimDiamondsUsed?: boolean;
  onChooseSkill:        (skill: SkillDef, enhancement: SkillEnhancement, price: number) => void;
  onSellSkill:          (skillId: string) => void;
  onChooseUpgrade:      (option: UpgradeOption) => void;
  onChooseAttributeCard:(card: CardType) => void;
  onRefreshWithDiamonds: () => void;
  onIaaRefreshReward?:  () => void;
  onIaaClaimDiamonds?:  () => void;
  onIaaBuyItem?:        () => void;
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

type OwnedTabKey = 'skills' | 'pool';

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
  iaaClaimDiamondsUsed = false,
  onChooseSkill,
  onSellSkill,
  onChooseUpgrade,
  onChooseAttributeCard,
  onRefreshWithDiamonds,
  onIaaRefreshReward,
  onIaaClaimDiamonds,
  onIaaBuyItem,
  onContinue,
}: Props) {
  const [skillDetail, setSkillDetail] = useState<{
    skill: SkillDef;
    enhancement: SkillEnhancement;
  } | null>(null);
  const [ownedTab, setOwnedTab] = useState<OwnedTabKey>('skills');
  const [refreshOptionsOpen, setRefreshOptionsOpen] = useState(false);

  const refreshCost = Math.max(0, reward.diamondRefreshCost ?? 5);
  const canRefresh = !reward.refreshUsedWithDiamonds && diamonds >= refreshCost;
  const canRefreshWithMark = !!onIaaRefreshReward && !reward.refreshUsedWithIaa;
  const canOpenRefreshOptions = canRefresh || canRefreshWithMark;
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
        <div className="grid shrink-0 grid-cols-[minmax(2.5rem,1fr)_auto_minmax(2.5rem,1fr)] items-center gap-1 px-4">
          {/* 左：钻石余额 + IAA 补钻小按钮（unified 商店专属） */}
          <div className="justify-self-start flex items-center gap-1.5">
            <span className="text-[16px] font-bold tabular-nums text-rl-gold">💎{diamonds}</span>
            {reward.step === 'unified' && onIaaClaimDiamonds && !iaaClaimDiamondsUsed && (
              <button
                type="button"
                onClick={onIaaClaimDiamonds}
                title="看广告获得 +💎3"
                className="flex items-center gap-0.5 rounded-[5px] border border-rl-gold/50 bg-rl-gold/10 px-1.5 py-0.5 text-[11px] font-bold text-rl-gold active:bg-rl-gold/20"
              >
                <IaaPlayMark />
                <span>+💎3</span>
              </button>
            )}
          </div>
          <Header title={STEP_TITLE[reward.step]} />
          <span className="min-w-0" aria-hidden />
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {reward.step === 'unified' ? (
          <div className="mx-auto grid w-max max-w-full grid-cols-[repeat(3,5.175rem)] grid-rows-2 justify-center gap-x-3 gap-y-4">
            {buildUnifiedShopSlots(reward).map((slot, slotGlobalIdx) => {
              const isIaaSlot = reward.iaaItemSlotIndex === slotGlobalIdx;
              if (slot.kind === 'skill') {
                const opt = slot.opt;
                const slotFull = ownedSkills.length >= skillSlotsAfterBuying(opt.enhancement);
                const disabled = diamonds < opt.price || slotFull || opt.purchased;
                return (
                  <div key={`skill-${opt.skill.id}`} className="flex w-full flex-col items-center gap-1">
                    <div className="relative w-full">
                      <button
                        type="button"
                        onClick={() => setSkillDetail({ skill: opt.skill, enhancement: opt.enhancement })}
                        className={clsx(
                          'block relative w-full touch-manipulation rounded-[14px] p-0 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50',
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
                            accumulated={opt.skill.id === 'elite_unshackled' ? 3 : skillAccumulation[opt.skill.id]}
                            superCardCount={ownedAttributeCards.length}
                            runDiamonds={diamonds}
                            acquiredSkillIds={acquiredSkillIdsForDetail}
                            className="absolute inset-0 h-full w-full min-h-0 !max-w-none hover:!translate-y-0 active:!scale-100"
                          />
                        </div>
                      </button>
                    </div>
                    {isIaaSlot && !opt.purchased ? (
                      <button
                        type="button"
                        onClick={onIaaBuyItem}
                        className="h-9 w-full flex items-center justify-center gap-1 bg-rl-gold text-black text-[16px] font-bold rounded-lg leading-none"
                      >
                        <IaaPlayMark />
                        <span>购买</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChooseSkill(opt.skill, opt.enhancement, opt.price)}
                        className="h-9 w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg leading-none"
                      >
                        {opt.purchased ? '已购' : `💎${opt.price}`}
                      </button>
                    )}
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
                    {isIaaSlot && !opt.purchased ? (
                      <button
                        type="button"
                        onClick={onIaaBuyItem}
                        className="h-9 w-full flex items-center justify-center gap-1 bg-rl-gold text-black text-[16px] font-bold rounded-lg leading-none"
                      >
                        <IaaPlayMark />
                        <span>购买</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChooseUpgrade(opt.option)}
                        className="h-9 w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg leading-none"
                      >
                        {opt.purchased ? '已购' : `💎${opt.price}`}
                      </button>
                    )}
                  </div>
                );
              }
              const opt = slot.opt;
              return (
                <div key={`attr-${opt.card.id}`} className="flex w-full flex-col items-center gap-1">
                  <div className="relative w-full">
                    <AttrCardOption
                      card={opt.card}
                      onSelect={() => {
                        if (!isIaaSlot && diamonds >= opt.price && !opt.purchased) onChooseAttributeCard(opt.card);
                      }}
                    />
                  </div>
                  {isIaaSlot && !opt.purchased ? (
                    <button
                      type="button"
                      onClick={onIaaBuyItem}
                      className="h-9 w-full flex items-center justify-center gap-1 bg-rl-gold text-black text-[16px] font-bold rounded-lg leading-none"
                    >
                      <IaaPlayMark />
                      <span>购买</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (diamonds >= opt.price && !opt.purchased) onChooseAttributeCard(opt.card);
                      }}
                      disabled={diamonds < opt.price || !!opt.purchased}
                      className="h-9 w-full bg-rl-gold disabled:bg-gray-700 disabled:text-gray-400 text-black text-[16px] font-bold rounded-lg leading-none"
                    >
                      {opt.purchased ? '已购' : `💎${opt.price}`}
                    </button>
                  )}
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
                    <div key={opt.skill.id} className="flex w-[5.175rem] shrink-0 flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSkillDetail({ skill: opt.skill, enhancement: opt.enhancement })}
                        className={clsx(
                          'block relative w-full touch-manipulation rounded-[14px] p-0 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50',
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
                          accumulated={opt.skill.id === 'elite_unshackled' ? 3 : skillAccumulation[opt.skill.id]}
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
                      className="flex w-[5.175rem] shrink-0 flex-col items-center gap-1"
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

        <div className="flex h-[185px] shrink-0 flex-col border-t border-rl-border bg-rl-surface">
          <div className="flex items-center justify-between px-4 pt-2">
            <div className="text-xs text-gray-400">已拥有技能 {ownedSkills.length}/{skillSlotCap}</div>
            <div className="inline-flex rounded-lg border border-rl-border bg-rl-bg/30 p-0.5">
              {([
                { key: 'skills', label: '技能' },
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
                          className="block relative w-full touch-manipulation rounded-[14px] p-0 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
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

            {ownedTab === 'pool' && (
              ownedAttributeCards.length > 0 ? (
                <div className="h-full overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                  <div className="flex flex-wrap justify-center gap-x-2 gap-y-2">
                    {ownedAttributeCards.map(card => (
                      <OwnedPoolAttributeCard key={card.id} card={card} />
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

        {/* 底部操作行：一个刷新入口，继续最大 */}
        <div className="flex shrink-0 gap-2 px-4 pt-2">
          {/* 刷新入口：点击后选择 💎 或播放标识刷新 */}
          <button
            type="button"
            onClick={() => setRefreshOptionsOpen(true)}
            disabled={!canOpenRefreshOptions}
            className="flex-1 bg-rl-blue disabled:bg-gray-700 disabled:text-gray-400 rounded-lg py-2 font-bold text-[13px]"
          >
            刷新
          </button>
          {/* 继续：最宽 */}
          <button
            type="button"
            onClick={onContinue}
            className="flex-[1.8] bg-rl-gold text-black rounded-lg py-2 font-bold text-[14px]"
          >
            继续
          </button>
        </div>
      </div>

      {refreshOptionsOpen && (
        <div
          role="dialog"
          aria-modal
          aria-label="选择刷新方式"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]"
          onClick={() => setRefreshOptionsOpen(false)}
        >
          <div
            className="w-full max-w-[390px] rounded-t-2xl border border-rl-border bg-rl-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-center text-sm font-bold text-gray-200">选择刷新方式</div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!canRefresh}
                onClick={() => {
                  setRefreshOptionsOpen(false);
                  onRefreshWithDiamonds();
                }}
                className="w-full rounded-xl bg-rl-blue py-3 text-[15px] font-black text-white disabled:bg-gray-700 disabled:text-gray-400"
              >
                刷新 💎{refreshCost}{reward.refreshUsedWithDiamonds ? '（已用）' : ''}
              </button>
              {onIaaRefreshReward && (
                <button
                  type="button"
                  disabled={!canRefreshWithMark}
                  onClick={() => {
                    setRefreshOptionsOpen(false);
                    onIaaRefreshReward();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rl-blue py-3 text-[15px] font-black text-white disabled:bg-gray-700 disabled:text-gray-400"
                >
                  <span>刷新</span>
                  <IaaPlayMark />
                  {reward.refreshUsedWithIaa && <span className="text-xs opacity-75">（已用）</span>}
                </button>
              )}
              <button
                type="button"
                onClick={() => setRefreshOptionsOpen(false)}
                className="w-full rounded-xl border border-rl-border bg-rl-bg/40 py-2.5 text-[14px] font-bold text-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

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
/** 商店超级牌槽宽（rem）；已拥有区展示为同样式 ×0.85 */
const SHOP_ATTR_CARD_WIDTH_REM = 5.175;

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

  const { cardWidthPx, marginLeftPx, rowJustify } = useMemo(() => {
    const rw = Math.max(0, rowWidth);
    const inner = Math.max(0, rw - (SELL_SLOT_COUNT - 1) * SELL_ROW_GAP_PX);
    const slot = inner / SELL_SLOT_COUNT;
    const n = skills.length;
    if (n === 0) {
      return { cardWidthPx: 0, marginLeftPx: (_i: number) => 0, rowJustify: 'center' as const };
    }
    if (n === 1) {
      return {
        cardWidthPx: Math.min(slot, rw),
        marginLeftPx: (_i: number) => 0,
        rowJustify: 'center' as const,
      };
    }
    if (n <= SELL_SLOT_COUNT) {
      return {
        cardWidthPx: slot,
        marginLeftPx: (i: number) => (i === 0 ? 0 : SELL_ROW_GAP_PX),
        rowJustify: 'center' as const,
      };
    }
    const footprint = SELL_SLOT_COUNT * slot + (SELL_SLOT_COUNT - 1) * SELL_ROW_GAP_PX;
    const stride = (footprint - slot) / (n - 1);
    const ml = stride - slot;
    return {
      cardWidthPx: slot,
      marginLeftPx: (i: number) => (i === 0 ? 0 : ml),
      rowJustify: 'start' as const,
    };
  }, [rowWidth, skills.length]);

  if (skills.length === 0) {
    return <div className="w-full text-center text-xs text-gray-600 py-2">暂无技能可卖出</div>;
  }

  return (
    <div
      ref={rowRef}
      className={`flex w-full min-w-0 flex-nowrap items-end overflow-visible pb-1 ${
        rowJustify === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      {skills.map((skill, i) => {
        const enhancement = skillEnhancements[skill.id] ?? 'normal';
        return (
          <div
            key={skill.id}
            className="relative flex shrink-0 flex-col items-stretch gap-0.5 overflow-visible"
            style={{
              width: cardWidthPx > 0 ? cardWidthPx : undefined,
              marginLeft: marginLeftPx(i),
              zIndex: i,
            }}
          >
            <button
              type="button"
              onClick={() => onOpenDetail(skill, enhancement)}
              className="block relative w-full touch-manipulation rounded-[14px] p-0 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
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

/** 超级牌候选：2:3、边框壳 + Card 牌面（槽宽 `SHOP_ATTR_CARD_WIDTH_REM`） */
function AttrCardOption({ card, onSelect }: { card: CardType; onSelect: () => void }) {
  const cornerClass =
    card.quality === 'super' && !card.isJoker ? 'rounded-2xl' : 'rounded-[14px]';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex shrink-0 flex-col items-center gap-1 touch-manipulation rounded-lg p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
      style={{ width: `${SHOP_ATTR_CARD_WIDTH_REM}rem` }}
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

/** 已拥有超级牌：与 `AttrCardOption` 同款轮廓，整体缩小 15%（仅展示） */
function OwnedPoolAttributeCard({ card }: { card: CardType }) {
  const cornerClass =
    card.quality === 'super' && !card.isJoker ? 'rounded-2xl' : 'rounded-[14px]';
  const wRem = SHOP_ATTR_CARD_WIDTH_REM * 0.85;
  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: `${wRem}rem` }}>
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
          isHeld={false}
          isScoring={false}
          onClick={() => {}}
          className="absolute inset-0 h-full w-full min-h-0 max-w-none cursor-default !translate-y-0 transition-none hover:!translate-y-0"
          style={{ width: '100%', height: '100%', fontSize: '0.85rem' }}
        />
      </div>
    </div>
  );
}
