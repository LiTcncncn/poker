import { getEffectiveSkillSlotCap } from '../engine/runEngine';
import type { RewardState } from '../types/reward';
import type { RunIaaState, RunState, StageIaaState } from '../types/run';

const IAA_DIAMOND_REFILL_LIMIT = 2;

export function getIaaDiamondRefillCount(iaa?: RunIaaState): number {
  if (!iaa) return 0;
  return iaa.diamondRefillCount ?? Math.floor((iaa.diamondsFromIaa ?? 0) / 3);
}

/** 关内 / 商店：IAA 补钻 +3 是否仍可用 */
export function canShowIaaDiamondRefill(run: RunState | null | undefined, iaa?: RunIaaState): boolean {
  if (!run || run.status !== 'running') return false;
  return getIaaDiamondRefillCount(iaa) < IAA_DIAMOND_REFILL_LIMIT;
}

/** 商店：IAA 刷新是否仍可用 */
export function canShowIaaRefreshReward(
  reward: RewardState | null | undefined,
  perStage?: StageIaaState,
): boolean {
  if (!reward || reward.step !== 'unified') return false;
  if (reward.refreshUsedWithIaa || perStage?.iaaRefreshUsed) return false;
  return true;
}

/** 商店：初始 Roll 的 IAA 购商品是否仍应展示 */
export function canShowIaaShopBuy(
  reward: RewardState | null | undefined,
  run: RunState | null | undefined,
  perStage?: StageIaaState,
): boolean {
  if (!reward || !run || reward.step !== 'unified') return false;
  if (perStage?.shopIaaPurchaseUsed) return false;
  const slotIdx = reward.iaaItemSlotIndex;
  if (slotIdx === undefined || slotIdx < 0) return false;

  const numSkills = reward.skillOptions.length;
  const numUpgrades = reward.upgradeOptions.length;

  if (slotIdx < numSkills) {
    const opt = reward.skillOptions[slotIdx];
    if (opt.purchased || run.acquiredSkillIds.includes(opt.skill.id)) return false;
    const cap = getEffectiveSkillSlotCap(run) + (opt.enhancement === 'black' ? 1 : 0);
    return run.acquiredSkillIds.length < cap;
  }
  if (slotIdx < numSkills + numUpgrades) {
    return !reward.upgradeOptions[slotIdx - numSkills]?.purchased;
  }
  const atIdx = slotIdx - numSkills - numUpgrades;
  const opt = reward.attributeOptions[atIdx];
  return !!opt && !opt.purchased;
}
