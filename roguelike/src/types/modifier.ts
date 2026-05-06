import { HandType } from '../shared/types/poker';

export type ModifierEffectType =
  | 'ban_hand_types'     // 指定牌型不计分
  | 'reduce_hold'        // 本关补牌总量 -N
  | 'block_hold_before'  // 前 N 手不可补牌
  | 'block_hold_after'   // 后 N 手不可补牌
  | 'reduce_hand_count'  // 本关手数 -N
  | 'ban_suits'          // 指定花色牌的牌面分不计入
  | 'ban_rank_max'       // ≤ value 的牌（小牌）牌面分不计入
  | 'ban_jokers';        // 本关不向牌堆注入 Joker（注入概率为 0）

export interface ModifierEffect {
  type: ModifierEffectType;
  value: number;
  handTypes?: HandType[];   // 用于 ban_hand_types
  suits?: string[];         // 用于 ban_suits（值为 Suit 字符串）
}

export interface ModifierDef {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;    // 1=轻, 2=中, 3=重
  effects: ModifierEffect[];
}
