import { FRAME_DEFS, MainlineRunDef, RunConfig } from '../types/profile';
import type { SkillEnhancement } from '../types/skill';

// ─── 工具函数 ─────────────────────────────────────────────────

/** 生成解锁顺序 1..n 的数组 */
function orders(max: number): number[] {
  return Array.from({ length: max }, (_, i) => i + 1);
}

const FRAME_TO_SKILL_ENHANCEMENT: Partial<Record<string, SkillEnhancement>> = {
  silver: 'flash',
  gold: 'gold',
  rainbow: 'laser',
  black: 'black',
};

export function getAllowedSkillEnhancementsAfterNormalRun(highestNormalCleared: number): SkillEnhancement[] {
  return FRAME_DEFS
    .filter((frame) => frame.unlockRunNo > 0 && highestNormalCleared >= frame.unlockRunNo)
    .map((frame) => FRAME_TO_SKILL_ENHANCEMENT[frame.id])
    .filter((enhancement): enhancement is SkillEnhancement => enhancement != null);
}

/** 普通模式默认配置（基准） */
function normalBase(
  stageCount: number,
  targetMultiplier: number,
  overrides: Partial<Omit<RunConfig, 'runNo' | 'difficulty'>> = {}
): Omit<RunConfig, 'runNo' | 'difficulty'> {
  return {
    stageCount,
    targetMultiplier,
    startingDiamonds: 3,
    banJokersGlobal: false,
    holdDelta: 0,
    handsDelta: 0,
    deckRule: 'standard',
    allHandTypesLv2: false,
    skillSlotBonus: 0,
    allowedSkillOrders: orders(1),
    allowedSkillEnhancements: [],
    shopRefreshCostDelta: 0,
    shopPriceDelta: 0,
    stageBaseDiamondZero: false,
    ...overrides,
  };
}

// ─── 50 局主线定义 ────────────────────────────────────────────

