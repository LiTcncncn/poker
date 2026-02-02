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
    maxSingleRoundEarnings: number;
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
  'max_single_round_earnings'
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
        case 'max_single_round_earnings':
          return cardStats.maxSingleRoundEarnings;
        default:
          return 0;
      }
    }
  };
  
  // 当成就或统计更新时，触发动画
  useEffect(() => {
    const newAnimatedProgress: Record<string, number> = {};
    ALL_ACHIEVEMENT_TYPES.forEach((achievementType) => {
      const config = ACHIEVEMENT_CONFIGS[achievementType];
      if (!config) return;
      
      const progress = achievements[achievementType];
      const currentCount = getAchievementCount(achievementType);
      const currentTier = progress.currentTier;
      
      // 判断是否是最大值型成就（单回合最高收益）
      const isMaxValueAchievement = achievementType === 'max_single_round_earnings';
      
      // 计算应该显示的档位和进度
      let displayThreshold: number;
      let prevThreshold: number;
      let isCompleted: boolean;
      
      if (currentTier >= 0) {
        const isCurrentClaimed = progress.claimedTiers.includes(currentTier);
        if (isCurrentClaimed) {
          const nextTier = currentTier + 1;
          if (nextTier < config.thresholds.length) {
            displayThreshold = config.thresholds[nextTier];
            prevThreshold = nextTier > 0 ? config.thresholds[nextTier - 1] : 0;
            isCompleted = currentCount >= displayThreshold;
          } else {
            displayThreshold = config.thresholds[currentTier];
            prevThreshold = currentTier > 0 ? config.thresholds[currentTier - 1] : 0;
            isCompleted = true;
          }
        } else {
          displayThreshold = config.thresholds[currentTier];
          prevThreshold = currentTier > 0 ? config.thresholds[currentTier - 1] : 0;
          isCompleted = currentCount >= displayThreshold;
        }
      } else {
        displayThreshold = config.thresholds[0];
        prevThreshold = 0;
        isCompleted = currentCount >= displayThreshold;
      }
      
      // 计算进度百分比
      // 对于最大值型成就：未达成时进度条为0%，达成时进度条为100%
      // 对于累积型成就：显示当前级别内的进度百分比
      let progressPercent: number;
      if (isMaxValueAchievement) {
        progressPercent = isCompleted ? 100 : 0;
      } else {
        // 确定当前显示的档位
        let displayTierForProgress = 0;
        if (currentTier >= 0) {
          const isCurrentClaimed = progress.claimedTiers.includes(currentTier);
          displayTierForProgress = isCurrentClaimed ? (currentTier + 1 < config.thresholds.length ? currentTier + 1 : currentTier) : currentTier;
        }
        // 使用增量值作为需求数
        const tierIncremental = config.incrementalThresholds ? config.incrementalThresholds[displayTierForProgress] : (displayThreshold - prevThreshold);
        const currentTierProgress = Math.max(0, currentCount - prevThreshold);
        progressPercent = tierIncremental > 0 
          ? Math.min(100, (currentTierProgress / tierIncremental) * 100) 
          : 0;
      }
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
            {ALL_ACHIEVEMENT_TYPES.map((achievementType) => {
              const config = ACHIEVEMENT_CONFIGS[achievementType];
              if (!config) return null;
              
              const progress = achievements[achievementType];
              const currentCount = getAchievementCount(achievementType);
              
              // 获取当前档位和下一档位
              const currentTier = progress.currentTier;
              const nextTier = currentTier + 1;
              
              // 判断当前应该显示的档位
              let displayTier: number;
              let displayThreshold: number;
              let prevThreshold: number; // 上一档的要求
              let displayCurrentValue: number; // 当前级别内已完成数（用于显示）
              let displayTargetValue: number; // 当前级别需求数（用于显示）
              let isCompleted: boolean;
              let isClaimable: boolean;
              
              // 判断是否是最大值型成就（单回合最高收益）
              const isMaxValueAchievement = achievementType === 'max_single_round_earnings';
              
              if (currentTier >= 0) {
                // 已完成至少一档，检查是否已领取
                const isCurrentClaimed = progress.claimedTiers.includes(currentTier);
                if (isCurrentClaimed) {
                  // 当前档已领取，显示下一档
                  if (nextTier < config.thresholds.length) {
                    displayTier = nextTier;
                    displayThreshold = config.thresholds[nextTier];
                    // 上一档就是当前已领取的档位
                    prevThreshold = config.thresholds[currentTier];
                    isCompleted = currentCount >= displayThreshold;
                    // 对于累积型成就：显示当前级别内已完成数/当前级别需求数
                    // 对于最大值型成就：未达成时显示0/目标值
                    if (isMaxValueAchievement) {
                      displayCurrentValue = isCompleted ? currentCount : 0;
                      displayTargetValue = displayThreshold;
                    } else {
                      // 当前级别内已完成数 = 当前累计数 - 上一档累计要求
                      const tierIncremental = config.incrementalThresholds[displayTier] || (displayThreshold - prevThreshold);
                      const currentTierProgress = Math.max(0, currentCount - prevThreshold);
                      // 如果已完成该档位，显示该档位的增量值（已完成）；否则显示实际进度
                      if (isCompleted) {
                        displayCurrentValue = tierIncremental;
                      } else {
                        displayCurrentValue = currentTierProgress;
                      }
                      // 当前级别需求数 = 直接使用增量值
                      displayTargetValue = tierIncremental;
                    }
                    isClaimable = isCompleted && !progress.claimedTiers.includes(displayTier);
                  } else {
                    // 所有档位都完成了，显示最后一档的进度（但已完成）
                    displayTier = currentTier;
                    displayThreshold = config.thresholds[currentTier];
                    prevThreshold = currentTier > 0 ? config.thresholds[currentTier - 1] : 0;
                    isCompleted = true;
                    // 对于累积型成就：显示当前级别内已完成数/当前级别需求数
                    // 对于最大值型成就：显示当前值/目标值
                    if (isMaxValueAchievement) {
                      displayCurrentValue = currentCount;
                      displayTargetValue = displayThreshold;
                    } else {
                      // 如果当前累计数超过了最后一档，显示最后一档的增量值作为目标
                      const lastTierIncremental = config.incrementalThresholds[currentTier] || (displayThreshold - prevThreshold);
                      displayCurrentValue = lastTierIncremental; // 显示已完成该档位的增量值
                      displayTargetValue = lastTierIncremental;
                    }
                    isClaimable = false;
                  }
                } else {
                  // 当前档未领取，显示当前档
                  displayTier = currentTier;
                  displayThreshold = config.thresholds[currentTier];
                  prevThreshold = currentTier > 0 ? config.thresholds[currentTier - 1] : 0;
                  isCompleted = currentCount >= displayThreshold;
                  // 对于累积型成就：显示当前级别内已完成数/当前级别需求数
                  // 对于最大值型成就：未达成时显示0/目标值
                  if (isMaxValueAchievement) {
                    displayCurrentValue = isCompleted ? currentCount : 0;
                    displayTargetValue = displayThreshold;
                  } else {
                    // 当前级别内已完成数 = 当前累计数 - 上一档累计要求
                    displayCurrentValue = Math.max(0, currentCount - prevThreshold);
                    // 当前级别需求数 = 直接使用增量值
                    displayTargetValue = config.incrementalThresholds[displayTier] || (displayThreshold - prevThreshold);
                  }
                  isClaimable = isCompleted;
                }
              } else {
                // 尚未完成任何档位，显示第一档
                displayTier = 0;
                displayThreshold = config.thresholds[0];
                prevThreshold = 0;
                isCompleted = currentCount >= displayThreshold;
                // 对于累积型成就：显示当前级别内已完成数/当前级别需求数
                // 对于最大值型成就：未达成时显示0/目标值
                if (isMaxValueAchievement) {
                  displayCurrentValue = isCompleted ? currentCount : 0;
                  displayTargetValue = displayThreshold;
                } else {
                  // 第一档：当前级别内已完成数 = 当前累计数（因为上一档是0）
                  displayCurrentValue = currentCount;
                  // 第一档：当前级别需求数 = 直接使用增量值
                  displayTargetValue = config.incrementalThresholds[displayTier] || displayThreshold;
                }
                isClaimable = isCompleted;
              }
              
              // 计算进度百分比
              // 对于最大值型成就：未达成时进度条为0%，达成时进度条为100%
              // 对于累积型成就：显示当前级别内的进度百分比
              let progressPercent: number;
              if (isMaxValueAchievement) {
                progressPercent = isCompleted ? 100 : 0;
              } else {
                progressPercent = displayTargetValue > 0 
                  ? Math.min(100, (displayCurrentValue / displayTargetValue) * 100) 
                  : 0;
              }
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
