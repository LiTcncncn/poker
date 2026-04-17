import { useEffect, useState, useCallback, useMemo } from 'react';
import { useGameStore } from './store/gameStore';
import { Card } from './components/Card';
import { DeckView } from './components/DeckView';
import { StatsView } from './components/StatsView';
import { CraftView } from './components/CraftView';
import { AchievementView } from './components/AchievementView';
import { DiamondRewardToast } from './components/DiamondRewardToast';
import { DrawAnimation } from './components/DrawAnimation';
import { Draw10Animation } from './components/Draw10Animation';
import { SuperCardUnlockWithTask } from './components/SuperCardUnlockWithTask';
import { SuperCardUnlockModal } from './components/SuperCardUnlockModal';
import { GameStartScreen } from './components/GameStartScreen';
import { TutorialCompleteScreen } from './components/TutorialCompleteScreen';
import { Coins, Zap, Trophy, BarChart3, LayoutGrid, Wand2, Gem, ShoppingBag } from 'lucide-react';
import { DrawView } from './components/DrawView';
import { DRAW_SINGLE_DIAMOND_COST } from './constants/drawDiamondCosts';
import { Card as CardType } from './types/poker';
import clsx from 'clsx';
import { hasClaimableAchievements, ACHIEVEMENT_CONFIGS } from './utils/achievements';
import { getSuperCardUnlockDiamondReward } from './utils/superCardPrices';
import { CARD_BACK_WHITE_INSET_OVERLAY_CLASS, getCardBackImagePath } from './utils/cardImageMapping';

const BASE_URL = import.meta.env.BASE_URL;
const MAIN_SCENE_BG_URL = `${BASE_URL}bg/main-scene-bg.png`;

// 牌型图片映射
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

