import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from './store/gameStore';
import { Card } from './components/Card';
import { DeckView } from './components/DeckView';
import { StatsView } from './components/StatsView';
import { CraftView } from './components/CraftView';
import { AchievementView } from './components/AchievementView';
import { DiamondRewardToast } from './components/DiamondRewardToast';
import { DrawAnimation } from './components/DrawAnimation';
import { Draw10Animation } from './components/Draw10Animation';
import { SuperCardUnlock } from './components/SuperCardUnlock';
import { SuperCardUnlockModal } from './components/SuperCardUnlockModal';
import { GameStartScreen } from './components/GameStartScreen';
import { TutorialCompleteScreen } from './components/TutorialCompleteScreen';
import { Coins, Zap, Trophy, BarChart3, LayoutGrid, Wand2, Gem, ShoppingBag } from 'lucide-react';
import { DrawView } from './components/DrawView';
import { Card as CardType } from './types/poker';
import clsx from 'clsx';
import { hasClaimableAchievements, ACHIEVEMENT_CONFIGS } from './utils/achievements';

// 牌型图片映射
const BASE_URL = import.meta.env.BASE_URL;
const HAND_TYPE_IMAGES: Record<string, string> = {
  'one_pair': `${BASE_URL}pokers/1 Pair.png`,
  'two_pairs': `${BASE_URL}pokers/2 Pairs.png`,
  'three_of_a_kind': `${BASE_URL}pokers/3 of a Kind.png`,
  'four_of_a_kind': `${BASE_URL}pokers/4 of a Kind.png`,
  'straight': `${BASE_URL}pokers/Straight.png`,
  'flush': `${BASE_URL}pokers/Flush.png`,
  'full_house': `${BASE_URL}pokers/Full House.png`,
  'straight_flush': `${BASE_URL}pokers/Straight Flush.png`,
  'royal_flush': `${BASE_URL}pokers/Royal Flush.png`,
};

// 牌型等级判断
type HandTier = 'common' | 'rare' | 'epic' | 'legendary';

const getHandTier = (type: string): HandTier => {
  if (type === 'royal_flush' || type === 'straight_flush' || type === 'five_of_a_kind' || type === 'six_of_a_kind' || type === 'seven_of_a_kind') return 'legendary';
  if (type === 'four_of_a_kind' || type === 'full_house') return 'epic';
  if (type === 'straight' || type === 'flush' || type === 'three_of_a_kind') return 'rare';
  return 'common';
};

// 根据等级返回不同的动画类名
const getHandImageClasses = (type: string): string => {
  const tier = getHandTier(type);
  const baseClasses = "h-10 sm:h-16 mb-1 sm:mb-3 object-contain animate-hand-bounce-in";
  
  switch (tier) {
    case 'legendary':
      return `${baseClasses} animate-hand-legendary`;
    case 'epic':
      return `${baseClasses} animate-hand-epic`;
    case 'rare':
      return `${baseClasses} animate-hand-rare`;
    case 'common':
      return `${baseClasses} animate-hand-common`;
    default:
      return baseClasses;
  }
};

// 判断是否需要流光效果包装
const needsShimmerWrapper = (type: string): boolean => {
  return getHandTier(type) === 'legendary';
};