export const MAINLINE_RUNS: MainlineRunDef[] = [
  // ── 第 1 局：新手局 ────────────────────────────────────────
  {
    runNo: 1,
    title: '新手局！',
    normalConfig: normalBase(10, 1.0, {
      allowedSkillOrders: orders(1),
    }),
    hardConfig: normalBase(10, 1.1, {
      allowedSkillOrders: orders(1),
      banJokersGlobal: true,
    }),
    rewardText: '解锁第 2 局、困难 1、经典牌背',
    displayTags: [],
    hardDisplayTags: ['无 Joker', '目标略升'],
  },

  // ── 第 2 局：出征！ ────────────────────────────────────────
  {
    runNo: 2,
    title: '出征！',
    normalConfig: normalBase(20, 0.92, {
      allowedSkillOrders: orders(1),
    }),
    hardConfig: normalBase(20, 0.92, {
      allowedSkillOrders: orders(1),
      holdDelta: -1,
    }),
    rewardText: '解锁基础加分技能（解锁顺序 2）',
    displayTags: ['标准 20 关'],
    hardDisplayTags: ['Hold -1'],
  },

  // ── 第 3 局：短筹压力 ──────────────────────────────────────
  {
    runNo: 3,
    title: '短筹压力',
    normalConfig: normalBase(20, 0.94, {
      allowedSkillOrders: orders(2),
      holdDelta: -1,
    }),
    hardConfig: normalBase(20, 0.94, {
      allowedSkillOrders: orders(2),
      holdDelta: -2,
    }),
    rewardText: '解锁 Hold 相关技能（解锁顺序 3）',
    displayTags: ['Hold -1'],
    hardDisplayTags: ['Hold -2'],
  },

  // ── 第 4 局：少打一手 ──────────────────────────────────────
  {
    runNo: 4,
    title: '少打一手',
    normalConfig: normalBase(20, 0.95, {
      allowedSkillOrders: orders(3),
    }),
    hardConfig: normalBase(20, 0.97, {
      allowedSkillOrders: orders(3),
      handsDelta: -1,
    }),
    rewardText: '解锁剩余手数技能',
    displayTags: ['精英/Boss 手数 -1'],
    hardDisplayTags: ['全局手数 -1'],
  },

  // ── 第 5 局：无小丑夜 ──────────────────────────────────────
  {
    runNo: 5,
    title: '无小丑夜',
    normalConfig: normalBase(20, 0.96, {
      allowedSkillOrders: orders(3),
      banJokersGlobal: true,
    }),
    hardConfig: normalBase(20, 0.96, {
      allowedSkillOrders: orders(3),
      banJokersGlobal: true,
      holdDelta: -1,
    }),
    rewardText: '解锁 Joker 相关展示技能',
    displayTags: ['无 Joker'],
    hardDisplayTags: ['无 Joker', 'Hold -1'],
  },

  // ── 第 6 局：禁低阶 ───────────────────────────────────────
  {
    runNo: 6,
    title: '禁低阶',
    normalConfig: normalBase(20, 0.98, {
      allowedSkillOrders: orders(3),
    }),
    hardConfig: normalBase(20, 1.0, {
      allowedSkillOrders: orders(3),
    }),
    rewardText: '解锁对子/两对流派技能',
    displayTags: ['精英/Boss 可能禁高牌/一对'],
    hardDisplayTags: ['普通关也加入禁高牌'],
  },

  // ── 第 7 局：红黑半副 ──────────────────────────────────────
  {
    runNo: 7,
    title: '红黑半副',
    normalConfig: normalBase(20, 0.98, {
      allowedSkillOrders: orders(4),
      deckRule: 'two_suits_hs',
      holdDelta: 1,
    }),
    hardConfig: normalBase(20, 0.98, {
      allowedSkillOrders: orders(4),
      deckRule: 'two_suits_hs',
    }),
    rewardText: '解锁花色技能（解锁顺序 4）',
    displayTags: ['只有 ♥/♠ 花色归并', 'Hold +1'],
    hardDisplayTags: ['只有 ♥/♠', '不补 Hold'],
  },

  // ── 第 8 局：A-10 局 ──────────────────────────────────────
  {
    runNo: 8,
    title: 'A-10 局',
    normalConfig: normalBase(20, 0.99, {
      allowedSkillOrders: orders(4),
      deckRule: 'a_to_10',
    }),
    hardConfig: normalBase(20, 1.0, {
      allowedSkillOrders: orders(4),
      deckRule: 'a_to_10',
      banJokersGlobal: true,
    }),
    rewardText: '解锁 A/10/小牌相关技能（解锁顺序 5）',
    displayTags: ['A-10 牌堆', '数字牌主题'],
    hardDisplayTags: ['A-10', '无 Joker'],
  },

  // ── 第 9 局：7-A 局 ───────────────────────────────────────
  {
    runNo: 9,
    title: '7-A 局',
    normalConfig: normalBase(20, 1.0, {
      allowedSkillOrders: orders(5),
      deckRule: 'seven_to_a',
    }),
    hardConfig: normalBase(20, 1.0, {
      allowedSkillOrders: orders(5),
      deckRule: 'seven_to_a',
      holdDelta: -1,
    }),
    rewardText: '解锁人头牌技能',
    displayTags: ['7-A 牌堆'],
    hardDisplayTags: ['7-A', 'Hold -1'],
  },

  // ── 第 10 局：第一座山 ─────────────────────────────────────
  {
    runNo: 10,
    title: '第一座山',
    normalConfig: normalBase(20, 1.02, {
      allowedSkillOrders: orders(5),
      banJokersGlobal: true,
    }),
    hardConfig: normalBase(20, 1.02, {
      allowedSkillOrders: orders(5),
      banJokersGlobal: true,
      handsDelta: -1,
    }),
    rewardText: '解锁第一章牌桌皮肤',
    displayTags: ['无 Joker', 'Boss 目标 +10%'],
    hardDisplayTags: ['无 Joker', '手数 -1'],
  },

  // ── 第 11 局：富矿试炼 ─────────────────────────────────────
  {
    runNo: 11,
    title: '富矿试炼',
    normalConfig: normalBase(20, 1.02, {
      allowedSkillOrders: orders(6),
      startingDiamonds: 10,
    }),
    hardConfig: normalBase(20, 1.02, {
      allowedSkillOrders: orders(6),
      startingDiamonds: 10,
      shopRefreshCostDelta: 3,
    }),
    rewardText: '解锁钻石估值方向（解锁顺序 6）',
    displayTags: ['开局钻石 = 10', '目标 +8%'],
    hardDisplayTags: ['商店刷新费用 +3'],
  },

  // ── 第 12 局：技能扩容 ─────────────────────────────────────
  {
    runNo: 12,
    title: '技能扩容',
    normalConfig: normalBase(20, 1.03, {
      allowedSkillOrders: orders(6),
      skillSlotBonus: 1,
    }),
    hardConfig: normalBase(20, 1.03, {
      allowedSkillOrders: orders(6),
      skillSlotBonus: 1,
      shopPriceDelta: 2,
    }),
    rewardText: '解锁技能数加倍方向',
    displayTags: ['技能槽 +1', '目标 +10%'],
    hardDisplayTags: ['技能槽 +1', '商店商品价格 +2'],
  },

  // ── 第 13 局：Lv.2 起步 ───────────────────────────────────
  {
    runNo: 13,
    title: 'Lv.2 起步',
    normalConfig: normalBase(20, 1.04, {
      allowedSkillOrders: orders(7),
      allHandTypesLv2: true,
    }),
    hardConfig: normalBase(20, 1.04, {
      allowedSkillOrders: orders(7),
      allHandTypesLv2: true,
      banJokersGlobal: true,
    }),
    rewardText: '解锁牌型升级外观（解锁顺序 7）',
    displayTags: ['所有牌型 Lv.2', '目标 +15%'],
    hardDisplayTags: ['Lv.2 起步', '无 Joker'],
  },

  // ── 第 14 局：商店无常 ─────────────────────────────────────
  {
    runNo: 14,
    title: '商店无常',
    normalConfig: normalBase(20, 1.05, {
      allowedSkillOrders: orders(7),
    }),
    hardConfig: normalBase(20, 1.05, {
      allowedSkillOrders: orders(7),
      stageBaseDiamondZero: true,
    }),
    rewardText: '解锁商店刷新技能',
    displayTags: ['精英关通关基础钻石降为 💎1'],
    hardDisplayTags: ['所有精英/Boss 基础钻石降为 💎1'],
  },

  // ── 第 15 局：省着点用 ─────────────────────────────────────
  {
    runNo: 15,
    title: '省着点用',
    normalConfig: normalBase(20, 1.06, {
      allowedSkillOrders: orders(8),
      holdDelta: -1,
    }),
    hardConfig: normalBase(20, 1.06, {
      allowedSkillOrders: orders(8),
      holdDelta: -2,
    }),
    rewardText: '解锁省 Hold/省手主题技能（解锁顺序 8）',
    displayTags: ['Hold -1'],
    hardDisplayTags: ['Hold -2'],
  },

  // ── 第 16 局：无小丑构筑 ──────────────────────────────────
  {
    runNo: 16,
    title: '无小丑构筑',
    normalConfig: normalBase(20, 1.06, {
      allowedSkillOrders: orders(8),
      banJokersGlobal: true,
      holdDelta: 1,
    }),
    hardConfig: normalBase(20, 1.06, {
      allowedSkillOrders: orders(8),
      banJokersGlobal: true,
    }),
    rewardText: '解锁 Joker 概率技能',
    displayTags: ['无 Joker', 'Hold +1'],
    hardDisplayTags: ['无 Joker', '无额外补偿'],
  },

  // ── 第 17 局：顺子禁令 ─────────────────────────────────────
  {
    runNo: 17,
    title: '顺子禁令',
    normalConfig: normalBase(20, 1.07, {
      allowedSkillOrders: orders(9),
    }),
    hardConfig: normalBase(20, 1.07, {
      allowedSkillOrders: orders(9),
    }),
    rewardText: '解锁奇偶成顺技能（解锁顺序 9）',
    displayTags: ['精英/Boss 禁顺子线'],
    hardDisplayTags: ['普通精英也可能禁同花线'],
  },

  // ── 第 18 局：同花禁令 ─────────────────────────────────────
  {
    runNo: 18,
    title: '同花禁令',
    normalConfig: normalBase(20, 1.08, {
      allowedSkillOrders: orders(9),
    }),
    hardConfig: normalBase(20, 1.08, {
      allowedSkillOrders: orders(9),
    }),
    rewardText: '解锁黑/红成花技能',
    displayTags: ['精英/Boss 禁同花线'],
    hardDisplayTags: ['普通精英也可能禁顺子线'],
  },

  // ── 第 19 局：周期牌局 ─────────────────────────────────────
  {
    runNo: 19,
    title: '周期牌局',
    normalConfig: normalBase(20, 1.09, {
      allowedSkillOrders: orders(10),
    }),
    hardConfig: normalBase(20, 1.09, {
      allowedSkillOrders: orders(10),
      handsDelta: -1,
    }),
    rewardText: '解锁 7 日轮回（解锁顺序 10）',
    displayTags: ['目标略升'],
    hardDisplayTags: ['手数 -1'],
  },

  // ── 第 20 局：第二座山 ─────────────────────────────────────
  {
    runNo: 20,
    title: '第二座山',
    normalConfig: normalBase(20, 1.10, {
      allowedSkillOrders: orders(10),
    }),
    hardConfig: normalBase(20, 1.10, {
      allowedSkillOrders: orders(10),
    }),
    rewardText: '解锁第二章称号',
    displayTags: ['Boss 叠两条轻限制'],
    hardDisplayTags: ['Boss 叠一条中限制'],
  },

  // ── 第 21 局：小牌失效 ─────────────────────────────────────
  {
    runNo: 21,
    title: '小牌失效',
    normalConfig: normalBase(20, 1.10, {
      allowedSkillOrders: orders(11),
    }),
    hardConfig: normalBase(20, 1.10, {
      allowedSkillOrders: orders(11),
    }),
    rewardText: '解锁低牌补偿技能（解锁顺序 11）',
    displayTags: ['精英/Boss 2-6 牌面分不计'],
    hardDisplayTags: ['普通关也可能小牌无效'],
  },

  // ── 第 22 局：人头失效 ─────────────────────────────────────
  {
    runNo: 22,
    title: '人头失效',
    normalConfig: normalBase(20, 1.11, {
      allowedSkillOrders: orders(11),
    }),
    hardConfig: normalBase(20, 1.11, {
      allowedSkillOrders: orders(11),
      deckRule: 'a_to_10',
    }),
    rewardText: '解锁人头加分/加倍皮肤',
    displayTags: ['精英/Boss J/Q/K 牌面分不计'],
    hardDisplayTags: ['A-10 牌堆', '人头无效'],
  },

  // ── 第 23 局：黑牌局 ──────────────────────────────────────
  {
    runNo: 23,
    title: '黑牌局',
    normalConfig: normalBase(20, 1.12, {
      allowedSkillOrders: orders(12),
      deckRule: 'two_suits_sc',
      holdDelta: 1,
    }),
    hardConfig: normalBase(20, 1.12, {
      allowedSkillOrders: orders(12),
      deckRule: 'two_suits_sc',
      banJokersGlobal: true,
    }),
    rewardText: '解锁黑色成花相关外观（解锁顺序 12）',
    displayTags: ['只有 ♠/♣', 'Hold +1'],
    hardDisplayTags: ['只有 ♠/♣', '无 Joker'],
  },

  // ── 第 24 局：红牌局 ──────────────────────────────────────
  {
    runNo: 24,
    title: '红牌局',
    normalConfig: normalBase(20, 1.13, {
      allowedSkillOrders: orders(12),
      deckRule: 'two_suits_hd',
      holdDelta: 1,
    }),
    hardConfig: normalBase(20, 1.13, {
      allowedSkillOrders: orders(12),
      deckRule: 'two_suits_hd',
    }),
    rewardText: '解锁红色成花相关外观',
    displayTags: ['只有 ♥/♦', 'Hold +1'],
    hardDisplayTags: ['只有 ♥/♦', 'Hold 不补'],
  },

  // ── 第 25 局：高阶顺子 ─────────────────────────────────────
  {
    runNo: 25,
    title: '高阶顺子',
    normalConfig: normalBase(20, 1.14, {
      allowedSkillOrders: orders(13),
      deckRule: 'seven_to_a',
    }),
    hardConfig: normalBase(20, 1.14, {
      allowedSkillOrders: orders(13),
      deckRule: 'seven_to_a',
      holdDelta: -1,
    }),
    rewardText: '解锁高阶顺子乘倍（解锁顺序 13）',
    displayTags: ['7-A 牌堆', '目标 +5%'],
    hardDisplayTags: ['7-A', 'Hold -1'],
  },

  // ── 第 26 局：低阶重组 ─────────────────────────────────────
  {
    runNo: 26,
    title: '低阶重组',
    normalConfig: normalBase(20, 1.14, {
      allowedSkillOrders: orders(13),
      deckRule: 'a_to_10',
      allHandTypesLv2: true,
    }),
    hardConfig: normalBase(20, 1.14, {
      allowedSkillOrders: orders(13),
      deckRule: 'a_to_10',
      allHandTypesLv2: true,
      handsDelta: -1,
    }),
    rewardText: '解锁四张成顺/成花方向',
    displayTags: ['A-10 牌堆', '所有牌型 Lv.2'],
    hardDisplayTags: ['A-10', '手数 -1'],
  },

  // ── 第 27 局：升级狂潮 ─────────────────────────────────────
  {
    runNo: 27,
    title: '升级狂潮',
    normalConfig: normalBase(20, 1.15, {
      allowedSkillOrders: orders(14),
    }),
    hardConfig: normalBase(20, 1.15, {
      allowedSkillOrders: orders(14),
      shopPriceDelta: 2,
    }),
    rewardText: '解锁牌型升级卡面（解锁顺序 14）',
    displayTags: ['牌型升级候选 +1', '目标 +12%'],
    hardDisplayTags: ['所有商店商品价格 +2'],
  },

  // ── 第 28 局：超级牌局 ─────────────────────────────────────
  {
    runNo: 28,
    title: '超级牌局',
    normalConfig: normalBase(20, 1.16, {
      allowedSkillOrders: orders(14),
    }),
    hardConfig: normalBase(20, 1.16, {
      allowedSkillOrders: orders(14),
      shopPriceDelta: 2,
    }),
    rewardText: '解锁超级牌乘倍方向',
    displayTags: ['超级牌候选更常见', '目标 +10%'],
    hardDisplayTags: ['所有商店商品价格 +2'],
  },

  // ── 第 29 局：双向压力 ─────────────────────────────────────
  {
    runNo: 29,
    title: '双向压力',
    normalConfig: normalBase(20, 1.17, {
      allowedSkillOrders: orders(15),
      holdDelta: -1,
      handsDelta: 1,
    }),
    hardConfig: normalBase(20, 1.17, {
      allowedSkillOrders: orders(15),
      holdDelta: -1,
    }),
    rewardText: '解锁压力主题牌背（解锁顺序 15）',
    displayTags: ['Hold -1', '手数 +1'],
    hardDisplayTags: ['Hold -1', '手数不补'],
  },

  // ── 第 30 局：第三座山 ─────────────────────────────────────
  {
    runNo: 30,
    title: '第三座山',
    normalConfig: normalBase(20, 1.18, {
      allowedSkillOrders: orders(15),
    }),
    hardConfig: normalBase(20, 1.18, {
      allowedSkillOrders: orders(15),
    }),
    rewardText: '解锁第三章牌桌皮肤',
    displayTags: ['Boss 高目标 + 一条禁牌型'],
    hardDisplayTags: ['Boss 高目标 + 两条限制'],
  },

  // ── 第 31 局：♥♠ 回归 ─────────────────────────────────────
  {
    runNo: 31,
    title: '♥♠ 回归',
    normalConfig: normalBase(20, 1.18, {
      allowedSkillOrders: orders(16),
      deckRule: 'two_suits_hs',
      skillSlotBonus: 1,
    }),
    hardConfig: normalBase(20, 1.18, {
      allowedSkillOrders: orders(16),
      deckRule: 'two_suits_hs',
    }),
    rewardText: '解锁半副牌章印（解锁顺序 16）',
    displayTags: ['只有 ♥/♠ 花色归并', '技能槽 +1', '目标 +8%'],
    hardDisplayTags: ['只有 ♥/♠', '无技能槽补偿'],
  },

  // ── 第 32 局：无人头局 ─────────────────────────────────────
  {
    runNo: 32,
    title: '无人头局',
    normalConfig: normalBase(20, 1.19, {
      allowedSkillOrders: orders(16),
      deckRule: 'a_to_10',
    }),
    hardConfig: normalBase(20, 1.19, {
      allowedSkillOrders: orders(16),
      deckRule: 'a_to_10',
      banJokersGlobal: true,
    }),
    rewardText: '解锁 A/数字牌外观',
    displayTags: ['J/Q/K 不进牌堆', '数字牌主题'],
    hardDisplayTags: ['无人头', '无 Joker'],
  },

  // ── 第 33 局：奇数局 ──────────────────────────────────────
  {
    runNo: 33,
    title: '奇数局',
    normalConfig: normalBase(20, 1.19, {
      allowedSkillOrders: orders(17),
      deckRule: 'odd_only',
      holdDelta: 1,
    }),
    hardConfig: normalBase(20, 1.19, {
      allowedSkillOrders: orders(17),
      deckRule: 'odd_only',
    }),
    rewardText: '解锁奇数对子/三条方向（解锁顺序 17）',
    displayTags: ['只保留奇数牌', 'Hold +1'],
    hardDisplayTags: ['奇数牌', 'Hold 不补'],
  },

  // ── 第 34 局：偶数局 ──────────────────────────────────────
  {
    runNo: 34,
    title: '偶数局',
    normalConfig: normalBase(20, 1.20, {
      allowedSkillOrders: orders(17),
      deckRule: 'even_only',
      holdDelta: 1,
    }),
    hardConfig: normalBase(20, 1.20, {
      allowedSkillOrders: orders(17),
      deckRule: 'even_only',
    }),
    rewardText: '解锁偶数对子/三条方向',
    displayTags: ['只保留偶数牌', 'Hold +1'],
    hardDisplayTags: ['偶数牌', 'Hold 不补'],
  },

  // ── 第 35 局：暗格商店 ─────────────────────────────────────
  {
    runNo: 35,
    title: '暗格商店',
    normalConfig: normalBase(20, 1.20, {
      allowedSkillOrders: orders(18),
    }),
    hardConfig: normalBase(20, 1.20, {
      allowedSkillOrders: orders(18),
      shopRefreshCostDelta: 3,
    }),
    rewardText: '解锁抗压主题外观（解锁顺序 18）',
    displayTags: ['每次商店随机 2 个商品不可购买'],
    hardDisplayTags: ['暗格商店', '商店刷新费用 +3'],
  },

  // ── 第 36 局：手数试炼 II ──────────────────────────────────
  {
    runNo: 36,
    title: '手数试炼 II',
    normalConfig: normalBase(20, 1.21, {
      allowedSkillOrders: orders(18),
      handsDelta: -1,
      startingDiamonds: 10,
    }),
    hardConfig: normalBase(20, 1.21, {
      allowedSkillOrders: orders(18),
      handsDelta: -2,
    }),
    rewardText: '解锁省手高级奖励',
    displayTags: ['手数 -1', '开局钻石 = 10'],
    hardDisplayTags: ['手数 -2'],
  },

  // ── 第 37 局：Hold 试炼 II ─────────────────────────────────
  {
    runNo: 37,
    title: 'Hold 试炼 II',
    normalConfig: normalBase(20, 1.22, {
      allowedSkillOrders: orders(19),
      holdDelta: -2,
      startingDiamonds: 10,
    }),
    hardConfig: normalBase(20, 1.22, {
      allowedSkillOrders: orders(19),
      holdDelta: -2,
    }),
    rewardText: '解锁 Hold 高级奖励（解锁顺序 19）',
    displayTags: ['Hold -2', '开局钻石 = 10'],
    hardDisplayTags: ['Hold -2', '无额外补偿'],
  },

  // ── 第 38 局：商店荒漠 ─────────────────────────────────────
  {
    runNo: 38,
    title: '商店荒漠',
    normalConfig: normalBase(20, 1.22, {
      allowedSkillOrders: orders(19),
      shopRefreshCostDelta: 3,
    }),
    hardConfig: normalBase(20, 1.22, {
      allowedSkillOrders: orders(19),
      shopRefreshCostDelta: 3,
      shopPriceDelta: 2,
    }),
    rewardText: '解锁商店主题牌桌',
    displayTags: ['商店刷新费用 +3', '精英基础钻石降为 💎1'],
    hardDisplayTags: ['所有商店商品价格 +2'],
  },

  // ── 第 39 局：技能过载 ─────────────────────────────────────
  {
    runNo: 39,
    title: '技能过载',
    normalConfig: normalBase(20, 1.23, {
      allowedSkillOrders: orders(20),
      skillSlotBonus: 1,
    }),
    hardConfig: normalBase(20, 1.23, {
      allowedSkillOrders: orders(20),
      skillSlotBonus: 1,
      handsDelta: -1,
    }),
    rewardText: '解锁黑边主题外观（解锁顺序 20）',
    displayTags: ['技能槽 +1', '目标 +18%'],
    hardDisplayTags: ['技能槽 +1', '手数 -1'],
  },

  // ── 第 40 局：第四座山 ─────────────────────────────────────
  {
    runNo: 40,
    title: '第四座山',
    normalConfig: normalBase(20, 1.24, {
      allowedSkillOrders: orders(20),
    }),
    hardConfig: normalBase(20, 1.24, {
      allowedSkillOrders: orders(20),
    }),
    rewardText: '解锁第四章称号',
    displayTags: ['Boss 多限制', '普通关轻限制增多'],
    hardDisplayTags: ['Boss 三限制'],
  },

  // ── 第 41 局：高压目标 ─────────────────────────────────────
  {
    runNo: 41,
    title: '高压目标',
    normalConfig: normalBase(20, 1.24, {
      allowedSkillOrders: orders(21),
    }),
    hardConfig: normalBase(20, 1.24, {
      allowedSkillOrders: orders(21),
      banJokersGlobal: true,
    }),
    rewardText: '解锁高压徽章（解锁顺序 21）',
    displayTags: ['目标 +10%', '无额外补偿'],
    hardDisplayTags: ['目标再升', '无 Joker'],
  },

  // ── 第 42 局：无小丑终章 ──────────────────────────────────
  {
    runNo: 42,
    title: '无小丑终章',
    normalConfig: normalBase(20, 1.25, {
      allowedSkillOrders: orders(21),
      banJokersGlobal: true,
    }),
    hardConfig: normalBase(20, 1.25, {
      allowedSkillOrders: orders(21),
      banJokersGlobal: true,
      holdDelta: -1,
    }),
    rewardText: '解锁 Joker 禁令牌背',
    displayTags: ['全局无 Joker'],
    hardDisplayTags: ['全局无 Joker', 'Hold -1'],
  },

  // ── 第 43 局：半副终章 ─────────────────────────────────────
  {
    runNo: 43,
    title: '半副终章',
    normalConfig: normalBase(20, 1.26, {
      allowedSkillOrders: orders(22),
      deckRule: 'two_suits_hs',
    }),
    hardConfig: normalBase(20, 1.26, {
      allowedSkillOrders: orders(22),
      deckRule: 'two_suits_hs',
      handsDelta: -1,
    }),
    rewardText: '解锁半副终章称号（解锁顺序 22）',
    displayTags: ['只有 ♥/♠ 花色归并'],
    hardDisplayTags: ['只有 ♥/♠', '手数 -1'],
  },

  // ── 第 44 局：A-10 终章 ───────────────────────────────────
  {
    runNo: 44,
    title: 'A-10 终章',
    normalConfig: normalBase(20, 1.27, {
      allowedSkillOrders: orders(22),
      deckRule: 'a_to_10',
      startingDiamonds: 10,
    }),
    hardConfig: normalBase(20, 1.27, {
      allowedSkillOrders: orders(22),
      deckRule: 'a_to_10',
      holdDelta: -1,
    }),
    rewardText: '解锁 A-10 牌桌',
    displayTags: ['A-10', '开局钻石 = 10', '目标 +8%'],
    hardDisplayTags: ['A-10', 'Hold -1'],
  },

  // ── 第 45 局：7-A 终章 ────────────────────────────────────
  {
    runNo: 45,
    title: '7-A 终章',
    normalConfig: normalBase(20, 1.28, {
      allowedSkillOrders: orders(23),
      deckRule: 'seven_to_a',
    }),
    hardConfig: normalBase(20, 1.28, {
      allowedSkillOrders: orders(23),
      deckRule: 'seven_to_a',
      banJokersGlobal: true,
    }),
    rewardText: '解锁 7-A 牌桌（解锁顺序 23）',
    displayTags: ['7-A 牌堆', '目标 +10%'],
    hardDisplayTags: ['7-A', '无 Joker'],
  },

  // ── 第 46 局：禁低阶终章 ──────────────────────────────────
  {
    runNo: 46,
    title: '禁低阶终章',
    normalConfig: normalBase(20, 1.29, {
      allowedSkillOrders: orders(23),
    }),
    hardConfig: normalBase(20, 1.29, {
      allowedSkillOrders: orders(23),
    }),
    rewardText: '解锁终章技能牌框',
    displayTags: ['高牌/一对在精英无效'],
    hardDisplayTags: ['高牌/一对全局部分无效'],
  },

  // ── 第 47 局：双资源压缩 ──────────────────────────────────
  {
    runNo: 47,
    title: '双资源压缩',
    normalConfig: normalBase(20, 1.30, {
      allowedSkillOrders: orders(24),
      holdDelta: -1,
      handsDelta: -1,
      startingDiamonds: 10,
    }),
    hardConfig: normalBase(20, 1.30, {
      allowedSkillOrders: orders(24),
      holdDelta: -2,
      handsDelta: -1,
    }),
    rewardText: '解锁终章牌背（解锁顺序 24）',
    displayTags: ['Hold -1', '手数 -1', '开局钻石 = 10'],
    hardDisplayTags: ['Hold -2', '手数 -1'],
  },

  // ── 第 48 局：野人商店 ─────────────────────────────────────
  {
    runNo: 48,
    title: '野人商店',
    normalConfig: normalBase(20, 1.30, {
      allowedSkillOrders: orders(24),
      shopRefreshCostDelta: 3,
      shopPriceDelta: 2,
      startingDiamonds: 10,
    }),
    hardConfig: normalBase(20, 1.30, {
      allowedSkillOrders: orders(24),
      shopRefreshCostDelta: 3,
      shopPriceDelta: 2,
    }),
    rewardText: '解锁商店大师称号',
    displayTags: ['刷新费用 +3', '商品价格 +2', '开局钻石 = 10'],
    hardDisplayTags: ['去掉开局钻石增益'],
  },

  // ── 第 49 局：终局彩排 ─────────────────────────────────────
  {
    runNo: 49,
    title: '终局彩排',
    normalConfig: normalBase(20, 1.31, {
      allowedSkillOrders: orders(25),
      allHandTypesLv2: true,
      banJokersGlobal: true,
    }),
    hardConfig: normalBase(20, 1.31, {
      allowedSkillOrders: orders(25),
      allHandTypesLv2: true,
      banJokersGlobal: true,
      handsDelta: -1,
    }),
    rewardText: '解锁最终挑战入场动画（解锁顺序 25）',
    displayTags: ['Lv.2 起步', '无 Joker', '目标 +15%'],
    hardDisplayTags: ['Lv.2 起步', '无 Joker', '手数 -1'],
  },

  // ── 第 50 局：野人王座 ─────────────────────────────────────
  {
    runNo: 50,
    title: '野人王座',
    normalConfig: normalBase(20, 1.32, {
      allowedSkillOrders: orders(26),
    }),
    hardConfig: normalBase(20, 1.32, {
      allowedSkillOrders: orders(26),
      holdDelta: -1,
      handsDelta: -1,
      banJokersGlobal: true,
    }),
    rewardText: '解锁「野人王」外观与最终章印（解锁顺序 26+27）',
    displayTags: ['20 关', '每个 Boss 段混合限制'],
    hardDisplayTags: ['目标 +28%', '限制更重', '无补偿'],
  },
];

