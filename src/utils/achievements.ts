import { HandType } from '../types/poker';

// 成就类型
export type AchievementType = 
  | HandType  // 牌型成就
  | 'super_card_count'      // 超级牌数量
  | 'blue_card_count'        // 蓝牌数量
  | 'purple_card_count'       // 紫牌数量
  | 'green_card_count'        // 绿牌数量
  | 'craft_gold_count';       // 合成金卡次数

// 成就配置
export interface AchievementConfig {
  achievementType: AchievementType;
  reward: number | ((threshold: number) => number); // 每档奖励钻石数（可以是函数，根据阈值动态计算）
  incrementalThresholds: number[]; // 每档增量值数组（每档需要完成的数值）
  thresholds: number[]; // 累计值数组（用于检测，由增量值计算得出）
}

// 成就进度
export interface AchievementProgress {
  achievementType: AchievementType;
  currentTier: number; // 当前完成的最高档位
  claimedTiers: number[]; // 已领取的档位索引数组
}

// 将增量值数组转换为累计值数组（用于检测）
const convertIncrementalToCumulative = (incremental: number[]): number[] => {
  const cumulative: number[] = [];
  let sum = 0;
  for (const inc of incremental) {
    sum += inc;
    cumulative.push(sum);
  }
  return cumulative;
};

// 生成渐进+固定模式的增量值数组
const generateProgressiveFixedIncremental = (initial: number[], fixedIncrement: number, count: number): number[] => {
  const incremental = [...initial];
  while (incremental.length < count) {
    incremental.push(fixedIncrement);
  }
  return incremental;
};

// 牌型成就前档增量（共 500 档：前档 + 后档固定增量）
const HAND_TIER_TOTAL = 500;
const ONE_PAIR_INITIAL = [1, 9, ...Array(28).fill(10), ...Array(20).fill(20)]; // 前50档
const TWO_PAIRS_INITIAL = [1, 7, ...Array(28).fill(8)]; // 前30档
const THREE_KIND_INITIAL = [1, 4, ...Array(28).fill(5)]; // 前30档
const STRAIGHT_LIKE_INITIAL = [1, 2, ...Array(28).fill(3)]; // 前30档（顺子/同花/葫芦）
const FOUR_KIND_INITIAL = [1, 1, ...Array(28).fill(2)]; // 前30档
const STRAIGHT_FLUSH_INITIAL = Array(30).fill(1); // 前30档
const ROYAL_FLUSH_INITIAL = Array(30).fill(1); // 前30档

