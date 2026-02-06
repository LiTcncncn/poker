import React, { useState, useEffect } from 'react';
import { X, Award, Gem } from 'lucide-react';
import clsx from 'clsx';
import { 
  ACHIEVEMENT_CONFIGS, 
  HAND_TYPE_NAMES,
  ACHIEVEMENT_TYPE_NAMES,
  AchievementProgress,
  AchievementType,
  getAchievementReward
} from '../utils/achievements';

interface AchievementViewProps {
  achievements: Record<AchievementType, AchievementProgress>;
  stats: Record<string, { count: number; totalScore: number }>;
  cardStats?: {
    blueCardCount: number;
    purpleCardCount: number;
    greenCardCount: number;
    superCardCount: number;
    craftBlueCount: number;
    craftPurpleCount: number;
  };
  onClaim: (achievementType: AchievementType, tier: number) => void;
  onClose: () => void;
}

// 所有成就类型列表
const ALL_ACHIEVEMENT_TYPES: AchievementType[] = [
  // 牌型成就
  'one_pair',
  'two_pairs',
  'three_of_a_kind',
  'straight',
  'flush',
  'full_house',
  'four_of_a_kind',
  'straight_flush',
  'royal_flush',
  // 新成就类型
  'super_card_count',
  'blue_card_count',
  'purple_card_count',
  'green_card_count',
  'craft_blue_count',
  'craft_purple_count',
];

