import { HandType } from '../shared/types/poker';
import { Card } from '../shared/types/poker';
import { SkillDef } from './skill';

export type RewardType = 'upgrade' | 'skill' | 'attribute';

export interface UpgradeOption {
  type: 'upgrade';
  handType: HandType;
  handName: string;
  currentLevel: number;
  baseScoreDelta: number;
  multiplierDelta: number;
}

export type RewardOption = UpgradeOption;

/** 奖励类型 */
export type RewardStep = 'skill' | 'upgrade' | 'attribute';

export interface RewardState {
  /** 当前正在展示的奖励步骤 */
  step: RewardStep;
  /** 技能三选一备选 */
  skillOptions: SkillDef[];
  /** 牌型升级三选一备选 */
  upgradeOptions: RewardOption[];
  /** 属性牌三选一备选（完整 Card 对象，当前步或后续步均可预生成） */
  attributeOptions: Card[];
  /**
   * 当前步之后还有哪些步骤。
   * 完成当前步时：若非空则切到下一步；若为空则推进到下一关。
   */
  pendingSteps?: RewardStep[];
  /**
   * 是否为开局奖励（Run 开始前的首次技能三选一）。
   * 开局奖励选完后不推进关卡，只记录技能并开始第一关。
   */
  isOpeningReward?: boolean;
  /**
   * 是否处于精英/Boss 关后奖励上下文。
   * 切换到后续技能步骤时，使用此标志生成带精英品质权重的新技能选项。
   */
  afterElite?: boolean;
}
