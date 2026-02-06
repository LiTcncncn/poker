import { HandType } from '../types/poker';

// 成就类型
export type AchievementType = 
  | HandType  // 牌型成就
  | 'super_card_count'      // 超级牌数量
  | 'blue_card_count'        // 蓝牌数量
  | 'purple_card_count'       // 紫牌数量
  | 'green_card_count'        // 绿牌数量
  | 'craft_blue_count'        // 合成蓝卡次数
  | 'craft_purple_count';     // 合成紫卡次数

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

// 成就配置表
export const ACHIEVEMENT_CONFIGS: Partial<Record<AchievementType, AchievementConfig>> = {
  // 牌型成就 - 使用增量值
  one_pair: {
    achievementType: 'one_pair',
    reward: 20, // 30 / 0.6 * 0.4 = 20
    // 100档：前50档（1,9,10×28,20×20），后50档（30×50）
    incrementalThresholds: [
      1, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
      // 新增50档，每档30
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  two_pairs: {
    achievementType: 'two_pairs',
    reward: 20, // 30 / 0.6 * 0.4 = 20
    // 80档：前30档（1,7,8×28），后50档（20×50）
    incrementalThresholds: [
      1, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      // 新增50档，每档20
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  three_of_a_kind: {
    achievementType: 'three_of_a_kind',
    reward: 40, // 60 / 0.6 * 0.4 = 40
    // 80档：前30档（1,4,5×28），后50档（15×50）
    incrementalThresholds: [
      1, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
      // 新增50档，每档15
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  straight: {
    achievementType: 'straight',
    reward: 80, // 120 / 0.6 * 0.4 = 80
    // 80档：前30档（1,2,3×28），后50档（15×50）
    incrementalThresholds: [
      1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 
      3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
      // 新增50档，每档15
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  flush: {
    achievementType: 'flush',
    reward: 80, // 120 / 0.6 * 0.4 = 80
    // 80档：前30档（1,2,3×28），后50档（15×50）
    incrementalThresholds: [
      1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 
      3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
      // 新增50档，每档15
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  full_house: {
    achievementType: 'full_house',
    reward: 120, // 180 / 0.6 * 0.4 = 120
    // 80档：前30档（1,2,3×28），后50档（15×50）
    incrementalThresholds: [
      1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 
      3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
      // 新增50档，每档15
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  four_of_a_kind: {
    achievementType: 'four_of_a_kind',
    reward: 200, // 300 / 0.6 * 0.4 = 200
    // 80档：前30档（1,1,2×28），后50档（15×50）
    incrementalThresholds: [
      1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 
      2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
      // 新增50档，每档15
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  straight_flush: {
    achievementType: 'straight_flush',
    reward: 400, // 600 / 0.6 * 0.4 = 400
    // 80档：前30档（1×30），后50档（10×50）
    incrementalThresholds: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      // 新增50档，每档10
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10
    ],
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  royal_flush: {
    achievementType: 'royal_flush',
    reward: 800, // 1200 / 0.6 * 0.4 = 800
    // 80档：前30档（1×30），后50档（5×50）
    incrementalThresholds: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      // 新增50档，每档5
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5
    ],
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
    reward: 20, // 30 / 0.6 * 0.4 = 20
    incrementalThresholds: generateProgressiveFixedIncremental([1, 4, 5], 10, 20), // 1, 4, 5, 10, 10, 10...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  purple_card_count: {
    achievementType: 'purple_card_count',
    reward: 40, // 60 / 0.6 * 0.4 = 40
    incrementalThresholds: generateProgressiveFixedIncremental([1, 2, 2], 5, 20), // 1, 2, 2, 5, 5, 5...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  green_card_count: {
    achievementType: 'green_card_count',
    reward: 20, // 30 / 0.6 * 0.4 = 20
    incrementalThresholds: generateProgressiveFixedIncremental([1, 4, 5, 0], 20, 20), // 1, 4, 5, 0, 20, 20, 20...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  craft_blue_count: {
    achievementType: 'craft_blue_count',
    reward: 20, // 30 / 0.6 * 0.4 = 20
    incrementalThresholds: generateProgressiveFixedIncremental([1, 2, 2], 5, 20), // 1, 2, 2, 5, 5, 5...
    get thresholds() { return convertIncrementalToCumulative(this.incrementalThresholds); }
  },
  craft_purple_count: {
    achievementType: 'craft_purple_count',
    reward: 40, // 60 / 0.6 * 0.4 = 40
    incrementalThresholds: generateProgressiveFixedIncremental([1, 1, 1], 3, 20), // 1, 1, 1, 3, 3, 3...
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
  craft_blue_count: '合成蓝卡次数',
  craft_purple_count: '合成紫卡次数',
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
    'craft_blue_count',
    'craft_purple_count'
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
    craftBlueCount: number;
    craftPurpleCount: number;
  }
): boolean => {
  // 检查牌型成就
  const handTypes: HandType[] = [
    'one_pair',
    'two_pairs',
    'three_of_a_kind',
    'straight',
    'flush',
    'full_house',
    'four_of_a_kind',
    'straight_flush',
    'royal_flush'
  ];
  
  const hasClaimableHandType = handTypes.some(handType => {
    const config = ACHIEVEMENT_CONFIGS[handType];
    if (!config) return false;
    
    const progress = achievements[handType];
    if (!progress) return false; // 确保 progress 存在
    
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
    'craft_blue_count',
    'craft_purple_count'
  ];
  
  return newAchievementTypes.some(achievementType => {
    const config = ACHIEVEMENT_CONFIGS[achievementType];
    if (!config) return false;
    
    const progress = achievements[achievementType];
    if (!progress) return false; // 确保 progress 存在
    
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
      case 'craft_blue_count':
        currentCount = cardStats.craftBlueCount;
        break;
      case 'craft_purple_count':
        currentCount = cardStats.craftPurpleCount;
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

