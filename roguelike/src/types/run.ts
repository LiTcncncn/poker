import { Card, HandType, Suit } from '../shared/types/poker';

// ─── Run 全局 ────────────────────────────────────────────────
export interface RunState {
  runId: string;
  currentStageIndex: number;   // 0-based, 主线 0-14，无限阶段固定为 TOTAL_STAGES(15)
  stages: StageState[];
  handTypeUpgrades: HandTypeUpgradeMap;  // 已累积的牌型等级
  acquiredSkillIds: string[];
  /** 本局已获取的属性牌（直接作为完整 Card 对象存储，加入发牌池） */
  attributeCards: Card[];
  status: 'idle' | 'running' | 'victory' | 'defeat';
  startedAt: number;
  /** 技能累积值 skillId → 当前累积量 */
  skillAccumulation: Record<string, number>;
  /** 每关分配的词缀 stageIndex → modifierId */
  stageModifiers: Record<number, string>;

  // ── 继续挑战（无限阶段） ──────────────────────
  /** 是否已进入无限挑战阶段 */
  isEndless: boolean;
  /** 已完成的无限阶段关卡数（0 = 还未完成任何无限关） */
  endlessStagesCleared: number;

  // ── 成绩统计 ──────────────────────────────────
  /** 本局所有手牌累计金币 */
  totalGoldEarned: number;
  /** 本局遭遇过的最高单关目标金币 */
  highestSingleStageTarget: number;
}

// ─── 关卡 ────────────────────────────────────────────────────
export interface StageState {
  stageIndex: number;          // 0-based
  targetGold: number;
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
