/**
 * 技能解锁顺序表
 * key = 解锁顺序编号（1-27）
 * value = 该顺序包含的技能 ID 列表
 *
 * 解锁顺序 1 = 默认已解锁，第 1、2 局可用。
 * 后续顺序通过普通局胜利逐步解锁，见 mainlineRuns.ts 中各局的 allowedSkillOrders。
 */
export const SKILL_UNLOCK_ORDER_MAP: Record<number, string[]> = {
  1: [
    'high_card_all',
    'pair_all',
    'trips_all',
    'ten_score',
    'j_mult',
    'q_score',
    'k_mult',
    'heart_mult',
    'spade_mult',
    'club_mult',
    'diamond_mult',
    'face_mult',
    'flat_score',
    'flat_mult',
    'full_house_mult_bonus',
    'flush_mult_bonus',
    'straight_mult_bonus',
    'trips_mult_bonus',
    'two_pairs_mult_bonus',
    'pair_mult_bonus',
    'face_score',
    'odd_score',
    'even_score',
    'ace_combo',
    'joker_rate',
    'skill_count_mult',
    'elite_unshackled',
    'odd_pair_score_40',
    'even_pair_mult_6',
    'random_double_hand',
  ],
  2: ['last_hand_double', 'odd_trips_score_60', 'even_trips_mult_8'],
  3: ['pair_score_30', 'trips_score_30', 'flush_score_60', 'rainbow_suits_x2', 'forward_rush'],
  4: ['black_flush', 'red_flush'],
  5: ['small_cards_score', 'unscored_bonus'],
  6: ['diamond_score_per_gem', 'diamond_mult_per_gem'],
  7: ['trips_accum', 'universal_double'],
  8: ['two_pairs_score_30', 'straight_score_60', 'full_house_score_60'],
  9: ['second_hand_joker_x2', 'remaining_hands_mult'],
  10: ['straight_x15', 'flush_x15'],
  11: ['joker_mult', 'joker_score'],
  12: ['joker_double', 'super_broke'],
  13: ['saved_hands_accum', 'saved_hold_mult'],
  14: ['super_credit_card', 'diamond_tycoon'],
  15: ['nine_accum', 'fading_boost'],
  16: ['pair_accum', 'eight_hold_accum'],
  17: ['diminishing_effect', 'refresh_shop_mult'],
  18: ['four_flush', 'four_straight'],
  19: ['full_house_x15', 'straight_flush_x2'],
  20: ['odd_straight_skill', 'even_straight_skill'],
  21: ['sellers_market'],
  22: ['three_hold_accum'],
  23: ['high_straight_x3'],
  24: ['no_hold_double'],
  25: ['hearts_flush_x15'],
  26: ['super_card_mult'],
  27: ['seven_cycle_x4'],
};

/**
 * 根据允许的解锁顺序列表，返回所有可用技能 ID
 */
export function getAllowedSkillIds(allowedOrders: number[]): Set<string> {
  const ids = new Set<string>();
  for (const order of allowedOrders) {
    const skills = SKILL_UNLOCK_ORDER_MAP[order];
    if (skills) skills.forEach(id => ids.add(id));
  }
  return ids;
}

/**
 * 计算到第 n 局普通胜利后解锁的技能顺序集合
 * 第 1、2 局默认解锁顺序 1；第 2 局胜利后解锁顺序 2，依此类推
 */
export function getUnlockedOrdersAfterNormalRun(highestNormalCleared: number): number[] {
  // 顺序 1 默认解锁
  const orders: number[] = [1];
  // 第 2 局胜利解锁顺序 2
  if (highestNormalCleared >= 2) orders.push(2);
  // 第 3 局胜利解锁顺序 3
  if (highestNormalCleared >= 3) orders.push(3);
  // 第 5 局胜利解锁顺序 4
  if (highestNormalCleared >= 5) orders.push(4);
  // 之后基本每隔 2 局解锁一次（顺序 5 对应第 7 局，6 对应第 9 局...）
  // 通用公式：解锁顺序 k（k >= 5）= 第 (5 + (k - 5) * 2 + 2) 局 = 第 (2k - 3) 局
  for (let k = 5; k <= 27; k++) {
    const requiredRun = 2 * k - 3;
    if (highestNormalCleared >= requiredRun) orders.push(k);
  }
  return orders;
}
