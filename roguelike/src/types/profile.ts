import { Suit, Rank, HandType } from '../shared/types/poker';

// ─── 牌堆规则 ─────────────────────────────────────────────────
/**
 * standard    - 标准 52 张
 * two_suits_hs - 花色归并：♦→♥、♣→♠（26 hearts + 26 spades，同点数各重复一张）
 * two_suits_sc - 花色归并：♥→♠、♦→♣（仅黑色花色）
 * two_suits_hd - 花色归并：♠→♥、♣→♦（仅红色花色）
 * a_to_10     - 去掉 J/Q/K，仅保留 A, 2-10
 * seven_to_a  - 去掉 2-6，仅保留 7-A
 * six_to_a    - 去掉 2-5，仅保留 6-A
 * odd_only    - 仅奇数点数：A,3,5,7,9,J,K
 * even_only   - 仅偶数点数：2,4,6,8,10,Q
 */
import type { SkillEnhancement } from './skill';

export type DeckRule =
  | 'standard'
  | 'two_suits_hs'
  | 'two_suits_sc'
  | 'two_suits_hd'
  | 'a_to_10'
  | 'seven_to_a'
  | 'six_to_a'
  | 'odd_only'
  | 'even_only';

// ─── 每局配置 ─────────────────────────────────────────────────
export interface RunConfig {
  /** 1-50 主线局编号；0 = 自由挑战（无限挑战模式） */
  runNo: number;
  difficulty: 'normal' | 'hard' | 'freeplay';
  /** 关卡数量：新手局 10，其余 20 */
  stageCount: number;
  /** 施加在每关基础目标分上的外层倍率（1.0 = 不变） */
  targetMultiplier: number;
  /** 开局钻石数（默认 3） */
  startingDiamonds: number;
  /** 全局禁 Joker（整局生效，与关内词缀区分） */
  banJokersGlobal: boolean;
  /** 全局 Hold 增量（整局每关生效，-2 到 +2） */
  holdDelta: number;
  /** 全局手数增量（整局每关生效，-2 到 +2） */
  handsDelta: number;
  /** 牌堆构成规则 */
  deckRule: DeckRule;
  /** 是否所有牌型从 Lv.2 起步 */
  allHandTypesLv2: boolean;
  /** 额外技能槽上限增量（0 或 +1） */
  skillSlotBonus: number;
  /** 本局可用的技能解锁顺序集合（如 [1, 2, 3]） */
  allowedSkillOrders: number[];
  /** 本局商店可 Roll 出的技能附加边（不含 normal）；缺省由局外进度决定 */
  allowedSkillEnhancements?: SkillEnhancement[];
  /** 商店技能仅 normal 边（与 allowedSkillEnhancements 互斥，第 43 局） */
  banSkillShopEdges: boolean;
  /** 商店刷新费用增量（如 +3） */
  shopRefreshCostDelta: number;
  /** 商店商品价格增量（如 +2） */
  shopPriceDelta: number;
  /** 每次商店牌型升级槽 +N（从属性/技能槽扣减，总数仍为 6） */
  shopUpgradeSlotBonus: number;
  /** 每次商店超级牌槽 +N（从升级/技能槽扣减，总数仍为 6） */
  shopAttributeSlotBonus: number;
  /** 通关基础钻石来源是否覆盖为 0（true = 覆盖） */
  stageBaseDiamondZero: boolean;
  /** Boss 关目标分外层倍率（叠在 targetMultiplier 之后，默认 1 = 不变） */
  bossTargetMultiplier: number;
  /** 整局：rank ≤ 该值的牌面分不计入（0 = 不启用；6 = 2–6 不计分） */
  runBannedRankMax: number;
  /** 整局：J/Q/K 牌面分不计入（牌型判定仍正常） */
  runBanFaceCardScore: boolean;
  /** 开局随机抽 N 个「禁牌型」词缀，禁牌型合并到每一关（0 = 不启用） */
  runBannedHandTypePickCount: number;
  /** 整局固定禁计分牌型（与 pickCount 合并去重） */
  runBannedHandTypes: HandType[];
  /** 仅精英/Boss 关禁计分牌型（与关内随机词缀叠加） */
  runEliteOnlyBannedHandTypes: HandType[];
  /** 仅精英/Boss 关手数增量（叠在 handsDelta 之后，0 = 不启用） */
  runEliteOnlyHandsDelta: number;
  /** 精英关通关基础 💎（0 = 默认 5；仅 isElite 关生效，Boss 同为精英关） */
  runEliteStageBaseDiamond: number;
  /** 每次商店随机 N 个商品售价 × premiumPriceMultiplier（0 = 不启用） */
  shopPremiumSlotCount: number;
  /** 非卖品溢价倍率（默认 5；与 shopPremiumFixedPrice 二选一） */
  shopPremiumPriceMultiplier: number;
  /** 随机溢价槽位固定售价（💎）；设置时优先于倍率 */
  shopPremiumFixedPrice: number;
}

// ─── 主线局定义 ───────────────────────────────────────────────
export interface MainlineRunDef {
  runNo: number;
  title: string;
  /** 普通模式配置 */
  normalConfig: Omit<RunConfig, 'runNo' | 'difficulty'>;
  /** 困难模式配置（在 normalConfig 之上叠加，由 hardFromNormal 生成） */
  hardConfig: Omit<RunConfig, 'runNo' | 'difficulty'>;
  /** 本局主题标签（显示在限制 chip 区域） */
  displayTags: string[];
  /** 困难模式在普通标签之外额外展示的芯片（RunEntry 困难 = displayTags + hardDisplayTags） */
  hardDisplayTags: string[];
}

// ─── 技能附加边解锁（通关局号 → 商店可 Roll 银/金/彩/黑边）────────
export type FrameId = 'default' | 'silver' | 'gold' | 'rainbow' | 'black';

export interface FrameDef {
  id: FrameId;
  label: string;
  /** 普通模式通关该局后，对应附加边进入商店池（见 `getAllowedSkillEnhancementsAfterNormalRun`） */
  unlockRunNo: number;
}

export const FRAME_DEFS: FrameDef[] = [
  { id: 'default', label: '默认',  unlockRunNo: 0  },
  { id: 'silver',  label: '银边',  unlockRunNo: 4  },
  { id: 'gold',    label: '金边',  unlockRunNo: 6  },
  { id: 'rainbow', label: '彩边',  unlockRunNo: 8  },
  { id: 'black',   label: '黑边',  unlockRunNo: 10 },
];

// ─── Profile（跨局进度） ───────────────────────────────────────
export interface RunClearRecord {
  clearedAt: number;       // 时间戳
  /** 无尽最高关数（0 = 未进入无尽） */
  bestEndlessCount: number;
}

export interface ProfileState {
  schemaVersion: number;
  /** 新手引导（阶段 D）是否已完成 */
  tutorialCompleted: boolean;
  /** 已通关的最高普通局编号（0 = 尚未通关任何普通局） */
  highestNormalRunCleared: number;
  /** 普通局通关记录 runNo → 记录 */
  normalClears: Record<number, RunClearRecord>;
  /** 困难局通关记录 runNo → 记录 */
  hardClears: Record<number, RunClearRecord>;
  /** 普通局无尽最高纪录 runNo → bestEndlessCount（合并到 normalClears 后保留向后兼容） */
  normalEndlessBest: Record<number, number>;
  /** 困难局无尽最高纪录 */
  hardEndlessBest: Record<number, number>;
}

// ─── 供 Suit/Rank 在 deck rule 中使用的类型 ─────────────────────
export type { Suit, Rank };
