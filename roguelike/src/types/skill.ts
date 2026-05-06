import { HandType } from '../shared/types/poker';
import type { Suit } from '../shared/types/poker';

export type SkillQuality = 'green' | 'blue' | 'purple';

export type RuleModType =
  | 'color_flush_black'   // ♠/♣ 互相视为同花
  | 'color_flush_red'     // ♥/♦ 互相视为同花
  | 'n_card_straight_4'   // 4 张成顺
  | 'n_card_flush_4'      // 4 张成花
  | 'odd_straight'        // 奇数成顺
  | 'even_straight';      // 偶数成顺

export type SkillEffectType =
  | 'add_score'                       // 无条件 +N 技能$
  | 'add_multiplier'                  // 无条件 +N 额外倍率
  | 'independent_multiply'            // 独立乘区 ×N
  | 'super_card_independent_multiply' // 独立乘区 ×min(上限, 1+N·value)；value 为每张超级牌增量（默认 0.1），上限见 skillEngine 常量
  /** 每持有 1 局内 💎（计分取样时），本手 +value 技能$；取样见 skillEngine（不含本手待发钻）；可用 `perRunDiamondsCost` 改为每 N💎 触发一次 */
  | 'per_run_diamond_score'
  /** 每持有 1 局内 💎，本手 +value 额外倍率（加性区）；可用 `perRunDiamondsCost` 改为每 N💎 触发一次 */
  | 'per_run_diamond_multiplier'
  | 'hand_add_score'                  // 特定牌型 +N 技能$
  | 'hand_add_multiplier'             // 特定牌型 +N 额外倍率
  | 'all_cards_score'                 // 强制 5 张全部计分（限定牌型）
  | 'per_scoring_card_score'          // 每张符合条件的计分牌 +N 技能$
  | 'per_scoring_card_multiplier'     // 每张符合条件的计分牌 +N 额外倍率
  | 'per_non_scoring_card_multiplier' // 每张非计分牌 +N 额外倍率
  | 'accumulate_score'                // 触发累积 +N 技能$（整局持续）
  /** 本关达标通关时：每剩余 1 手牌累积 value（上限 accumulateCap），整池并入当次结算技能$ */
  | 'accumulate_score_saved_hands'
  | 'accumulate_multiplier'           // 触发累积 +N 额外倍率（整局持续）
  /** 本手结算时未使用补牌（drawsUsedThisHand===0）：累积 value 倍率池（上限 accumulateCap），整池并入当次额外倍率 */
  | 'accumulate_multiplier_no_draw'
  | 'modify_rule'                    // 改变成牌规则
  /** 本手结算加性倍率：整数区间由 `randomMultMin`/`randomMultMax` 定义，实际点数由 `evaluateHandWithSkills` 的 `randomHandAddMultiplier` 传入（通常由 store 每手骰一次） */
  | 'random_hand_add_multiplier'
  /** 剩手加倍：`max(0, stageTotalHands - stageUsedHands - 1) * value` 加性倍率（本手打完后的剩余手数 × 每手 value） */
  | 'per_remaining_hand_add_multiplier';

export interface SkillEffect {
  type: SkillEffectType;
  value: number;
  // 触发条件（适用于大多数 effect 类型）
  triggerHandTypes?: HandType[];          // 只在这些牌型时触发
  matchContainedHandTypes?: boolean;      // 是否按“含牌型”匹配（仅触发一次）
  triggerSuits?: Suit[];                  // 每张符合该花色的牌
  triggerRanks?: number[];                // 每张符合该点数的牌
  triggerFaceCard?: boolean;              // J/Q/K
  triggerHighStreet?: boolean;            // 10/J/Q/K/A（per card）
  triggerOdd?: boolean;                   // 奇数点数
  triggerEven?: boolean;                  // 偶数点数
  triggerHasJoker?: boolean;             // 手牌中有 Joker
  // 累积上限
  accumulateCap?: number;
  // Hold 触发（仅限 accumulate_multiplier）
  triggerOnHold?: boolean;
  triggerHoldRank?: number;              // hold 该点数时触发
  triggerHoldCountExact?: number;        // hold 恰好 N 张时触发
  // 改规则
  ruleType?: RuleModType;
  // 场景限制
  requireLastHand?: boolean;             // 必须是本关最后一手
  requireFirstHandNoHold?: boolean;      // 必须是本关第一手且未用额外 hold
  /** 仅当 `runDiamonds`（计分取样）≤ 此值时，`independent_multiply` 才生效（如超级穷鬼） */
  requireRunDiamondsLte?: number;
  /** `per_run_diamond_score` / `per_run_diamond_multiplier`：每 N 颗局内 💎 计 1 次（向下取整）；缺省为 1 */
  perRunDiamondsCost?: number;
  /** `random_hand_add_multiplier`：闭区间整数随机加性倍率上下限（缺省 2～20） */
  randomMultMin?: number;
  randomMultMax?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  quality: SkillQuality;
  description: string;
  effects: SkillEffect[];
}

export type SkillEnhancement = 'normal' | 'flash' | 'gold' | 'laser' | 'black';