function App() {
  const { 
    money, 
    diamonds,
    flipsRemaining, 
    maxFlips, 
    currentHand, 
    isFlipped, 
    handResult,
    activeDeck,
    reserveDeck,
    getAllCards,
    bestHands,
    stats,
    achievements,
    flipCards, 
    resetHand,
    drawCard,
    draw10Cards,
    drawsSincePurple,
    craftBlueCard,
    craftPurpleCard,
    recoverEnergy,
    isAutoFlipping,
    toggleAutoFlip,
    getRecoveryProgress,
    tutorialStage,
    unlockedCardSlots,
    unlockCardSlot,
    getUnlockCost,
    resetGame,
    getAutoFlipDuration,
    getCardCount,
    dailyEarnings,
    claimAchievement,
    blueCardCount,
    purpleCardCount,
    greenCardCount,
    superCardUnlockedCount,
    craftBlueCount,
    craftPurpleCount,
    // Video Poker 模式
    isVideoPokerMode,
    vpokerHeldCards,
    vpokerReplaced,
    flipVPokerCards,
    toggleVPokerHold,
    replaceVPokerCards,
    resetVPokerState,
    setFlipped
  } = useGameStore();
  
  // 获取总牌池（用于显示和合成）
  const allCards = getAllCards();

  const [showDeck, setShowDeck] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCraft, setShowCraft] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [diamondRewardQueue, setDiamondRewardQueue] = useState<number[]>([]);
  const [currentDiamondReward, setCurrentDiamondReward] = useState<number | null>(null);
  const [diamondRewardKey, setDiamondRewardKey] = useState(0);
  // const [showDrawAnimation, setShowDrawAnimation] = useState(false); // Removed simple overlay state
  const [drawnCard, setDrawnCard] = useState<CardType | null>(null); // New state for draw animation
  const [drawn10Cards, setDrawn10Cards] = useState<CardType[]>([]); // 10 连抽卡牌
  const [recoveryProgress, setRecoveryProgress] = useState(0);
  const [showResult, setShowResult] = useState(false); // 控制结算区显示
  const [isManualFlip, setIsManualFlip] = useState(false); // 标记是否为手动翻牌
  const [showScoringAnimation, setShowScoringAnimation] = useState(false); // 控制中牌上移动画
  const [unlockedSuperCard, setUnlockedSuperCard] = useState<{ cardIndex: number; suit: string; rank: number } | null>(null); // 解锁的超级扑克牌信息
  const [showGameStart, setShowGameStart] = useState(true); // 显示游戏初始界面
  const [showTutorialComplete, setShowTutorialComplete] = useState(false); // 显示前置阶段完成界面
  const [chartRecords, setChartRecords] = useState<number[]>(dailyEarnings.records); // 延迟更新的心电图数据
  const [chartHandCount, setChartHandCount] = useState(dailyEarnings.handCount); // 延迟更新的心电图手数

  // 初始化恢复进度
  useEffect(() => {
    setRecoveryProgress(getRecoveryProgress());
  }, [getRecoveryProgress]);

  useEffect(() => {
    const interval = setInterval(() => {
        recoverEnergy();
        // 更新恢复进度
        setRecoveryProgress(getRecoveryProgress());
    }, 100); // 每100ms更新一次，让进度条更流畅
    return () => clearInterval(interval);
  }, [recoverEnergy, getRecoveryProgress]);

  // 自动翻牌流程：使用技能系统动态时长（仅普通模式）
  useEffect(() => {
      if (!isAutoFlipping || flipsRemaining <= 0 || isVideoPokerMode) {
          return; // VPoker 模式不支持自动翻牌
      }

      const totalDuration = getAutoFlipDuration(); // 获取总时长（基础6秒，受技能影响）
      const cardBackDuration = 1000; // 显示牌背 1秒
      const resultDuration = totalDuration - cardBackDuration; // 剩余时间用于显示结果

      let timeout1: number;
      let timeout2: number;

      if (!isFlipped) {
          // 阶段1：显示牌背
          timeout1 = window.setTimeout(() => {
              // 阶段2：翻牌（瞬间）
              flipCards();
          }, cardBackDuration);
      } else {
          // 阶段3：显示结果+动画
          timeout2 = window.setTimeout(() => {
              setShowResult(false);
              setShowScoringAnimation(false);
              setIsManualFlip(false);
              resetHand();
          }, resultDuration);
      }

      return () => {
          clearTimeout(timeout1);
          clearTimeout(timeout2);
      };
  }, [isAutoFlipping, flipsRemaining, isFlipped, isVideoPokerMode, flipCards, resetHand, getAutoFlipDuration]);

  // VPoker 换牌后触发翻牌动画和结算
  useEffect(() => {
    if (isVideoPokerMode && vpokerReplaced && !isFlipped && currentHand.length > 0) {
      // 换牌后，延迟触发翻牌动画（让新卡先渲染为未翻牌状态）
      const timer1 = setTimeout(() => {
        setFlipped(true); // 触发翻牌动画
      }, 100);
      
      // 翻牌动画完成后，触发结算动画（等待翻牌动画完成，约 500ms）
      const timer2 = setTimeout(() => {
        setShowResult(true);
        setShowScoringAnimation(true);
        setIsManualFlip(true);
      }, 800); // 等待翻牌动画完成（500ms）+ 停顿（300ms）
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isVideoPokerMode, vpokerReplaced, isFlipped, currentHand.length, setFlipped]);

  // 根据超级牌解锁数量自动切换VPoker模式
  useEffect(() => {
    // 如果超级牌数量不足4张，但当前是VPoker模式，需要切换回普通模式
    if (superCardUnlockedCount < 4 && isVideoPokerMode && !isFlipped) {
      resetVPokerState();
    }
  }, [superCardUnlockedCount, isVideoPokerMode, isFlipped, resetVPokerState]);

  // 手动翻牌流程控制：翻牌 -> 停顿 -> 中牌上移和结算区砸落同时
  useEffect(() => {
    if (!isManualFlip || !isFlipped || !handResult) {
      return;
    }

    // 流程时序：
    // 1. 牌翻转完成（isFlipped 变为 true）- 立即
    // 2. 停顿（0.8秒）
    // 3. 中牌上移和结算区砸落同时开始
    const timer = setTimeout(() => {
      setShowScoringAnimation(true); // 开始中牌上移
      setShowResult(true); // 开始结算区砸落
    }, 800); // 停顿0.8秒，然后中牌上移和结算区砸落同时进行

    return () => clearTimeout(timer);
  }, [isManualFlip, isFlipped, handResult]);

  // 自动翻牌时，立即显示中牌上移和结算区
  useEffect(() => {
    if (isAutoFlipping && isFlipped && handResult) {
      setShowScoringAnimation(true);
      setShowResult(true);
    }
  }, [isAutoFlipping, isFlipped, handResult]);

  // 初始化心电图数据（只在组件挂载时）
  useEffect(() => {
    setChartRecords(dailyEarnings.records);
    setChartHandCount(dailyEarnings.handCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时初始化

  // 当结算动画完成（showResult为true）时，更新心电图数据，并处理钻石奖励
  useEffect(() => {
    if (showResult && handResult) {
      // 结算动画完成，更新心电图数据
      setChartRecords(dailyEarnings.records);
      setChartHandCount(dailyEarnings.handCount);
      
      // 如果有钻石奖励，添加到队列
      if (handResult.diamondReward && handResult.diamondReward > 0) {
        setDiamondRewardQueue(prev => [...prev, handResult.diamondReward!]);
      }
    }
  }, [showResult, handResult, dailyEarnings.records, dailyEarnings.handCount]);

  // 检查是否已经看过初始界面（从localStorage）
  useEffect(() => {
    const hasSeenStartScreen = localStorage.getItem('hasSeenGameStart');
    if (hasSeenStartScreen === 'true') {
      setShowGameStart(false);
    }
  }, []);

  // 监听解锁5张牌，显示完成界面
  useEffect(() => {
    // 当解锁5张牌且还在前置阶段时，显示完成界面
    if (unlockedCardSlots === 5 && tutorialStage === 'pre' && !showTutorialComplete) {
      // 检查是否已经显示过完成界面（避免重复显示）
      const hasSeenComplete = sessionStorage.getItem('hasSeenTutorialComplete');
      if (!hasSeenComplete) {
        // 延迟一点显示，确保解锁动画完成
        const timer = setTimeout(() => {
          setShowTutorialComplete(true);
          sessionStorage.setItem('hasSeenTutorialComplete', 'true');
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [unlockedCardSlots, tutorialStage, showTutorialComplete]);

  // 钻石奖励队列处理：如果当前没有显示的奖励，且队列中有待显示的奖励，则显示下一个
  useEffect(() => {
    if (currentDiamondReward === null && diamondRewardQueue.length > 0) {
      const nextReward = diamondRewardQueue[0];
      setCurrentDiamondReward(nextReward);
      setDiamondRewardQueue(prev => prev.slice(1));
      setDiamondRewardKey(prev => prev + 1); // 更新 key 以强制重新渲染
    }
  }, [currentDiamondReward, diamondRewardQueue]);

  // 统一的翻牌按钮点击处理
  const handleMainClick = () => {
    // 根据超级牌数量决定使用哪种模式
    const shouldUseVPoker = superCardUnlockedCount >= 4;
    
    if (isFlipped) {
      // 已翻牌状态
      if (shouldUseVPoker && isVideoPokerMode) {
        // VPoker模式
        if (vpokerReplaced) {
          // 已经换牌并结算，点击下一手
          setShowResult(false);
          setShowScoringAnimation(false);
          setIsManualFlip(false);
          resetVPokerState();
        } else {
          // 翻牌后，点击换牌
          replaceVPokerCards();
          // 换牌动画和结算会在 useEffect 中处理
        }
      } else {
        // 普通模式，点击下一手
        setShowResult(false);
        setShowScoringAnimation(false);
        setIsManualFlip(false);
        resetHand();
      }
    } else {
      // 未翻牌状态，点击翻牌
      setIsManualFlip(true);
      setShowResult(false);
      setShowScoringAnimation(false);
      
      if (shouldUseVPoker) {
        // 使用VPoker模式翻牌
        flipVPokerCards();
      } else {
        // 使用普通模式翻牌
        flipCards();
      }
    }
  };

  const handleDrawCard = () => {
      const newCard = drawCard();
      if (newCard) {
          setDrawnCard(newCard);
      }
  };

  const handleDraw10Cards = () => {
      const cards = draw10Cards();
      if (cards.length > 0) {
          setDrawn10Cards(cards);
      }
  };

  const handleDrawComplete = useCallback(() => {
      setDrawnCard(null);
  }, []);


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* 顶部通栏：资源栏 */}
      <div className="w-full bg-slate-800 border-b border-slate-700 px-2 sm:px-4 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4 sm:gap-6 md:gap-8">
          {/* 金钱 */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 sm:gap-2 text-yellow-400">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-base sm:text-xl font-bold font-mono">${money}</span>
            </div>
          </div>
          
          {/* 钻石 */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 sm:gap-2 text-cyan-400">
              <Gem className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-base sm:text-xl font-bold font-mono">{diamonds}</span>
            </div>
          </div>
          
          {/* 体力 */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 sm:gap-2 text-blue-400">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-base sm:text-xl font-bold font-mono">{flipsRemaining}/{maxFlips}</span>
            </div>
            <div className="w-20 sm:w-32 h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-100" 
                style={{ width: `${recoveryProgress * 100}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col justify-end items-center w-full max-w-6xl mx-auto gap-4 sm:gap-6 px-2 sm:px-4 pb-4 sm:pb-8">
        
        {/* 超级牌区 - 中牌弹版上方，移动端上移 */}
        {tutorialStage === 'complete' && (
          <div className="flex justify-center mb-2 sm:mb-4 transform -translate-y-[30px] sm:translate-y-0">
            <SuperCardUnlock 
              onUnlock={(cardIndex, suit, rank) => {
                setUnlockedSuperCard({ cardIndex, suit, rank });
              }}
            />
          </div>
        )}

        {/* Result Display */}
        <div className="h-16 sm:h-24 flex flex-col items-center justify-center -mt-8 sm:-mt-10">
            {handResult && isFlipped && showResult ? (
                <div className={clsx(
                    "flex flex-col items-center",
                    isManualFlip && "animate-result-drop-in"
                )}>
                    {handResult.type !== 'high_card' && HAND_TYPE_IMAGES[handResult.type] ? (
                        needsShimmerWrapper(handResult.type) ? (
                            <div className="relative animate-hand-shimmer">
                                <img 
                                    src={HAND_TYPE_IMAGES[handResult.type]} 
                                    alt={handResult.name}
                                    className={getHandImageClasses(handResult.type)}
                                />
                            </div>
                        ) : (
                            <img 
                                src={HAND_TYPE_IMAGES[handResult.type]} 
                                alt={handResult.name}
                                className={getHandImageClasses(handResult.type)}
                            />
                        )
                    ) : (
                        <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent mb-2 sm:mb-3">
                            {handResult.type === 'high_card' ? 'High Card' : handResult.name}
                        </h2>
                    )}
                    <div className="flex items-baseline gap-2 text-xl sm:text-2xl text-slate-300 -mt-[10px] sm:mt-0">
                        <span>${handResult.score.toLocaleString()}</span>
                        <span className="text-xl sm:text-2xl text-slate-300">
                            (基础 x{handResult.baseMultiplier} 
                            {handResult.bonusMultiplier > 0 && ` + 加成 x${handResult.bonusMultiplier}`})
                        </span>
                    </div>
                </div>
            ) : (
                <div className="text-slate-600 text-lg sm:text-xl font-medium animate-pulse">
                    {flipsRemaining > 0 ? '点击翻牌' : '体力恢复中...'}
                </div>
            )}
        </div>

        {/* Cards Container */}
        <div 
            className="flex gap-1.5 sm:gap-4 perspective-1000 justify-center"
            onClick={superCardUnlockedCount >= 4 && isVideoPokerMode && isFlipped && !vpokerReplaced ? undefined : handleMainClick}
        >
          {currentHand.length > 0 ? (
            currentHand.map((card, index) => {
              const cardCount = getCardCount();
              // 根据牌数动态调整大小（移动端按比例缩小）
              let mobileWidth = '18vw';
              let mobileHeight = '25.2vw';
              let mobileMaxWidth = 80; // 20 * 4 = 80px
              let mobileMaxHeight = 112; // 28 * 4 = 112px
              
              if (cardCount === 6) {
                mobileWidth = '15vw';
                mobileHeight = '21vw';
                mobileMaxWidth = 64; // 16 * 4 = 64px
                mobileMaxHeight = 96; // 24 * 4 = 96px
              } else if (cardCount === 7) {
                mobileWidth = '13vw';
                mobileHeight = '18.2vw';
                mobileMaxWidth = 56; // 14 * 4 = 56px
                mobileMaxHeight = 80; // 20 * 4 = 80px
              }
              
              // 计算基础字体大小比例（相对于5张牌）
              const fontSizeRatio = cardCount <= 5 ? 1 : cardCount === 6 ? 15/18 : 13/18;
              
              // VPoker 模式下，判断是否被 Hold（需要解锁4张超级牌）
              const shouldUseVPoker = superCardUnlockedCount >= 4;
              const isHeld = shouldUseVPoker && isVideoPokerMode && isFlipped && !vpokerReplaced && vpokerHeldCards.includes(index);
              
              return (
                <div
                  key={`${card.id}-${index}`}
                  className="flex-shrink-0 sm:w-24 sm:h-36"
                  style={{
                    width: mobileWidth,
                    height: mobileHeight,
                    maxWidth: `${mobileMaxWidth}px`,
                    maxHeight: `${mobileMaxHeight}px`,
                  }}
                >
                  <Card 
                    card={card} 
                    isFlipped={isFlipped}
                    isScoring={isFlipped && handResult && showScoringAnimation ? handResult.scoringCardIds.includes(card.id) : false}
                    isHeld={isHeld}
                    onClick={shouldUseVPoker && isVideoPokerMode && isFlipped && !vpokerReplaced ? () => toggleVPokerHold(index) : undefined}
                    className={clsx(
                        "shadow-2xl hover:-translate-y-2 transition-transform duration-300",
                        isFlipped && "animate-in zoom-in-50 duration-500 fill-mode-backwards"
                    )}
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      fontSize: `${fontSizeRatio}rem` // 传递基础字体大小比例
                    }}
                  />
                </div>
              );
            })
          ) : (
              // 根据解锁数量显示对应数量的牌背占位符
              Array.from({ length: getCardCount() }).map((_, i) => {
                const cardCount = getCardCount();
                // 根据牌数动态调整大小，确保一行显示（移动端按比例缩小）
                let mobileWidth = '18vw';
                let mobileHeight = '25.2vw';
                let mobileMaxWidth = 80; // 20 * 4 = 80px
                let mobileMaxHeight = 112; // 28 * 4 = 112px
                
                if (cardCount === 6) {
                  mobileWidth = '15vw';
                  mobileHeight = '21vw';
                  mobileMaxWidth = 64; // 16 * 4 = 64px
                  mobileMaxHeight = 96; // 24 * 4 = 96px
                } else if (cardCount === 7) {
                  mobileWidth = '13vw';
                  mobileHeight = '18.2vw';
                  mobileMaxWidth = 56; // 14 * 4 = 56px
                  mobileMaxHeight = 80; // 20 * 4 = 80px
                }
                
                return (
                  <div 
                    key={i} 
                    className="rounded-xl overflow-hidden shadow-2xl cursor-pointer hover:-translate-y-2 transition-transform duration-300 flex-shrink-0 sm:w-24 sm:h-36"
                    style={{
                      width: mobileWidth,
                      height: mobileHeight,
                      maxWidth: `${mobileMaxWidth}px`,
                      maxHeight: `${mobileMaxHeight}px`,
                    }}
                  >
                    <img 
                      src={`${BASE_URL}pokers/poker_back_arena.png`}
                      alt="Card back"
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                );
              })
          )}
        </div>


        {/* Controls */}
        <div className="w-full max-w-md mt-2 sm:mt-4 px-2">
          {/* 移动端：翻牌和自动/牌+1按钮一行 */}
          <div className="flex gap-2 sm:hidden mb-2">
            <button 
              onClick={handleMainClick}
              disabled={(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 4;
                if (!isFlipped) {
                  // 未翻牌：需要体力
                  return flipsRemaining <= 0;
                }
                if (shouldUseVPoker && isVideoPokerMode) {
                  // VPoker模式：已换牌时需要showResult，未换牌时可以点击换牌
                  if (vpokerReplaced) {
                    return !showResult;
                  }
                  return false; // 可以点击换牌
                }
                // 普通模式：需要showResult
                return !showResult;
              })()}
              className={clsx(
                "flex-[8] py-3 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95",
                (() => {
                  const shouldUseVPoker = superCardUnlockedCount >= 4;
                  if (!isFlipped) return flipsRemaining > 0;
                  if (shouldUseVPoker && isVideoPokerMode) {
                    if (vpokerReplaced) return showResult;
                    return true; // 可以点击换牌
                  }
                  return showResult;
                })()
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 shadow-blue-500/20" 
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              {(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 4;
                if (!isFlipped) return "翻牌";
                if (shouldUseVPoker && isVideoPokerMode) {
                  if (vpokerReplaced) return "下一手";
                  return "换牌";
                }
                return "下一手";
              })()}
            </button>
            
            {tutorialStage === 'pre' && unlockedCardSlots < 5 ? (
              <button
                onClick={() => unlockCardSlot()}
                disabled={money < getUnlockCost()}
                className={clsx(
                  "flex-[2] py-3 rounded-xl font-bold text-base border-2 transition-all",
                  money >= getUnlockCost()
                    ? "border-green-500 text-green-400 bg-green-500/10 animate-button-pulse-strong animate-button-glow-green"
                    : "border-slate-600 text-slate-400 cursor-not-allowed"
                )}
              >
                牌+1 (${getUnlockCost()})
              </button>
            ) : (
              <button
                onClick={toggleAutoFlip}
                className={clsx(
                  "flex-[2] py-3 rounded-xl font-bold text-base border-2 transition-all",
                  isAutoFlipping 
                    ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                    : "border-slate-600 text-slate-400 hover:border-slate-500"
                )}
              >
                {isAutoFlipping ? "⏸️ 停止" : "▶️ 自动"}
              </button>
            )}
          </div>

          {/* PC端：所有按钮横向排列 */}
          <div className="hidden sm:flex gap-6 justify-center flex-wrap">
            <button 
              onClick={handleMainClick}
              disabled={(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 4;
                if (!isFlipped) {
                  // 未翻牌：需要体力
                  return flipsRemaining <= 0;
                }
                if (shouldUseVPoker && isVideoPokerMode) {
                  // VPoker模式：已换牌时需要showResult，未换牌时可以点击换牌
                  if (vpokerReplaced) {
                    return !showResult;
                  }
                  return false; // 可以点击换牌
                }
                // 普通模式：需要showResult
                return !showResult;
              })()}
              className={clsx(
                "px-8 py-4 rounded-xl font-bold text-xl shadow-lg transition-all transform active:scale-95",
                (() => {
                  const shouldUseVPoker = superCardUnlockedCount >= 4;
                  if (!isFlipped) return flipsRemaining > 0;
                  if (shouldUseVPoker && isVideoPokerMode) {
                    if (vpokerReplaced) return showResult;
                    return true; // 可以点击换牌
                  }
                  return showResult;
                })()
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 shadow-blue-500/20" 
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              {(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 4;
                if (!isFlipped) return "翻牌";
                if (shouldUseVPoker && isVideoPokerMode) {
                  if (vpokerReplaced) return "下一手";
                  return "换牌";
                }
                return "下一手";
              })()}
            </button>

            {tutorialStage === 'pre' && unlockedCardSlots < 5 ? (
              <button
                onClick={() => unlockCardSlot()}
                disabled={money < getUnlockCost()}
                className={clsx(
                  "px-8 py-4 rounded-xl font-bold text-xl border-2 transition-all",
                  money >= getUnlockCost()
                    ? "border-green-500 text-green-400 bg-green-500/10 animate-button-pulse-strong animate-button-glow-green"
                    : "border-slate-600 text-slate-400 cursor-not-allowed"
                )}
              >
                牌+1 (${getUnlockCost()})
              </button>
            ) : (
              <button
                onClick={toggleAutoFlip}
                className={clsx(
                  "px-8 py-4 rounded-xl font-bold text-xl border-2 transition-all",
                  isAutoFlipping 
                    ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                    : "border-slate-600 text-slate-400 hover:border-slate-500"
                )}
              >
                {isAutoFlipping ? "⏸️ 停止" : "▶️ 自动"}
              </button>
            )}

          </div>
        </div>
      </div>

      {/* 主导航栏 - 游戏下方 */}
      <div className="w-full bg-slate-800 border-t border-slate-700 px-2 sm:px-4 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-5 gap-2 sm:gap-4">
            {/* 牌池 */}
            <button
              onClick={() => setShowDeck(true)}
              className="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 hover:bg-slate-700 rounded-lg transition-colors relative"
              title="牌池"
            >
              <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span className="text-xs sm:text-sm text-slate-300">牌池</span>
              {activeDeck.filter(c => c === null).length > 0 && reserveDeck.length > 0 && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* 成就 */}
            <button
              onClick={() => {
                if (tutorialStage === 'complete') {
                  setShowAchievements(true);
                }
              }}
              disabled={tutorialStage !== 'complete'}
              className={clsx(
                "flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-lg transition-colors relative",
                tutorialStage === 'complete'
                  ? "hover:bg-slate-700 cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              )}
              title="成就"
            >
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span className="text-xs sm:text-sm text-slate-300">成就</span>
              {tutorialStage === 'complete' && hasClaimableAchievements(achievements, stats, {
                blueCardCount,
                purpleCardCount,
                greenCardCount,
                superCardCount: superCardUnlockedCount,
                craftBlueCount,
                craftPurpleCount
              }) && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* 抽卡 */}
            <button
              onClick={() => {
                if (tutorialStage === 'complete') {
                  setShowDraw(true);
                }
              }}
              disabled={tutorialStage !== 'complete'}
              className={clsx(
                "flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-lg transition-colors",
                tutorialStage === 'complete'
                  ? "hover:bg-slate-700 cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              )}
              title="抽卡"
            >
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span className="text-xs sm:text-sm text-slate-300">抽卡</span>
            </button>

            {/* 合成 */}
            <button
              onClick={() => setShowCraft(true)}
              className="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 hover:bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg transition-all relative"
              title="合成"
            >
              <Wand2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              <span className="text-xs sm:text-sm text-slate-300">合成</span>
              {allCards.filter(c => c.quality === 'green').length >= 10 && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-purple-400 rounded-full animate-pulse" />
              )}
            </button>

            {/* 统计 */}
            <button
              onClick={() => setShowStats(true)}
              className="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 hover:bg-slate-700 rounded-lg transition-colors"
              title="统计"
            >
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              <span className="text-xs sm:text-sm text-slate-300">统计</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeck && <DeckView activeDeck={activeDeck} reserveDeck={reserveDeck} onClose={() => setShowDeck(false)} />}
      {showStats && (
        <StatsView 
          bestHands={bestHands} 
          stats={stats} 
          chartRecords={chartRecords}
          chartHandCount={chartHandCount}
          onClose={() => setShowStats(false)}
          onReset={() => {
            if (window.confirm('确定要重置游戏吗？这将清除所有进度和数据，包括金币、牌池、统计等。')) {
              resetGame();
              // 清除界面显示标记
              localStorage.removeItem('hasSeenGameStart');
              sessionStorage.removeItem('hasSeenTutorialComplete');
              // 重置后刷新页面以确保所有状态都更新
              window.location.reload();
            }
          }}
        />
      )}
      {showAchievements && (
        <AchievementView 
          achievements={achievements} 
          stats={stats}
          cardStats={{
            blueCardCount,
            purpleCardCount,
            greenCardCount,
            superCardCount: superCardUnlockedCount,
            craftBlueCount,
            craftPurpleCount
          }}
          onClaim={(achievementType, tier) => {
            // 获取奖励金额
            const config = ACHIEVEMENT_CONFIGS[achievementType];
            if (!config) return;
            const threshold = config.thresholds[tier];
            const reward = typeof config.reward === 'function' ? config.reward(threshold) : config.reward;
            
            // 领取成就
            const success = claimAchievement(achievementType, tier);
            if (success && reward > 0) {
              // 添加到钻石奖励队列
              setDiamondRewardQueue(prev => [...prev, reward]);
            }
          }}
          onClose={() => setShowAchievements(false)} 
        />
      )}
      
      {/* 钻石获得提示 */}
      {currentDiamondReward !== null && (
        <DiamondRewardToast 
          key={`diamond-${diamondRewardKey}`}
          amount={currentDiamondReward}
          onComplete={() => {
            setCurrentDiamondReward(null);
            // 完成后会自动触发队列中的下一个（通过 useEffect）
          }}
        />
      )}
      {showCraft && (
        <CraftView 
          allCards={allCards} 
          onClose={() => setShowCraft(false)}
          onCraftBlue={craftBlueCard}
          onCraftPurple={craftPurpleCard}
        />
      )}
      {showDraw && (
        <DrawView
          diamonds={diamonds}
          drawsSincePurple={drawsSincePurple}
          onDraw={handleDrawCard}
          onDraw10={handleDraw10Cards}
          onClose={() => setShowDraw(false)}
        />
      )}
      
      {/* Draw Animation Overlay */}
      {drawnCard && (
          <DrawAnimation 
              card={drawnCard} 
              onComplete={handleDrawComplete} 
          />
      )}

      {/* Draw 10 Animation Overlay */}
      {drawn10Cards.length > 0 && (
          <Draw10Animation 
              cards={drawn10Cards} 
              onComplete={() => setDrawn10Cards([])} 
          />
      )}

      {/* Super Card Unlock Modal */}
      {unlockedSuperCard && (
          <SuperCardUnlockModal 
              cardIndex={unlockedSuperCard.cardIndex}
              suit={unlockedSuperCard.suit}
              rank={unlockedSuperCard.rank}
              onClose={() => {
                setUnlockedSuperCard(null);
                // 关闭弹板时自动显示钻石获得提示（100钻石）
                setDiamondRewardQueue(prev => [...prev, 100]);
              }}
          />
      )}

      {/* Game Start Screen */}
      {showGameStart && (
          <GameStartScreen 
              onClose={() => {
                setShowGameStart(false);
                localStorage.setItem('hasSeenGameStart', 'true');
              }}
          />
      )}

      {/* Tutorial Complete Screen */}
      {showTutorialComplete && (
          <TutorialCompleteScreen 
              onClose={() => setShowTutorialComplete(false)}
          />
      )}

    </div>
  );
}

export default App;
