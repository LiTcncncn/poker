import { HandType } from '../shared/types/poker';
import { Card } from '../shared/types/poker';
import { SkillDef, SkillEnhancement } from './skill';

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

export interface SkillShopOption {
  skill: SkillDef;
  enhancement: SkillEnhancement;
  price: number;
  purchased?: boolean;
}

export interface UpgradeShopOption {
  option: UpgradeOption;
  price: number;
  purchased?: boolean;
}

export interface AttributeShopOption {
  card: Card;
  price: number;
  purchased?: boolean;
}

/** 奖励类型（`unified` = 关后统一 6 卡商店） */
export type RewardStep = 'skill' | 'upgrade' | 'attribute' | 'unified';

export interface RewardState {
  /** 当前正在展示的奖励步骤 */
  step: RewardStep;
  /** 技能商店候选 */
  skillOptions: SkillShopOption[];
  /** 升级商店候选 */
  upgradeOptions: UpgradeShopOption[];
  /** 超级牌商店候选 */
  attributeOptions: AttributeShopOption[];
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
  /**
   * 统一商店：用于刷新与技能品质池的 **关卡序号 k（从 1 计）**（`k % 3 === 0` 时用精英技能模板）。
   */
  shopStageK?: number;
  /** 每次奖励阶段仅允许 1 次钻石刷新 */
  refreshUsedWithDiamonds?: boolean;
  /** 当前刷新价格（可被技能修正） */
  diamondRefreshCost?: number;
  /** 每次奖励阶段仅允许 1 次 IAA 刷新 */
  refreshUsedWithIaa?: boolean;
  /**
   * 初始 Roll 中的 IAA 商品槽索引（0-based，对应 buildUnifiedShopSlots 顺序）。
   * -1 = 本次无 IAA 商品（刷新后均为 -1）；undefined = 未初始化。
   */
  iaaItemSlotIndex?: number;

  // ── 黑边技能定向保底（用于 store 在离开商店时更新 pity） ──────────
  /** 本关商店打开时的“已拥有黑边技能数”（用于判断是否购买了黑边） */
  blackEdgeOwnedAtOpen?: number;
  /** 本关商店（含刷新后）是否出现过黑边技能候选 */
  blackEdgeSeenThisShop?: boolean;
  /** 本关商店打开时对应的 gateN（满足 gateK(N) 且 ownedBlack<=N 时写入；否则为 null） */
  blackEdgeGateN?: number | null;
}