export const AchievementView: React.FC<AchievementViewProps> = ({ 
  achievements, 
  stats,
  cardStats,
  onClaim, 
  onClose 
}) => {
  // 用于跟踪每个成就的动画进度
  const [animatedProgress, setAnimatedProgress] = useState<Record<string, number>>({});
  
  // 获取成就的当前数值
  const getAchievementCount = (achievementType: AchievementType): number => {
    if (achievementType in HAND_TYPE_NAMES) {
      // 牌型成就
      const stat = stats[achievementType] || { count: 0, totalScore: 0 };
      return stat.count;
    } else {
      // 新成就类型
      if (!cardStats) return 0;
      switch (achievementType) {
        case 'super_card_count':
          return cardStats.superCardCount;
        case 'blue_card_count':
          return cardStats.blueCardCount;
        case 'purple_card_count':
          return cardStats.purpleCardCount;
        case 'green_card_count':
          return cardStats.greenCardCount;
        case 'craft_blue_count':
          return cardStats.craftBlueCount;
        case 'craft_purple_count':
          return cardStats.craftPurpleCount;
        default:
          return 0;
      }
    }
  };

  // 是否存在“已完成且未领取”的档位（用于排序：可领取的成就排在上面）
  const hasAnyClaimableTier = (achievementType: AchievementType): boolean => {
    const config = ACHIEVEMENT_CONFIGS[achievementType];
    if (!config) return false;
    const progress = achievements[achievementType];
    if (!progress) return false;

    const currentCount = getAchievementCount(achievementType);
    // 实现A：按顺序领取时，真正“可领取”的只会是第一个未领取档位
    const firstUnclaimedTier = (() => {
      for (let tier = 0; tier < config.thresholds.length; tier++) {
        if (!progress.claimedTiers.includes(tier)) return tier;
      }
      return -1;
    })();
    if (firstUnclaimedTier === -1) return false;
    return currentCount >= config.thresholds[firstUnclaimedTier];
  };

  // 排序：有可领取的成就排在上面（其他维持原顺序）
  const sortedAchievementTypes = [...ALL_ACHIEVEMENT_TYPES].sort((a, b) => {
    const aClaimable = hasAnyClaimableTier(a);
    const bClaimable = hasAnyClaimableTier(b);
    if (aClaimable === bClaimable) return 0;
    return bClaimable ? 1 : -1;
  });
  
  // 当成就或统计更新时，触发动画
  useEffect(() => {
    const newAnimatedProgress: Record<string, number> = {};
    ALL_ACHIEVEMENT_TYPES.forEach((achievementType) => {
      const config = ACHIEVEMENT_CONFIGS[achievementType];
      if (!config) return;
      
      const progress = achievements[achievementType];
      const currentCount = getAchievementCount(achievementType);
      const currentTier = progress.currentTier;
      
      // 计算应该显示的档位和进度
      let displayThreshold: number;
      let prevThreshold: number;
      // const isCompleted: boolean; // 不再需要
      
      if (currentTier >= 0) {
        const isCurrentClaimed = progress.claimedTiers.includes(currentTier);
        if (isCurrentClaimed) {
          const nextTier = currentTier + 1;
          if (nextTier < config.thresholds.length) {
            displayThreshold = config.thresholds[nextTier];
            prevThreshold = nextTier > 0 ? config.thresholds[nextTier - 1] : 0;
            // const isCompleted = currentCount >= displayThreshold;
          } else {
            displayThreshold = config.thresholds[currentTier];
            prevThreshold = currentTier > 0 ? config.thresholds[currentTier - 1] : 0;
            // const isCompleted = true;
          }
        } else {
          displayThreshold = config.thresholds[currentTier];
          prevThreshold = currentTier > 0 ? config.thresholds[currentTier - 1] : 0;
          // const isCompleted = currentCount >= displayThreshold;
        }
      } else {
        displayThreshold = config.thresholds[0];
        prevThreshold = 0;
        // const isCompleted = currentCount >= displayThreshold;
      }
      
      // 计算进度百分比（累积型）
      // 确定当前显示的档位
      let displayTierForProgress = 0;
      if (currentTier >= 0) {
        const isCurrentClaimed = progress.claimedTiers.includes(currentTier);
        displayTierForProgress = isCurrentClaimed
          ? (currentTier + 1 < config.thresholds.length ? currentTier + 1 : currentTier)
          : currentTier;
      }
      // 使用增量值作为需求数
      const tierIncremental = config.incrementalThresholds
        ? config.incrementalThresholds[displayTierForProgress]
        : (displayThreshold - prevThreshold);
      const currentTierProgress = Math.max(0, currentCount - prevThreshold);
      const progressPercent = tierIncremental > 0 
        ? Math.min(100, (currentTierProgress / tierIncremental) * 100) 
        : 0;
      newAnimatedProgress[achievementType] = progressPercent;
    });
    
    // 重置动画，然后触发增长动画
    setAnimatedProgress({});
    setTimeout(() => {
      setAnimatedProgress(newAnimatedProgress);
    }, 50);
  }, [achievements, stats, cardStats]);
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">成就系统</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
          </button>
        </div>

        {/* Content - 纵向列表 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            {sortedAchievementTypes.map((achievementType) => {
              const config = ACHIEVEMENT_CONFIGS[achievementType];
              if (!config) return null;
              
              const progress = achievements[achievementType];
              const currentCount = getAchievementCount(achievementType);
              
              // 实现A：按顺序领取 -> 永远展示“第一个未领取档位”
              const firstUnclaimedTier = (() => {
                for (let tier = 0; tier < config.thresholds.length; tier++) {
                  if (!progress.claimedTiers.includes(tier)) return tier;
                }
                return -1; // 全部已领取
              })();

              // 判断当前应该显示的档位
              let displayTier: number;
              let displayThreshold: number;
              let prevThreshold: number; // 上一档的要求
              let displayCurrentValue: number; // 当前级别内已完成数（用于显示）
              let displayTargetValue: number; // 当前级别需求数（用于显示）
              let isCompleted: boolean;
              let isClaimable: boolean;
              
              if (firstUnclaimedTier === -1) {
                // 全部已领取：展示最后一档（已完成）
                displayTier = config.thresholds.length - 1;
                displayThreshold = config.thresholds[displayTier];
                prevThreshold = displayTier > 0 ? config.thresholds[displayTier - 1] : 0;
                isCompleted = true;
                const tierIncremental = config.incrementalThresholds[displayTier] || (displayThreshold - prevThreshold);
                displayCurrentValue = tierIncremental;
                displayTargetValue = tierIncremental;
                isClaimable = false;
              } else {
                displayTier = firstUnclaimedTier;
                displayThreshold = config.thresholds[displayTier];
                prevThreshold = displayTier > 0 ? config.thresholds[displayTier - 1] : 0;
                isCompleted = currentCount >= displayThreshold;

                const tierIncremental = config.incrementalThresholds[displayTier] || (displayThreshold - prevThreshold);
                const currentTierProgress = Math.max(0, currentCount - prevThreshold);
                displayCurrentValue = isCompleted ? tierIncremental : currentTierProgress;
                displayTargetValue = tierIncremental;

                // 第一个未领取档位达成 -> 才能领取（与 store 的“禁止跨档领取”一致）
                isClaimable = isCompleted;
              }
              
              // 计算进度百分比
              // 累积型成就：显示当前级别内的进度百分比
              const progressPercent = displayTargetValue > 0 
                ? Math.min(100, (displayCurrentValue / displayTargetValue) * 100) 
                : 0;
              const animatedWidth = animatedProgress[achievementType] !== undefined ? animatedProgress[achievementType] : progressPercent;
              
              // 获取奖励
              const reward = getAchievementReward(achievementType, displayTier);
              
              return (
                <div
                  key={achievementType}
                  className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border-2 border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* 左侧：成就名称 */}
                    <div className="flex-shrink-0 w-20 sm:w-24">
                      <div className="text-sm sm:text-base font-bold text-slate-200">
                        {ACHIEVEMENT_TYPE_NAMES[achievementType]}
                      </div>
                    </div>
                    
                    {/* 中间：进度信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <span className="text-sm sm:text-base font-bold text-slate-200">
                          {displayCurrentValue} / {displayTargetValue}
                        </span>
                      </div>
                      {/* 进度条 */}
                      <div className="w-full h-2 sm:h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500 ease-out"
                          style={{ width: `${animatedWidth}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* 右侧：领取按钮 */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => {
                          if (isClaimable) {
                            onClaim(achievementType, displayTier);
                          }
                        }}
                        disabled={!isClaimable}
                        className={clsx(
                          "w-16 sm:w-20 py-1.5 sm:py-2 rounded-lg font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-1",
                          isClaimable
                            ? "bg-yellow-500 hover:bg-yellow-600 text-black cursor-pointer"
                            : "bg-slate-700 text-slate-500 cursor-not-allowed"
                        )}
                      >
                        <span>{reward}</span>
                        <Gem className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
