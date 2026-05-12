import { Suit, Rank } from '../shared/types/poker';

// ─── 牌堆规则 ─────────────────────────────────────────────────
/**
 * standard    - 标准 52 张
 * two_suits_hs - 花色归并：♦→♥、♣→♠（26 hearts + 26 spades，同点数各重复一张）
 * two_suits_sc - 花色归并：♥→♠、♦→♣（仅黑色花色）
 * two_suits_hd - 花色归并：♠→♥、♣→♦（仅红色花色）
 * a_to_10     - 去掉 J/Q/K，仅保留 A, 2-10
 * seven_to_a  - 去掉 2-6，仅保留 7-A
 * odd_only    - 仅奇数点数：A,3,5,7,9,J,K
 * even_only   - 仅偶数点数：2,4,6,8,10,Q
 */
export type DeckRule =
  | 'standard'
  | 'two_suits_hs'
  | 'two_suits_sc'
  | 'two_suits_hd'
  | 'a_to_10'
  | 'seven_to_a'
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
  /** 商店刷新费用增量（如 +3） */
  shopRefreshCostDelta: number;
  /** 商店商品价格增量（如 +2） */
  shopPriceDelta: number;
  /** 通关基础钻石来源是否覆盖为 0（true = 覆盖） */
  stageBaseDiamondZero: boolean;
}

// ─── 主线局定义 ───────────────────────────────────────────────
export interface MainlineRunDef {
  runNo: number;
  title: string;
  /** 普通模式配置 */
  normalConfig: Omit<RunConfig, 'runNo' | 'difficulty'>;
  /** 困难模式配置（叠加在普通之上） */
  hardConfig: Omit<RunConfig, 'runNo' | 'difficulty'>;
  /** 普通胜利后解锁的内容描述（仅展示用） */
  rewardText: string;
  /** 本局主题标签（显示在限制 chip 区域） */
  displayTags: string[];
  /** 困难模式附加显示标签 */
  hardDisplayTags: string[];
}

// ─── 边框皮肤 ──────────────────────────────────────────────────
export type FrameId = 'default' | 'silver' | 'gold' | 'rainbow' | 'black';

export interface FrameDef {
  id: FrameId;
  label: string;
  unlockRunNo: number; // 0 = 默认解锁
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
  /** 当前选中的界面边框皮肤 */
  activeFrame: FrameId;
}

// ─── 供 Suit/Rank 在 deck rule 中使用的类型 ─────────────────────
export type { Suit, Rank };