// 成就配置表
export const ACHIEVEMENT_CONFIGS: Partial<Record<AchievementType, AchievementConfig>> = {
  // 牌型成就 - 500档：前档 + 后档固定增量
  one_pair: {
    achievementType: 'one_pair',
    reward: 20,
    incrementalThresholds: generateProgressiveFixedIncremental(ONE_PAIR_INITIAL, 30, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  two_pairs: {
    achievementType: 'two_pairs',
    reward: 30,
    incrementalThresholds: generateProgressiveFixedIncremental(TWO_PAIRS_INITIAL, 20, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  three_of_a_kind: {
    achievementType: 'three_of_a_kind',
    reward: 50,
    incrementalThresholds: generateProgressiveFixedIncremental(THREE_KIND_INITIAL, 15, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  straight: {
    achievementType: 'straight',
    reward: 80,
    incrementalThresholds: generateProgressiveFixedIncremental(STRAIGHT_LIKE_INITIAL, 10, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  flush: {
    achievementType: 'flush',
    reward: 80,
    incrementalThresholds: generateProgressiveFixedIncremental(STRAIGHT_LIKE_INITIAL, 10, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  full_house: {
    achievementType: 'full_house',
    reward: 120,
    incrementalThresholds: generateProgressiveFixedIncremental(STRAIGHT_LIKE_INITIAL, 10, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  four_of_a_kind: {
    achievementType: 'four_of_a_kind',
    reward: 200,
    incrementalThresholds: generateProgressiveFixedIncremental(FOUR_KIND_INITIAL, 8, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  five_of_a_kind: {
    achievementType: 'five_of_a_kind',
    reward: 300,
    // 五条：完全按四条的档位逻辑（前30档 + 后段固定增量），仅奖励更高
    incrementalThresholds: generateProgressiveFixedIncremental(FOUR_KIND_INITIAL, 8, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  straight_flush: {
    achievementType: 'straight_flush',
    reward: 400,
    incrementalThresholds: generateProgressiveFixedIncremental(STRAIGHT_FLUSH_INITIAL, 5, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  royal_flush: {
    achievementType: 'royal_flush',
    reward: 800,
    incrementalThresholds: generateProgressiveFixedIncremental(ROYAL_FLUSH_INITIAL, 2, HAND_TIER_TOTAL),
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  
  // 新成就类型
  super_card_count: {
    achievementType: 'super_card_count',
    reward: 400, // 600 / 0.6 * 0.4 = 400
    incrementalThresholds: [13, 13, 13, 13], // 4档：每个花色的A-K完成（13张），4个花色共52张
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  blue_card_count: {
    achievementType: 'blue_card_count',
    reward: 50,
    incrementalThresholds: generateProgressiveFixedIncremental([1, 4, 5], 5, 500), // 1, 5, 10, 15, 20...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  purple_card_count: {
    achievementType: 'purple_card_count',
    reward: 150,
    incrementalThresholds: generateProgressiveFixedIncremental([1, 2], 3, 500), // 1, 3, 6, 9, 12, 15...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  green_card_count: {
    achievementType: 'green_card_count',
    reward: 20, // 30 / 0.6 * 0.4 = 20
    incrementalThresholds: generateProgressiveFixedIncremental([1, 4, 5, 0], 20, 20), // 1, 4, 5, 0, 20, 20, 20...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  craft_gold_count: {
    achievementType: 'craft_gold_count',
    reward: 200,
    incrementalThresholds: generateProgressiveFixedIncremental([1], 1, 500), // 每档+1
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  }
};

// 牌型显示名称
export const HAND_TYPE_NAMES: Record<HandType, string> = {
  high_card: '高牌',
  one_pair: '一对',
  two_pairs: '两对',
  three_of_a_kind: '三条',
  straight: '顺子',
  flush: '同花',
  full_house: '葫芦',
  four_of_a_kind: '四条',
  five_of_a_kind: '五条',
  six_of_a_kind: '六条',
  seven_of_a_kind: '七条',
  straight_flush: '同花顺',
  royal_flush: '皇家同花顺',
};

// 成就显示名称
export const ACHIEVEMENT_TYPE_NAMES: Record<AchievementType, string> = {
  // 牌型成就
  high_card: '高牌',
  one_pair: '一对',
  two_pairs: '两对',
  three_of_a_kind: '三条',
  straight: '顺子',
  flush: '同花',
  full_house: '葫芦',
  four_of_a_kind: '四条',
  five_of_a_kind: '五条',
  six_of_a_kind: '六条',
  seven_of_a_kind: '七条',
  straight_flush: '同花顺',
  royal_flush: '皇家同花顺',
  // 新成就
  super_card_count: '超级牌数量',
  blue_card_count: '蓝牌数量',
  purple_card_count: '紫牌数量',
  green_card_count: '绿牌数量',
  craft_gold_count: '金牌数量',
};

// 初始化成就进度
export const createInitialAchievements = (): Record<AchievementType, AchievementProgress> => {
  const achievements: Record<AchievementType, AchievementProgress> = {} as Record<AchievementType, AchievementProgress>;
  
  // 牌型成就
  const handTypes: HandType[] = [
    'one_pair',
    'two_pairs',
    'three_of_a_kind',
    'straight',
    'flush',
    'full_house',
    'four_of_a_kind',
    'five_of_a_kind',
    'straight_flush',
    'royal_flush'
  ];
  
  handTypes.forEach(handType => {
    achievements[handType] = {
      achievementType: handType,
      currentTier: -1, // -1 表示尚未完成任何档位
      claimedTiers: []
    };
  });
  
  // 新成就类型
  const newAchievementTypes: AchievementType[] = [
    'super_card_count',
    'blue_card_count',
    'purple_card_count',
    'green_card_count',
    'craft_gold_count'
  ];
  
  newAchievementTypes.forEach(achievementType => {
    achievements[achievementType] = {
      achievementType,
      currentTier: -1,
      claimedTiers: []
    };
  });
  
  return achievements;
};

// 检测成就进度
export const checkAchievementProgress = (
  achievementType: AchievementType,
  count: number,
  currentProgress: AchievementProgress
): AchievementProgress => {
  const config = ACHIEVEMENT_CONFIGS[achievementType];
  if (!config) return currentProgress; // 如果配置不存在，返回原进度
  
  let newCurrentTier = currentProgress.currentTier;
  
  // 检查是否有新完成的档位
  // 如果 currentTier = -1，从 0 开始检查；否则从 currentTier + 1 开始检查
  const startIndex = currentProgress.currentTier === -1 ? 0 : currentProgress.currentTier + 1;
  
  for (let i = startIndex; i < config.thresholds.length; i++) {
    if (count >= config.thresholds[i]) {
      newCurrentTier = i;
    } else {
      break; // 档位是按顺序的，如果当前档位未完成，后续也不会完成
    }
  }
  
  return {
    ...currentProgress,
    currentTier: newCurrentTier
  };
};

// 获取成就奖励（支持动态奖励）
export const getAchievementReward = (achievementType: AchievementType, tier: number): number => {
  const config = ACHIEVEMENT_CONFIGS[achievementType];
  if (!config) return 0;
  
  if (typeof config.reward === 'function') {
    return config.reward(config.thresholds[tier]);
  }
  return config.reward;
};

// 获取可领取的档位列表
export const getClaimableTiers = (
  progress: AchievementProgress
): number[] => {
  const claimable: number[] = [];
  for (let i = 0; i <= progress.currentTier; i++) {
    if (!progress.claimedTiers.includes(i)) {
      claimable.push(i);
    }
  }
  return claimable;
};

// 检查是否有可领取的成就
export const hasClaimableAchievements = (
  achievements: Record<AchievementType, AchievementProgress>,
  stats: Record<string, { count: number; totalScore: number }>,
  cardStats?: {
    blueCardCount: number;
    purpleCardCount: number;
    greenCardCount: number;
    superCardCount: number;
    craftGoldCount: number;
  }
): boolean => {
  const getProgressSafe = (achievementType: AchievementType): AchievementProgress => {
    return (
      achievements[achievementType] ?? {
        achievementType,
        currentTier: -1,
        claimedTiers: [],
      }
    );
  };

  // 检查牌型成就
  const handTypes: HandType[] = [
    'one_pair',
    'two_pairs',
    'three_of_a_kind',
    'straight',
    'flush',
    'full_house',
    'four_of_a_kind',
    'five_of_a_kind',
    'straight_flush',
    'royal_flush'
  ];
  
  const hasClaimableHandType = handTypes.some(handType => {
    const config = ACHIEVEMENT_CONFIGS[handType];
    if (!config) return false;
    
    const progress = getProgressSafe(handType);
    
    const stat = stats[handType] || { count: 0, totalScore: 0 };
    const currentCount = stat.count;
    
    // 实现A：按顺序领取时，只有“第一个未领取档位”可能可领取
    let firstUnclaimedTier = -1;
    for (let tier = 0; tier < config.thresholds.length; tier++) {
      if (!progress.claimedTiers.includes(tier)) {
        firstUnclaimedTier = tier;
        break;
      }
    }
    if (firstUnclaimedTier === -1) return false;
    return currentCount >= config.thresholds[firstUnclaimedTier];
  });
  
  if (hasClaimableHandType) return true;
  
  // 检查新成就类型
  if (!cardStats) return false;
  
  const newAchievementTypes: AchievementType[] = [
    'super_card_count',
    'blue_card_count',
    'purple_card_count',
    'green_card_count',
    'craft_gold_count'
  ];
  
  return newAchievementTypes.some(achievementType => {
    const config = ACHIEVEMENT_CONFIGS[achievementType];
    if (!config) return false;
    
    const progress = getProgressSafe(achievementType);
    
    let currentCount = 0;
    
    switch (achievementType) {
      case 'super_card_count':
        currentCount = cardStats.superCardCount;
        break;
      case 'blue_card_count':
        currentCount = cardStats.blueCardCount;
        break;
      case 'purple_card_count':
        currentCount = cardStats.purpleCardCount;
        break;
      case 'green_card_count':
        currentCount = cardStats.greenCardCount;
        break;
      case 'craft_gold_count':
        currentCount = cardStats.craftGoldCount;
        break;
    }
    
    // 实现A：按顺序领取时，只有“第一个未领取档位”可能可领取
    let firstUnclaimedTier = -1;
    for (let tier = 0; tier < config.thresholds.length; tier++) {
      if (!progress.claimedTiers.includes(tier)) {
        firstUnclaimedTier = tier;
        break;
      }
    }
    if (firstUnclaimedTier === -1) return false;
    return currentCount >= config.thresholds[firstUnclaimedTier];
  });
};