/** 根据局编号获取定义（1-based） */
export function getMainlineRunDef(runNo: number): MainlineRunDef | undefined {
  return MAINLINE_RUNS.find(r => r.runNo === runNo);
}

/** 根据局编号和难度构建 RunConfig */
export function buildRunConfig(
  runNo: number,
  difficulty: 'normal' | 'hard',
  highestNormalCleared: number,
): RunConfig | null {
  const def = getMainlineRunDef(runNo);
  if (!def) return null;

  // 计算当局可用技能顺序（取已解锁的最大值和本局配置交集）
  const baseConfig = difficulty === 'hard' ? def.hardConfig : def.normalConfig;

  return {
    runNo,
    difficulty,
    ...baseConfig,
    allowedSkillEnhancements: getAllowedSkillEnhancementsAfterNormalRun(highestNormalCleared),
  };
}

/** 自由挑战（无限挑战）配置：解锁全部技能，使用标准规则 */
export function buildFreeplayConfig(): RunConfig {
  return {
    runNo: 0,
    difficulty: 'freeplay',
    stageCount: 20,
    targetMultiplier: 1.0,
    startingDiamonds: 3,
    banJokersGlobal: false,
    holdDelta: 0,
    handsDelta: 0,
    deckRule: 'standard',
    allHandTypesLv2: false,
    skillSlotBonus: 0,
    allowedSkillOrders: Array.from({ length: 27 }, (_, i) => i + 1),
    allowedSkillEnhancements: ['flash', 'gold', 'laser', 'black'],
    shopRefreshCostDelta: 0,
    shopPriceDelta: 0,
    stageBaseDiamondZero: false,
  };
}
