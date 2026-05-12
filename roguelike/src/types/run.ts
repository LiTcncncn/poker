import { Card, HandType, Suit } from '../shared/types/poker';
import { SkillEnhancement } from './skill';
import { DeckRule } from './profile';

// ─── Run 全局 ────────────────────────────────────────────────
export interface RunState {
  runId: string;
  currentStageIndex: number;   // 0-based，主线 0..runStageCount-1；无尽阶段固定为 runStageCount
  stages: StageState[];
  handTypeUpgrades: HandTypeUpgradeMap;  // 已累积的牌型等级
  acquiredSkillIds: string[];
  /** 本局曾拥有后已卖出的技能 id；商店候选不再出现这些技能 */
  soldSkillIds: string[];

  // ── 多局长线：局级规则 ────────────────────────────────────
  /** 所属主线局编号（0 = 自由挑战） */
  runNo: number;
  /** 本局难度 */
  difficulty: 'normal' | 'hard' | 'freeplay';
  /** 本局牌堆规则 */
  deckRule: DeckRule;
  /** 本局全局禁 Joker */
  runBanJokers: boolean;
  /** 本局全局 Hold 增量（每关生效，已叠加进 stage 初始参数） */
  runHoldDelta: number;
  /** 本局全局手数增量 */
  runHandsDelta: number;
  /** 本局商店刷新费用增量 */
  runShopRefreshCostDelta: number;
  /** 本局商店商品价格增量 */
  runShopPriceDelta: number;
  /** 本局可用技能解锁顺序集合 */
  allowedSkillOrders: number[];
  /** 本局商店可 Roll 出的技能附加边（不含 normal） */
  allowedSkillEnhancements: SkillEnhancement[];
  /** 本局目标分外层倍率（已乘入每关 targetGold，此处仅供信息显示） */
  runTargetMultiplier: number;
  /** 本局主线关卡总数（10 或 20） */
  runStageCount: number;
  /** 技能附加属性：skillId -> normal/flash/gold/laser/black（黑边：总槽 = 基础 skillSlotCap + 黑边枚数；「+1」含该牌本身所占 1 格，可多张线性叠加） */
  skillEnhancements: Record<string, SkillEnhancement>;
  /** 技能槽上限（本局基础）：默认 5；有效槽 = 本值 + 已持有黑边枚数（另见 `getEffectiveSkillSlotCap`） */
  skillSlotCap: number;
  /** 本局已获取的属性牌（直接作为完整 Card 对象存储，加入发牌池） */
  attributeCards: Card[];
  /** 局内钻石（可因「超级信用卡」至 **−20** 下限） */
  runDiamonds: number;
  /**
   * 卖方市场：每关胜利后，每个**已拥有**技能 id 的卖出回收价累计 +N 💎（在品质/边基础卖出价之上再加）；**每 id 叠加上限 8💎**。
   */
  skillSellBonus?: Record<string, number>;
  /**
   * 「随机加倍」：本手在 **翻牌（deal→hold）** 时骰出的加性倍率整数，结算与 Hold 预览共用；
   * 新一手发牌时清除，见 store 的 `dealInitialHand` / `flipCards`。
   */
  pendingRandomHandMult?: number;
  /** 局内钻石累计收入 */
  diamondsEarnedTotal: number;
  /** 局内钻石累计消耗 */
  diamondsSpentTotal: number;
  status: 'idle' | 'running' | 'victory' | 'defeat';
  startedAt: number;
  /** 技能累积值 skillId → 当前累积量 */
  skillAccumulation: Record<string, number>;
  /** 每关分配的词缀 stageIndex → modifierId */
  stageModifiers: Record<number, string>;

  // ── 黑边技能定向保底（商店）──────────────────────────────
  /**
   * 黑边定向保底：当前激活段的目标 N（代表“希望拥有黑边 ≤N 时开始倾向放出”）。
   * gateK(N)=15+20N；仅在满足门槛时生效；段切换时重置 misses/cooldown。
   */
  blackEdgePityGateN?: number;
  /** 当前段内连续“商店未出现黑边技能候选”的次数（用于 p(miss) 曲线） */
  blackEdgePityMisses?: number;
  /**
   * 冷却剩余关数：当某关商店出现黑边但未购买时，接下来 2 关不强行注入黑边（仅保留默认掷边概率），但 misses 仍累加。
   */
  blackEdgePityCooldown?: number;

  // ── 继续挑战（无限阶段） ──────────────────────
  /** 是否已进入无限挑战阶段 */
  isEndless: boolean;
  /** 已完成的无限阶段关卡数（0 = 还未完成任何无限关） */
  endlessStagesCleared: number;

  // ── 成绩统计 ──────────────────────────────────
  /** 本局所有手牌累计金币 */
  totalGoldEarned: number;
  /** 本局累计结算手数（跨关递增；用于「7 日轮回」等全局手序技能） */
  handsPlayedTotal?: number;
  /** 本局遭遇过的最高单关目标金币 */
  highestSingleStageTarget: number;
  /** IAA 使用状态（undefined = 本局未使用任何 IAA） */
  iaa?: RunIaaState;
  /**
   * 单手 `finalGold` 创新高时记录：牌型为该手牌型，`finalGold` 与 `maxSingleHandGold` 一致。
   * 并列峰值时保留先达到者。
   */
  bestHandThisRun: { handType: HandType; finalGold: number } | null;
  /** 本局单手最终 $ 峰值（结算/排行以该数值为准） */
  maxSingleHandGold: number;
}

