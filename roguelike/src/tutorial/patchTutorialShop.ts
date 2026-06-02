import { getSkillById } from '../engine/skillEngine';
import { RewardState, SkillShopOption } from '../types/reward';
import { TUTORIAL_SKILL_ID } from './tutorialConfig';

/** 引导首次关后商店：首格技能写死为 flat_mult，其余格保持 Roll 结果 */
export function patchTutorialFirstShop(reward: RewardState): RewardState {
  const skill = getSkillById(TUTORIAL_SKILL_ID);
  if (!skill || reward.skillOptions.length === 0) return reward;

  const template = reward.skillOptions[0];
  const forced: SkillShopOption = {
    skill,
    enhancement: 'normal',
    price: template.price,
    purchased: false,
  };

  return {
    ...reward,
    skillOptions: [forced, ...reward.skillOptions.slice(1)],
    refreshUsedWithDiamonds: true,
    refreshUsedWithIaa: true,
    iaaItemSlotIndex: -1,
  };
}