export function MainGame() {
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
    unlockedAttributeSlots,
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
    craftGoldCard,
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
    craftGoldCount,
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

  /** 成就面板用：避免内联对象导致 AchievementView 依赖引用频繁变化 */
  const achievementCardStats = useMemo(
    () => ({
      blueCardCount,
      purpleCardCount,
      greenCardCount,
      superCardCount: superCardUnlockedCount,
      craftGoldCount,
    }),
    [blueCardCount, purpleCardCount, greenCardCount, superCardUnlockedCount, craftGoldCount]
  );
  
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
      
      // 翻牌动画完成后，触发结算动画（翻牌 250ms + 停顿 300ms；与 Card 翻转时长一致）
      const timer2 = setTimeout(() => {
        setShowResult(true);
        setShowScoringAnimation(true);
        setIsManualFlip(true);
      }, 550);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isVideoPokerMode, vpokerReplaced, isFlipped, currentHand.length, setFlipped]);

  // 根据超级牌解锁数量自动切换VPoker模式
  useEffect(() => {
    // 如果超级牌数量不足2张，但当前是VPoker模式，需要切换回普通模式
    if (superCardUnlockedCount < 2 && isVideoPokerMode && !isFlipped) {
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
    // 2. 翻牌 250ms + 停顿 300ms（与 Card 一致）
    // 3. 中牌上移和结算区砸落同时开始
    const timer = setTimeout(() => {
      setShowScoringAnimation(true); // 开始中牌上移
      setShowResult(true); // 开始结算区砸落
    }, 550);

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
    const shouldUseVPoker = superCardUnlockedCount >= 2;
    
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
    <div className="relative isolate flex min-h-screen w-full flex-col bg-[#0a192e] text-slate-100">
      {/* 底层仅星空图，光韵单独一层叠在上面（避免与背景写在同一层 + soft-light 在深底上几乎不可见） */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat"
        aria-hidden
        style={{
          backgroundImage: `url(${MAIN_SCENE_BG_URL})`,
          backgroundSize: '100% 100%',
        }}
      />
      <div className="main-scene-bg-halo" aria-hidden>
        <div className="main-scene-bg-halo__layer" />
      </div>
      {/* 顶部资源栏 — 对齐 pencil v1topA / M87cN；移动端 max-w 390 */}
      <div className="relative z-10 w-full border-b border-[#25324d] bg-gradient-to-b from-[#16233e] to-[#111a2f]">
          <div
            className="mx-auto w-full max-w-[390px] px-4 pb-[11px] pt-[max(7px,env(safe-area-inset-top,0px))] min-[1320px]:max-w-6xl min-[1320px]:px-6 min-[1320px]:pb-[15px] min-[1320px]:pt-[11px]"
            style={{ WebkitFontSmoothing: 'antialiased' }}
          >
            <div className="flex w-full items-center justify-between gap-2 min-[1320px]:max-w-4xl min-[1320px]:mx-auto min-[1320px]:justify-center min-[1320px]:gap-16">
              <div className="flex min-w-0 items-center gap-1.5">
                <Coins className="h-4 w-4 shrink-0 text-[#FACC15]" strokeWidth={2.25} />
                <span className="truncate text-[18px] font-extrabold leading-none tracking-tight text-[#EAF1FF] tabular-nums">
                  ${money.toLocaleString()}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <Gem className="h-4 w-4 shrink-0 text-[#22D3EE]" strokeWidth={2.25} />
                <span className="truncate text-[18px] font-extrabold leading-none tracking-tight text-[#EAF1FF] tabular-nums">
                  {diamonds.toLocaleString()}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-1.5">
                  <Zap className="h-4 w-4 shrink-0 text-[#60A5FA]" strokeWidth={2.25} />
                  <span className="text-[18px] font-extrabold leading-none tracking-tight text-[#EAF1FF] tabular-nums">
                    {flipsRemaining}/{maxFlips}
                  </span>
                </div>
                <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-[#1C2942]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#3B82F6] transition-all duration-100"
                    style={{ width: `${recoveryProgress * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Main Game Area — v2：超级牌区上移 48px（累计再上移 8px） */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-end gap-2 px-2 pb-2 sm:gap-2.5 sm:pb-3 sm:px-4">
        {/* 超级牌区 */}
        {tutorialStage === 'complete' && (
          <div className="mb-0 flex -translate-y-[48px] transform justify-center sm:mb-1">
            <SuperCardUnlockWithTask
              onUnlock={(superCardId) => {
                // 解锁成功后显示弹窗
                // 从 superCardId 解析出 suit 和 rank
                const parts = superCardId.split('_');
                if (parts.length === 2) {
                  const suitMap: Record<string, string> = {
                    'spades': 'spades',
                    'hearts': 'hearts',
                    'clubs': 'clubs',
                    'diamonds': 'diamonds'
                  };
                  const rankMap: Record<string, number> = {
                    'A': 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
                    '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
                  };
                  const suit = suitMap[parts[0]];
                  const rank = rankMap[parts[1]];
                  if (suit && rank) {
                    // 计算卡牌索引
                    const suitOrder: Record<string, number> = { 'spades': 0, 'hearts': 1, 'clubs': 2, 'diamonds': 3 };
                    const cardIndex = suitOrder[suit] * 13 + (rank === 14 ? 0 : rank - 1);
                setUnlockedSuperCard({ cardIndex, suit, rank });
                  }
                }
              }}
              currentMoney={money}
            />
          </div>
        )}

        {/* Result Display — 高度固定；整体上移 10px（translate）叠在原 -mt 上 */}
        <div className="flex h-16 flex-col items-center justify-center -mt-8 -translate-y-[10px] transform sm:h-24 sm:-mt-10">
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
                    <div className="-mt-2 flex items-baseline justify-center gap-2 sm:-mt-1">
                        <span className="font-mono text-lg font-extrabold text-emerald-400 sm:text-xl">
                          ${handResult.score.toLocaleString()}
                        </span>
                        <span className="text-sm font-semibold text-slate-500">
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
        {/* items-center：避免 flex stretch 破坏 2:3；牌内排版仅随牌宽 cqw 缩放，勿再单独改 fontSize */}
        <div 
            className="flex items-center gap-1.5 sm:gap-4 perspective-1000 justify-center"
            onClick={superCardUnlockedCount >= 2 && isVideoPokerMode && isFlipped && !vpokerReplaced ? undefined : handleMainClick}
        >
          {currentHand.length > 0 ? (
            currentHand.map((card, index) => {
              const cardCount = getCardCount();
              // 根据牌数动态调整大小（移动端按比例缩小）
              let mobileWidth = '18vw';
              let mobileMaxWidth = 80;

              if (cardCount === 6) {
                mobileWidth = '15vw';
                mobileMaxWidth = 64;
              } else if (cardCount === 7) {
                mobileWidth = '13vw';
                mobileMaxWidth = 56;
              }
              
              // VPoker 模式下，判断是否被 Hold（需要解锁4张超级牌）
              const shouldUseVPoker = superCardUnlockedCount >= 2;
              const isHeld = shouldUseVPoker && isVideoPokerMode && isFlipped && !vpokerReplaced && vpokerHeldCards.includes(index);
              
              return (
                <div
                  key={`${card.id}-${index}`}
                  className="flex-shrink-0 aspect-[2/3] sm:w-24 sm:max-w-none"
                  style={{
                    width: mobileWidth,
                    maxWidth: `${mobileMaxWidth}px`,
                  }}
                >
                  <Card
                    card={card}
                    isFlipped={isFlipped}
                    isScoring={isFlipped && handResult && showScoringAnimation ? handResult.scoringCardIds.includes(card.id) : false}
                    isHeld={isHeld}
                    showSuperBonus
                    onClick={shouldUseVPoker && isVideoPokerMode && isFlipped && !vpokerReplaced ? () => toggleVPokerHold(index) : undefined}
                    style={{
                      width: '100%',
                      height: '100%',
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
                let mobileMaxWidth = 80;

                if (cardCount === 6) {
                  mobileWidth = '15vw';
                  mobileMaxWidth = 64;
                } else if (cardCount === 7) {
                  mobileWidth = '13vw';
                  mobileMaxWidth = 56;
                }

                const placeholderCorner = 'rounded-[14px]';
                return (
                  <div
                    key={i}
                    className="aspect-[2/3] flex-shrink-0 sm:w-24 sm:max-w-none"
                    style={{
                      width: mobileWidth,
                      maxWidth: `${mobileMaxWidth}px`,
                    }}
                  >
                    {/* 与 Card 同构：2:3 格 + 圆角 + 白内描边 + poker_back_custom cover */}
                    <div className="group relative h-full w-full min-h-0 cursor-pointer select-none transition-transform duration-300 hover:-translate-y-2">
                      <div
                        className={clsx(
                          'relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#0B1220]',
                          placeholderCorner
                        )}
                      >
                        <img
                          src={getCardBackImagePath()}
                          alt="Card back"
                          className="relative z-0 h-full w-full object-cover object-center select-none"
                          draggable={false}
                        />
                        <div
                          className={clsx(CARD_BACK_WHITE_INSET_OVERLAY_CLASS, placeholderCorner)}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>


        {/* Controls — 移动端对齐 pencil v1ctrlA：主钮 fill + gap12 + 侧钮 98×55 */}
        <div className="mt-1 w-full max-w-none px-3 sm:mt-1.5 sm:px-3">
          <div className="mb-1 flex items-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={handleMainClick}
              disabled={(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 2;
                if (!isFlipped) {
                  return flipsRemaining <= 0;
                }
                if (shouldUseVPoker && isVideoPokerMode) {
                  if (vpokerReplaced) {
                    return !showResult;
                  }
                  return false;
                }
                return !showResult;
              })()}
              className={clsx(
                'flex h-[55px] min-w-0 flex-1 transform items-center justify-center rounded-[14px] px-3.5 text-[18px] font-extrabold leading-none transition-all active:scale-[0.98]',
                (() => {
                  const shouldUseVPoker = superCardUnlockedCount >= 2;
                  if (!isFlipped) return flipsRemaining > 0;
                  if (shouldUseVPoker && isVideoPokerMode) {
                    if (vpokerReplaced) return showResult;
                    return true;
                  }
                  return showResult;
                })()
                  ? 'bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] text-white shadow-[0_8px_18px_rgba(29,78,216,0.4)]'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500 shadow-none'
              )}
            >
              {(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 2;
                if (!isFlipped) return '翻牌';
                if (shouldUseVPoker && isVideoPokerMode) {
                  if (vpokerReplaced) return '下一手';
                  return '换牌';
                }
                return '下一手';
              })()}
            </button>

            {tutorialStage === 'pre' && unlockedCardSlots < 5 ? (
              <button
                type="button"
                onClick={() => unlockCardSlot()}
                disabled={money < getUnlockCost()}
                className={clsx(
                  'h-[55px] min-w-[98px] max-w-[120px] shrink-0 rounded-[14px] border border-[#64748B] bg-[#1E293B] px-3 py-0 text-center text-[13px] font-bold leading-tight text-[#E2E8F0] transition-all active:scale-[0.98]',
                  money >= getUnlockCost()
                    ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                    : 'cursor-not-allowed text-slate-500 opacity-70'
                )}
              >
                牌+1 (${getUnlockCost()})
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleAutoFlip}
                className={clsx(
                  'flex h-[55px] w-[98px] shrink-0 items-center justify-center rounded-[14px] border border-[#64748B] bg-[#1E293B] px-3 text-[15px] font-bold leading-none text-[#E2E8F0] transition-all active:scale-[0.98]',
                  isAutoFlipping && 'border-amber-500/70 text-amber-200'
                )}
              >
                {isAutoFlipping ? '⏸ 停止' : '\u25B6 自动'}
              </button>
            )}
          </div>

          {/* PC端：所有按钮横向排列 */}
          <div className="hidden sm:flex gap-6 justify-center flex-wrap">
            <button 
              onClick={handleMainClick}
              disabled={(() => {
                const shouldUseVPoker = superCardUnlockedCount >= 2;
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
                  const shouldUseVPoker = superCardUnlockedCount >= 2;
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
                const shouldUseVPoker = superCardUnlockedCount >= 2;
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

      {/* 主导航 — 手机收窄图标/文字下方留白，大屏 min-[1320px] 保持 */}
      <div className="relative z-10 w-full border-t border-[#223353] bg-gradient-to-b from-[#111a2f] to-[#0d1527]">
          <div
            className="mx-auto flex w-full max-w-[390px] min-h-0 justify-between px-3.5 pt-2.5 pb-[max(30px,env(safe-area-inset-bottom,0px))] min-[1320px]:max-w-6xl min-[1320px]:justify-center min-[1320px]:gap-14 min-[1320px]:px-8 min-[1320px]:pb-4 min-[1320px]:pt-2"
            style={{ WebkitFontSmoothing: 'antialiased' }}
          >
            <button
              type="button"
              onClick={() => setShowDeck(true)}
              className="relative flex w-[70px] shrink-0 flex-col items-center gap-0 rounded-lg py-0 min-[1320px]:gap-0.5 min-[1320px]:py-0.5 transition-opacity active:opacity-80"
              title="牌池"
            >
              <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center">
                <LayoutGrid className="h-[26px] w-[26px] text-[#8FA7D6]" strokeWidth={1.75} />
                {(() => {
                  const maxIdx = 52 + unlockedAttributeSlots;
                  const hasFillableEmpty = activeDeck.some(
                    (c, i) => i >= 52 && i < maxIdx && c === null
                  );
                  return hasFillableEmpty && reserveDeck.length > 0;
                })() && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 translate-x-[5px] rounded-full bg-[#EF4444] shadow-sm" />
                )}
              </span>
              <span className="text-[15px] font-semibold leading-none text-[#8FA7D6]">牌池</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (tutorialStage === 'complete') setShowAchievements(true);
              }}
              disabled={tutorialStage !== 'complete'}
              className={clsx(
                'relative flex w-[70px] shrink-0 flex-col items-center gap-0 rounded-lg py-0 min-[1320px]:gap-0.5 min-[1320px]:py-0.5 transition-opacity',
                tutorialStage === 'complete'
                  ? 'cursor-pointer active:opacity-80'
                  : 'cursor-not-allowed opacity-40'
              )}
              title="成就"
            >
              <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center">
                <Trophy className="h-[26px] w-[26px] text-[#8FA7D6]" strokeWidth={1.75} />
                {tutorialStage === 'complete' &&
                  hasClaimableAchievements(achievements, stats, {
                    blueCardCount,
                    purpleCardCount,
                    greenCardCount,
                    superCardCount: superCardUnlockedCount,
                    craftGoldCount,
                  }) && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 translate-x-[5px] rounded-full bg-[#EF4444] shadow-sm" />
                  )}
              </span>
              <span className="text-[15px] font-semibold leading-none text-[#8FA7D6]">成就</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (tutorialStage === 'complete') setShowDraw(true);
              }}
              disabled={tutorialStage !== 'complete'}
              className={clsx(
                'relative flex w-[70px] shrink-0 flex-col items-center gap-0 rounded-lg py-0 min-[1320px]:gap-0.5 min-[1320px]:py-0.5 transition-opacity',
                tutorialStage === 'complete'
                  ? 'cursor-pointer active:opacity-80'
                  : 'cursor-not-allowed opacity-40'
              )}
              title="抽卡"
            >
              <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center">
                <ShoppingBag className="h-[26px] w-[26px] text-[#8FA7D6]" strokeWidth={1.75} />
                {tutorialStage === 'complete' && diamonds >= DRAW_SINGLE_DIAMOND_COST && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 translate-x-[5px] rounded-full bg-[#EF4444] shadow-sm" />
                )}
              </span>
              <span className="text-[15px] font-semibold leading-none text-[#8FA7D6]">抽卡</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCraft(true)}
              className="relative flex w-[70px] shrink-0 flex-col items-center gap-0 rounded-lg py-0 min-[1320px]:gap-0.5 min-[1320px]:py-0.5 transition-opacity active:opacity-80"
              title="合成"
            >
              <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center">
                <Wand2 className="h-[26px] w-[26px] text-[#8FA7D6]" strokeWidth={1.75} />
                {(allCards.filter((c) => c.quality === 'green').length >= 10 ||
                  (() => {
                    const purple = allCards.filter((c) => c.quality === 'purple');
                    const keyCount = new Map<string, number>();
                    for (const card of purple) {
                      const effectsStr = card.effects
                        .map((e) => {
                          if (e.type === 'double_suit' && e.suits) {
                            return `${e.type}:${[...e.suits].sort().join(',')}`;
                          }
                          if (e.type === 'cross_value' && e.ranks) {
                            return `${e.type}:${[...e.ranks].sort((a, b) => a - b).join(',')}`;
                          }
                          return `${e.type}:${e.value ?? ''}`;
                        })
                        .sort()
                        .join('|');
                      const crossEffect = card.effects.find((e) => e.type === 'cross_value' && e.ranks?.length);
                      const rankPart = crossEffect?.ranks?.length
                        ? `cross:${[...crossEffect.ranks].sort((a, b) => a - b).join(',')}`
                        : `rank:${card.rank}`;
                      const key = `${card.suit}-${rankPart}-${effectsStr}-diamond:${card.isDiamondCard ? card.diamondBonus ?? 20 : 0}`;
                      keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
                    }
                    return Array.from(keyCount.values()).some((count) => count >= 2);
                  })()) && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 translate-x-[5px] rounded-full bg-[#EF4444] shadow-sm" />
                )}
              </span>
              <span className="text-[15px] font-semibold leading-none text-[#8FA7D6]">合成</span>
            </button>

            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="relative flex w-[70px] shrink-0 flex-col items-center gap-0 rounded-lg py-0 min-[1320px]:gap-0.5 min-[1320px]:py-0.5 transition-opacity active:opacity-80"
              title="统计"
            >
              <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center">
                <BarChart3 className="h-[26px] w-[26px] text-[#8FA7D6]" strokeWidth={1.75} />
              </span>
              <span className="text-[15px] font-semibold leading-none text-[#8FA7D6]">统计</span>
            </button>
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
          cardStats={achievementCardStats}
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
          onCraftGold={craftGoldCard}
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
                const reward = getSuperCardUnlockDiamondReward(unlockedSuperCard.suit);
                setUnlockedSuperCard(null);
                setDiamondRewardQueue(prev => [...prev, reward]);
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

export default MainGame;
