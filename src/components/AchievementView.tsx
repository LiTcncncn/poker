import React from 'react';
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
    craftGoldCount: number;
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
  'five_of_a_kind',
  'straight_flush',
  'royal_flush',
  // 新成就类型
  'super_card_count',
  'blue_card_count',
  'purple_card_count',
  'green_card_count',
  'craft_gold_count',
];

export const AchievementView: React.FC<AchievementViewProps> = ({ 
  achievements, 
  stats,
  cardStats,
  onClaim, 
  onClose 
}) => {
  const getProgressSafe = (achievementType: AchievementType): AchievementProgress => {
    return (
      achievements[achievementType] ?? {
        achievementType,
        currentTier: -1,
        claimedTiers: [],
      }
    );
  };

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
        case 'craft_gold_count':
          return cardStats.craftGoldCount;
        default:
          return 0;
      }
    }
  };

  // 是否存在“已完成且未领取”的档位（用于排序：可领取的成就排在上面）
  const hasAnyClaimableTier = (achievementType: AchievementType): boolean => {
    const config = ACHIEVEMENT_CONFIGS[achievementType];
    if (!config) return false;
    const progress = getProgressSafe(achievementType);

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

  // 排序：可领取置顶，但保持原始相对顺序（稳定排序）
  const sortedAchievementTypes = ALL_ACHIEVEMENT_TYPES
    .map((t, idx) => ({ t, idx, claimable: hasAnyClaimableTier(t) }))
    .sort((a, b) => {
      if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
      return a.idx - b.idx;
    })
    .map(x => x.t);
  
  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-view-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-600/50 bg-slate-900/35 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <Award className="h-7 w-7 shrink-0 text-yellow-400 sm:h-8 sm:w-8" aria-hidden />
          <h2
            id="achievement-view-title"
            className="text-2xl font-bold text-slate-100 sm:text-3xl"
          >
            成就系统
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-700/80"
        >
          <X className="h-6 w-6 text-slate-400" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] sm:space-y-4 sm:p-4">
            {sortedAchievementTypes.map((achievementType) => {
              const config = ACHIEVEMENT_CONFIGS[achievementType];
              if (!config) return null;
              
              const progress = getProgressSafe(achievementType);
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
              
              // 获取奖励
              const reward = getAchievementReward(achievementType, displayTier);
              
              return (
                <div
                  key={achievementType}
                  className="rounded-xl border border-slate-600/50 bg-slate-900/35 p-4 transition-colors hover:border-slate-500/60 sm:p-5"
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
                          style={{ width: `${progressPercent}%` }}
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
  );
};
