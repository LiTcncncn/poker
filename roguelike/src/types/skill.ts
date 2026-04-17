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
  | 'hand_add_score'                  // 特定牌型 +N 技能$
  | 'hand_add_multiplier'             // 特定牌型 +N 额外倍率
  | 'all_cards_score'                 // 强制 5 张全部计分（限定牌型）
  | 'per_scoring_card_score'          // 每张符合条件的计分牌 +N 技能$
  | 'per_scoring_card_multiplier'     // 每张符合条件的计分牌 +N 额外倍率
  | 'per_non_scoring_card_multiplier' // 每张非计分牌 +N 额外倍率
  | 'accumulate_score'                // 触发累积 +N 技能$（整局持续）
  | 'accumulate_multiplier'           // 触发累积 +N 额外倍率（整局持续）
  | 'modify_rule';                    // 改变成牌规则

export interface SkillEffect {
  type: SkillEffectType;
  value: number;
  // 触发条件（适用于大多数 effect 类型）
  triggerHandTypes?: HandType[];          // 只在这些牌型时触发
  triggerSuits?: Suit[];                  // 每张符合该花色的牌
  triggerRanks?: number[];                // 每张符合该点数的牌
  triggerFaceCard?: boolean;              // J/Q/K
  triggerHighStreet?: boolean;            // 10/J/Q/K/A（per card）
  triggerOdd?: boolean;                   // 奇数点数
  triggerEven?: boolean;                  // 偶数点数
  triggerHasJoker?: boolean;             // 手牌中有 Joker
  triggerHighStraight?: boolean;          // 顺子且为 10JQKA
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
}

export interface SkillDef {
  id: string;
  name: string;
  quality: SkillQuality;
  description: string;
  effects: SkillEffect[];
}