// ─── 关卡 ────────────────────────────────────────────────────
export interface StageState {
  stageIndex: number;          // 0-based
  targetGold: number;
  /** 本关目标倍率（词缀 high_target）；最终目标 = ceil(targetGold * multiplier) */
  targetGoldMultiplier?: number;
  totalHands: number;          // 本关总手数
  usedHands: number;
  /** 本关可用补牌总次数（词缀可能减少） */
  holdTotal: number;
  /** 本关已用补牌次数 */
  holdUsed: number;
  accumulatedGold: number;
  isElite: boolean;
  isBoss: boolean;
  modifierId: string | null;   // 关卡词缀 ID
  /** 词缀禁止的牌型（计分时强制为 0） */
  bannedHandTypes: HandType[];
  /** 前 N 手不可补牌（0 = 不限制） */
  blockHoldBefore: number;
  /** 后 N 手不可补牌（0 = 不限制） */
  blockHoldAfter: number;
  /** 词缀禁止的花色（该花色牌牌面分不计入，但牌型本身仍计分） */
  bannedSuits: Suit[];
  /** 词缀禁止的最大点数（≤ 此值的牌牌面分不计入，0 = 不限制） */
  bannedRankMax: number;
  /** 词缀：J/Q/K 的牌面分不计入（牌型仍正常判断与计分） */
  banFaceCardScore?: boolean;
  /** 词缀：本关不向牌堆注入 Joker（`injectJokers` 概率为 0） */
  banJokers: boolean;
  /** 词缀：结算时读取牌型升级等级临时 -N（最低 Lv1；不改变牌型判定/技能触发） */
  handTypeLevelDownshift?: number;
  /** 词缀：本关通关结算的基础💎为 0 */
  shopBaseDiamondRewardZero?: boolean;
  status: 'pending' | 'active' | 'won' | 'lost';
}

// ─── 手牌 ────────────────────────────────────────────────────
// phase 流程：deal(翻牌前) → hold(翻牌后，可补牌或结算) → result(结算后)
export interface HandState {
  deck: Card[];               // 当前关牌池（已洗牌）
  hand: Card[];               // 当前手牌 5 张
  heldIndices: number[];      // hold 的位置索引
  phase: 'deal' | 'hold' | 'result';
  /** 本手已使用的补牌次数（用于技能触发条件） */
  drawsUsed: number;
  lastResult: HandResult | null;
}

// ─── 结算结果 ────────────────────────────────────────────────
export interface HandResult {
  handType: HandType;
  handName: string;
  scoringCardIds: string[];
  cardScoreSum: number;       // 牌面$ + 牌型基础$
  multiplierTotal: number;    // 牌型倍率
  skillAddedScore: number;    // 技能$
  skillAddedMultiplier: number; // 额外倍率
  independentMultiplier: number; // 独立乘区（默认 1.0）
  finalGold: number;          // 本手最终金币
  /** 本手因「钻牌参与计分」获得的局内 💎（与 `runDiamonds` 同源） */
  diamondReward?: number;
  skillLog: SkillApplyLog[];  // 各技能贡献明细（UI 用）
}

export interface SkillApplyLog {
  skillId: string;
  skillName: string;
  addedScore?: number;
  addedMultiplier?: number;
  multiplyFactor?: number;
}

// ─── 牌型升级 ────────────────────────────────────────────────
export type HandTypeUpgradeMap = Partial<Record<HandType, number>>;  // HandType -> level (default 1)

// ─── IAA 状态 ─────────────────────────────────────────────────
/** 每关 IAA 使用记录 */
export interface StageIaaState {
  /** @deprecated IAA 补钻已改为每局共享次数；旧存档可能仍有该字段 */
  diamondRefillUsed?: boolean;
  /** 本关是否已用 IAA 刷新商店 */
  iaaRefreshUsed?: boolean;
  /** 本关是否已用 IAA 购买商品 */
  shopIaaPurchaseUsed?: boolean;
  /** 本关 IAA HOLD+1 已授权但尚未消耗（授权后出现补牌按钮） */
  extraHoldGranted?: boolean;
  /** 本关 IAA HOLD+1 已消耗 */
  extraHoldUsed?: boolean;
  /** 本关是否已用 IAA 手数+1 */
  extraHandUsed?: boolean;
}

/** 局级 IAA 使用汇总 */
export interface RunIaaState {
  /** 本局是否使用了任何 IAA 功能 */
  iaaAssisted: boolean;
  /** 本局 IAA 复活是否已用（每局限 1 次） */
  runReviveUsed: boolean;
  /** 本局累计观看广告次数 */
  totalAdsWatched: number;
  /** 本局 IAA 补钻已使用次数（商店与关内入口共享，上限 2 次） */
  diamondRefillCount?: number;
  /** 本局 IAA 获得的钻石总量 */
  diamondsFromIaa: number;
  /** 各关 IAA 使用记录（stageIndex → 记录） */
  perStage: Record<number, StageIaaState>;
}
