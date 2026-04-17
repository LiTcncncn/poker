import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Card, CardQuality, HandResult, Rank, Suit, HandType } from '../types/poker';
import { calculateHandScore } from '../utils/pokerLogic';
import {
  getSuperCardPrice,
  getSuperCardFromIndex,
  getFixedDeckIndex,
  getSuperCardUnlockDiamondReward,
} from '../utils/superCardPrices';
import { 
  createInitialAchievements, 
  checkAchievementProgress, 
  AchievementProgress,
  AchievementType,
  ACHIEVEMENT_CONFIGS,
  HAND_TYPE_NAMES
} from '../utils/achievements';
import { getGameModeById, getSuperCardUnlockByGameModeId } from '../utils/gameModeLoader';
import { evaluateHandWithRules, isHandTypeMatchingTask } from '../utils/pokerLogicExtended';
import { checkAchievementProgressWithCardLimit } from '../utils/achievementsExtended';
import { 
  updateTaskProgress as updateSuperCardTaskProgress,
  payCost,
  unlockSuperCard as unlockSuperCardWithManager,
  resetAllUnlockProgress
} from '../utils/superCardUnlockManager';
import {
  IS_DEV_TEST_BUILD,
  DEV_TEST_DIAMONDS_MIN,
  DEV_TEST_RECOVER_INTERVAL_MS,
} from '../config/devTest';
import {
  DRAW_SINGLE_DIAMOND_COST,
  DRAW_TEN_DIAMOND_COST,
} from '../constants/drawDiamondCosts';
import { MAX_UNLOCKED_ATTRIBUTE_SLOTS } from '../constants/deckPool';

// 剩余牌池排序函数：按品质排序（gold > purple > blue > green > 其他）
const sortReserveDeck = (cards: Card[]): Card[] => {
  const qualityOrder: Record<CardQuality, number> = {
    gold: 1,
    purple: 2,
    blue: 3,
    green: 4,
    orange: 5,
    super: 6,
    white: 7,
  };
  
  return [...cards].sort((a, b) => {
    const orderA = qualityOrder[a.quality] || 99;
    const orderB = qualityOrder[b.quality] || 99;
    return orderA - orderB;
  });
};

const getCardKey = (card: Card): string => {
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
  const diamondPart = card.isDiamondCard ? (card.diamondBonus ?? 20) : 0;
  return `${card.suit}-${rankPart}-${effectsStr}-diamond:${diamondPart}`;
};

// 隐藏规则：筛选实际牌池（每手牌每个数值最多5张品质牌）
// 对于每个数值（2-A），如果直接是该数值的品质牌超过5张，则随机选5张
// 跨数值牌不计入限制，全部加入牌池
const filterActualDeck = (availableCards: Card[]): Card[] => {
  const MAX_CARDS_PER_RANK = 5;
  
  // 分离白色牌、超级牌和品质牌
  const whiteAndSuperCards = availableCards.filter(
    card => card.quality === 'white' || card.quality === 'super'
  );
  const qualityCards = availableCards.filter(
    card => card.quality !== 'white' && card.quality !== 'super'
  );
  
  // 分离直接数值牌和跨数值牌
  const directCards: Card[] = [];
  const crossValueCards: Card[] = [];
  
  qualityCards.forEach(card => {
    const hasCrossValue = card.effects.some(e => e.type === 'cross_value');
    if (hasCrossValue) {
      crossValueCards.push(card);
    } else {
      directCards.push(card);
    }
  });
  
  // 对每个数值（2-A），只对直接数值牌应用限制
  const actualDirectCards: Card[] = [];
  const processedCardIds = new Set<string>();
  
  for (let rank = 2; rank <= 14; rank++) {
    // 找出所有直接是该数值的牌（不包括跨数值牌）
    const directRankCards = directCards.filter(card => {
      if (processedCardIds.has(card.id)) return false;
      return card.rank === rank;
    });
    
    // 如果超过5张，随机选5张
    if (directRankCards.length > MAX_CARDS_PER_RANK) {
      const shuffled = [...directRankCards].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, MAX_CARDS_PER_RANK);
      selected.forEach(card => {
        actualDirectCards.push(card);
        processedCardIds.add(card.id);
      });
    } else {
      // 不超过5张，全部加入
      directRankCards.forEach(card => {
        actualDirectCards.push(card);
        processedCardIds.add(card.id);
      });
    }
  }
  
  // 返回：白色牌 + 超级牌 + 筛选后的直接数值牌 + 所有跨数值牌（不受限制）
  return [...whiteAndSuperCards, ...actualDirectCards, ...crossValueCards];
};

// 计算卡牌数量统计
const calculateCardCounts = (activeDeck: (Card | null)[], reserveDeck: Card[], superCardUnlockedCount: number) => {
  let blueCount = 0;
  let purpleCount = 0;
  let greenCount = 0;
  
  // 统计上阵牌池和剩余牌池
  [...activeDeck.filter((c): c is Card => c !== null), ...reserveDeck].forEach(card => {
    if (card.quality === 'blue') blueCount++;
    else if (card.quality === 'purple') purpleCount++;
    else if (card.quality === 'green') greenCount++;
  });
  
  return {
    blueCardCount: blueCount,
    purpleCardCount: purpleCount,
    greenCardCount: greenCount,
    superCardCount: superCardUnlockedCount
  };
};

// 初始上阵牌池生成 helper：100张固定位置（前52张白色牌，后48个空位）
const generateInitialActiveDeck = (): (Card | null)[] => {
  const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 2-A 顺序
  const activeDeck: (Card | null)[] = [];

  let idCounter = 1;
  // 前52个位置：白色牌（固定），按 2-A 顺序
  for (const suit of suits) {
    for (const rank of ranks) {
      activeDeck.push({
        id: `card_${idCounter++}`,
        suit,
        rank,
        quality: 'white',
        effects: [],
        baseValue: rank >= 10 ? 10 : rank,
        multiplier: 0,
      });
    }
  }
  
  // 后48个位置：空位
  for (let i = 0; i < 48; i++) {
    activeDeck.push(null);
  }
  
  return activeDeck;
};

// 兼容旧版本的初始化函数（用于迁移，已废弃但保留用于数据迁移）
// @ts-ignore - 保留用于未来可能的迁移
const generateInitialDeck = (): Card[] => {
  const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck: Card[] = [];

  let idCounter = 1;
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `card_${idCounter++}`,
        suit,
        rank,
        quality: 'white',
        effects: [],
        baseValue: rank >= 10 ? 10 : rank,
        multiplier: 0,
      });
    }
  }
  return deck;
};

// 前置阶段：生成固定触发队列的手牌
const generateTutorialHand = (cardCount: number, flipCount: number, availableCards: Card[]): Card[] | null => {
  const deckCopy = [...availableCards];
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  
  // 2张牌阶段：第2、5、8、15次翻牌需要是对子
  if (cardCount === 2) {
    const triggerFlips = [2, 5, 8, 15]; // 第2、5、8、15次翻牌（flipCount + 1）
    if (triggerFlips.includes(flipCount + 1)) {
      // 生成一对：找到所有有足够牌数的数值，然后随机选择
      const availableRanks = ranks.filter(rank => {
        const cardsWithRank = deckCopy.filter(c => c.rank === rank);
        return cardsWithRank.length >= 2;
      });
      
      if (availableRanks.length > 0) {
        const selectedRank = availableRanks[Math.floor(Math.random() * availableRanks.length)];
        const pairCards = deckCopy.filter(c => c.rank === selectedRank);
        // 随机选择2张
        const shuffled = [...pairCards].sort(() => Math.random() - 0.5);
        return [shuffled[0], shuffled[1]];
      }
    }
  }
  
  // 3张牌阶段：第3、5、8、12、15次翻牌为对子或三条（随机选择，对子概率更高）
  if (cardCount === 3) {
    const triggerFlips = [3, 5, 8, 12, 15]; // 第3、5、8、12、15次翻牌（flipCount + 1）
    if (triggerFlips.includes(flipCount + 1)) {
      // 随机选择对子或三条（对子70%，三条30%）
      const rand = Math.random();
      const handType = rand < 0.7 ? 'pair' : 'three';
      
      if (handType === 'pair') {
        // 生成一对 + 一张其他牌
        const availableRanks = ranks.filter(rank => {
          const pairCards = deckCopy.filter(c => c.rank === rank);
          const otherCards = deckCopy.filter(c => c.rank !== rank);
          return pairCards.length >= 2 && otherCards.length > 0;
        });
        
        if (availableRanks.length > 0) {
          const selectedRank = availableRanks[Math.floor(Math.random() * availableRanks.length)];
          const pairCards = deckCopy.filter(c => c.rank === selectedRank);
          const otherCards = deckCopy.filter(c => c.rank !== selectedRank);
          const shuffled = [...pairCards].sort(() => Math.random() - 0.5);
          return [shuffled[0], shuffled[1], otherCards[Math.floor(Math.random() * otherCards.length)]];
        }
      } else {
        // 生成三条
        const availableRanks = ranks.filter(rank => {
          const threeCards = deckCopy.filter(c => c.rank === rank);
          return threeCards.length >= 3;
        });
        
        if (availableRanks.length > 0) {
          const selectedRank = availableRanks[Math.floor(Math.random() * availableRanks.length)];
          const threeCards = deckCopy.filter(c => c.rank === selectedRank);
          const shuffled = [...threeCards].sort(() => Math.random() - 0.5);
          return [shuffled[0], shuffled[1], shuffled[2]];
        }
      }
    }
  }
  
  // 4张牌阶段：第1、4、7、8、12、15次翻牌为对子或三条或两对（随机选择，对子>两对>三条）
  if (cardCount === 4) {
    const triggerFlips = [1, 4, 7, 8, 12, 15]; // 第1、4、7、8、12、15次翻牌（flipCount + 1）
    if (triggerFlips.includes(flipCount + 1)) {
      // 随机选择对子、两对或三条（对子50%，两对30%，三条20%）
      const rand = Math.random();
      
      if (rand < 0.5) {
        // 生成一对 + 两张其他牌（50%概率）
        const availableRanks = ranks.filter(rank => {
          const pairCards = deckCopy.filter(c => c.rank === rank);
          const otherCards = deckCopy.filter(c => c.rank !== rank);
          return pairCards.length >= 2 && otherCards.length >= 2;
        });
        
        if (availableRanks.length > 0) {
          const selectedRank = availableRanks[Math.floor(Math.random() * availableRanks.length)];
          const pairCards = deckCopy.filter(c => c.rank === selectedRank);
          const otherCards = deckCopy.filter(c => c.rank !== selectedRank);
          const shuffled = [...pairCards].sort(() => Math.random() - 0.5);
          const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
          return [
            shuffled[0],
            shuffled[1],
            shuffledOthers[0],
            shuffledOthers[1]
          ];
        }
      } else if (rand < 0.8) {
        // 生成两对（30%概率）
        const availableRanks = ranks.filter(rank => {
          const pairCards = deckCopy.filter(c => c.rank === rank);
          return pairCards.length >= 2;
        });
        
        if (availableRanks.length >= 2) {
          // 随机选择两个不同的数值
          const shuffledRanks = [...availableRanks].sort(() => Math.random() - 0.5);
          const rank1 = shuffledRanks[0];
          const rank2 = shuffledRanks.find(r => r !== rank1);
          
          if (rank2) {
            const pair1 = deckCopy.filter(c => c.rank === rank1);
            const pair2 = deckCopy.filter(c => c.rank === rank2);
            if (pair1.length >= 2 && pair2.length >= 2) {
              const shuffled1 = [...pair1].sort(() => Math.random() - 0.5);
              const shuffled2 = [...pair2].sort(() => Math.random() - 0.5);
              return [shuffled1[0], shuffled1[1], shuffled2[0], shuffled2[1]];
            }
          }
        }
      } else {
        // 生成三条 + 一张其他牌（20%概率）
        const availableRanks = ranks.filter(rank => {
          const threeCards = deckCopy.filter(c => c.rank === rank);
          const otherCards = deckCopy.filter(c => c.rank !== rank);
          return threeCards.length >= 3 && otherCards.length > 0;
        });
        
        if (availableRanks.length > 0) {
          const selectedRank = availableRanks[Math.floor(Math.random() * availableRanks.length)];
          const threeCards = deckCopy.filter(c => c.rank === selectedRank);
          const otherCards = deckCopy.filter(c => c.rank !== selectedRank);
          const shuffled = [...threeCards].sort(() => Math.random() - 0.5);
          return [
            shuffled[0],
            shuffled[1],
            shuffled[2],
            otherCards[Math.floor(Math.random() * otherCards.length)]
          ];
        }
      }
    }
  }
  
  // 其他情况返回null，使用随机生成
  return null;
};

interface GameState {
  // 资源
  money: number;
  diamonds: number; // 钻石数量
  
  // 翻牌相关
  flipsRemaining: number;
  maxFlips: number;
  lastFlipTime: number;
  lastRecoveryTime: number; // 上次恢复体力的时间
  isAutoFlipping: boolean;
  
  // 牌组和手牌
  activeDeck: (Card | null)[]; // 上阵牌池，100张固定位置（前52张白色牌，后48个空位）
  reserveDeck: Card[]; // 剩余牌池，不参与翻牌
  currentHand: Card[];
  handResult: HandResult | null;
  isFlipped: boolean;
  
  // 统计数据
  bestHands: HandResult[];
  stats: Record<string, { count: number; totalScore: number }>; // 牌型统计：次数+总收益

  // 成就系统
  achievements: Record<AchievementType, AchievementProgress>; // 成就进度
  
  // 新成就统计
  blueCardCount: number;        // 蓝牌总数
  purpleCardCount: number;     // 紫牌总数
  greenCardCount: number;       // 绿牌总数
  craftBlueCount: number;       // 合成蓝卡次数
  craftPurpleCount: number;     // 合成紫卡次数
  craftGoldCount: number;       // 合成金卡次数

  // 抽卡保底机制
  drawsSincePurple: number; // 距离上次紫卡的抽数

  // 前置阶段相关
  tutorialStage: 'pre' | 'complete'; // 前置阶段 | 完成
  unlockedCardSlots: number; // 已解锁牌位数量 (1-5)
  tutorialFlipCount: Record<number, number>; // 各牌数阶段的翻牌计数 {2: 1, 3: 2, 4: 1}

  // 技能系统
  skillMaxFlips: number; // 体力上限技能等级 (0-10)
  skillRecoverSpeed: number; // 体力恢复速度技能等级 (0-10)
  skillAutoFlipSpeed: number; // 自动翻牌速度技能等级 (0-10)
  skill6Cards: boolean; // 6张玩法（已解锁）
  skill7Cards: boolean; // 7张玩法（已解锁）
  unlockedAttributeSlots: number; // 已解锁的属性牌位置数量 (初始20，最多 MAX_UNLOCKED_ATTRIBUTE_SLOTS)

  // 每日收益记录（心电图）
  dailyEarnings: {
    date: string; // 当前日期 "YYYY-MM-DD"
    records: number[]; // 每手牌的收益数组
    handCount: number; // 当前手牌总数
  };

  // 超级扑克牌系统
  superCardUnlockedCount: number; // 已解锁的超级扑克牌数量 (0-52)
  superCardUnlockedIds: string[]; // 已解锁的超级扑克牌ID列表

  // Video Poker 模式
  isVideoPokerMode: boolean; // 是否处于 VPoker 模式
  vpokerHeldCards: number[]; // 被 Hold 的牌索引数组 [0, 2, 4]
  vpokerInitialHand: Card[] | null; // VPoker 初始翻出的 5 张牌
  vpokerReplaced: boolean; // 是否已完成换牌

  // Joker 玩法开关
  jokerEnabled: boolean; // Joker 玩法是否开启（默认开启）

  // 玩法系统
  currentGameModeId: string | null; // 当前玩法ID
  gameModeTaskProgress: Record<string, number>; // 各玩法的任务进度 {gameModeId: count}

  // Actions
  flipCards: () => void;
  resetHand: () => void; 
  drawCard: () => Card | null;
  draw10Cards: () => Card[];
  craftBlueCard: (selectedGreenIds: string[]) => Card | null; // 合成蓝卡
  craftPurpleCard: (selectedBlueIds: string[]) => Card | null; // 合成紫卡
  craftGoldCard: (selectedPurpleIds: string[]) => Card | null; // 合成金卡
  recoverEnergy: () => void; // 恢复体力逻辑
  toggleAutoFlip: () => void;
  getRecoveryProgress: () => number; // 获取当前恢复进度 (0-1)
  unlockCardSlot: () => boolean; // 解锁下一个牌位，返回是否成功
  getUnlockCost: () => number; // 获取当前解锁费用
  resetGame: () => void; // 重置游戏，清理所有数据
  upgradeSkill: (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => boolean; // 升级技能，返回是否成功
  getSkillCost: (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => number; // 获取技能升级费用
  getCardCount: () => number; // 获取当前翻牌数量（5/6/7）
  getMaxFlips: () => number; // 获取当前体力上限（基础20 + 技能加成）
  getRecoverInterval: () => number; // 获取当前体力恢复间隔（基础20000ms - 技能加成）
  getAutoFlipDuration: () => number; // 获取当前自动翻牌总时长（基础6000ms - 技能加成）
  unlockSuperCard: () => { success: boolean; cardIndex: number; suit: string; rank: number } | null; // 解锁超级扑克牌，返回是否成功和卡牌信息
  getCurrentSuperCardPrice: () => number; // 获取当前可解锁的超级扑克牌价格
  getCurrentSuperCardInfo: () => { suit: string; rank: number; index: number } | null; // 获取当前可解锁的超级扑克牌信息
  replaceCard: (activeIndex: number, reserveCardId: string) => void; // 用剩余牌池的牌替换上阵牌池的品质牌
  addToActiveDeck: (reserveCardId: string) => boolean; // 从剩余牌池添加到上阵牌池空位，返回是否成功
  removeFromActiveDeck: (activeIndex: number) => void; // 从上阵牌池移除到剩余牌池
  getAllCards: () => Card[]; // 获取总牌池（上阵+剩余），用于合成界面
  unlockAttributeSlot: () => boolean; // 解锁一个属性牌位置，返回是否成功
  getAttributeSlotUnlockCost: () => number; // 获取属性牌位置解锁费用
  claimAchievement: (achievementType: AchievementType, tier: number) => boolean; // 领取成就奖励，返回是否成功
  
  // 玩法系统 Actions
  setGameMode: (gameModeId: string) => void; // 设置当前玩法
  getCurrentGameMode: () => import('../types/gameMode').GameModeConfig | null; // 获取当前玩法配置
  updateGameModeTaskProgress: (handType: HandType) => void; // 更新当前玩法任务进度
  paySuperCardUnlockCost: (superCardId: string, cost: number) => boolean; // 支付超级牌解锁费用，返回是否成功
  unlockSuperCardWithTask: (superCardId: string) => boolean; // 使用新系统解锁超级牌，返回是否成功
  
  // Video Poker 模式 Actions
  flipVPokerCards: () => void; // VPoker 翻牌（消耗体力，抽取 5 张牌）
  toggleVPokerHold: (index: number) => void; // 切换 Hold 状态（点击切换）
  replaceVPokerCards: () => void; // 换牌逻辑（替换未 Hold 的牌，带翻牌动画）
  resetVPokerState: () => void; // 重置 VPoker 状态（换牌后或点击下一手时）
  setFlipped: (flipped: boolean) => void; // 设置翻牌状态（用于换牌动画）
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      money: 0,
      diamonds: IS_DEV_TEST_BUILD ? DEV_TEST_DIAMONDS_MIN : 0,
      flipsRemaining: 20,
      maxFlips: 20,
      lastFlipTime: Date.now(),
      lastRecoveryTime: Date.now(),
      isAutoFlipping: false,
      
      activeDeck: generateInitialActiveDeck(),
      reserveDeck: [],
      currentHand: [],
      handResult: null,
      isFlipped: false,
      
      bestHands: [],
      stats: {},
      achievements: createInitialAchievements(), // 初始化成就进度
      
      // 新成就统计
      blueCardCount: 0,
      purpleCardCount: 0,
      greenCardCount: 0,
      craftBlueCount: 0,
      craftPurpleCount: 0,
      craftGoldCount: 0,
      
      drawsSincePurple: 0, // 保底计数器
      
      // 前置阶段：初始为1张牌
      tutorialStage: 'pre',
      unlockedCardSlots: 1,
      tutorialFlipCount: {},
      
      // 技能系统：初始等级为0
      skillMaxFlips: 0,
      skillRecoverSpeed: 0,
      skillAutoFlipSpeed: 0,
      skill6Cards: false, // 6张玩法未解锁
      skill7Cards: false, // 7张玩法未解锁
      unlockedAttributeSlots: 20, // 初始解锁20个属性牌位置
      
      // 每日收益记录：初始为空
      dailyEarnings: {
        date: new Date().toISOString().split('T')[0],
        records: [],
        handCount: 0,
      },
      
      // 超级扑克牌系统：初始未解锁
      superCardUnlockedCount: 0,
      superCardUnlockedIds: [],

      // Video Poker 模式：初始状态
      isVideoPokerMode: false,
      vpokerHeldCards: [],
      vpokerInitialHand: null,
      vpokerReplaced: false,

      // Joker 玩法开关：默认开启
      jokerEnabled: true,

      // 玩法系统：默认使用标准玩法（如果存在）
      currentGameModeId: null,
      gameModeTaskProgress: {},

  flipCards: () => {
    const { flipsRemaining, activeDeck, isFlipped, tutorialStage, unlockedCardSlots, tutorialFlipCount } = get();
    
    if (flipsRemaining <= 0) return;
    if (isFlipped) return; 

    // 过滤出非空位的牌（只从上阵牌池抽取）
    const allAvailableCards = activeDeck.filter((card): card is Card => card !== null);
    
    if (allAvailableCards.length === 0) return;

    // 应用隐藏规则：筛选实际牌池（每个数值最多5张品质牌）
    const availableCards = filterActualDeck(allAvailableCards);
    
    if (availableCards.length === 0) return;

    const hand: Card[] = [];
    const deckCopy = [...availableCards];
    
    // 根据前置阶段、技能和玩法配置决定翻牌数量
    const { skill6Cards, skill7Cards, currentGameModeId } = get();
    let cardCount: number;
    
    // 如果有当前玩法配置，优先使用玩法配置的张数
    const currentGameMode = currentGameModeId ? getGameModeById(currentGameModeId) : null;
    
    if (tutorialStage === 'pre') {
      cardCount = unlockedCardSlots;
    } else if (currentGameMode && currentGameMode.cardCount) {
      // 使用玩法配置的张数
      cardCount = currentGameMode.cardCount;
    } else if (skill7Cards) {
      cardCount = 7;
    } else if (skill6Cards) {
      cardCount = 6;
    } else {
      cardCount = 5;
    }
    
    if (deckCopy.length < cardCount) return;

    // 前置阶段：应用固定触发队列
    if (tutorialStage === 'pre' && cardCount >= 2 && cardCount <= 4) {
      const flipCount = tutorialFlipCount[cardCount] || 0;
      const tutorialHand = generateTutorialHand(cardCount, flipCount, deckCopy);
      if (tutorialHand) {
        // 从牌堆中移除已选中的牌
        tutorialHand.forEach(card => {
          const index = deckCopy.findIndex(c => c.id === card.id);
          if (index !== -1) {
            deckCopy.splice(index, 1);
          }
        });
        hand.push(...tutorialHand);
      } else {
        // 如果生成失败，使用随机生成
        for (let i = 0; i < cardCount; i++) {
          const randomIndex = Math.floor(Math.random() * deckCopy.length);
          hand.push(deckCopy[randomIndex]);
          deckCopy.splice(randomIndex, 1);
        }
      }
      // 更新翻牌计数（无论是否成功生成特殊手牌都要更新）
      set((state) => ({
        tutorialFlipCount: {
          ...state.tutorialFlipCount,
          [cardCount]: flipCount + 1
        }
      }));
    } else {
      // 正常随机生成
      for (let i = 0; i < cardCount; i++) {
        const randomIndex = Math.floor(Math.random() * deckCopy.length);
        hand.push(deckCopy[randomIndex]);
        deckCopy.splice(randomIndex, 1);
      }
    }

    // Joker 生成逻辑：根据玩法配置决定概率
    // 限制：手牌中最多只能有一张 Joker
    // 解锁条件：需要先解锁超级牌 ♠️2 (spades_2)
    const { jokerEnabled, superCardUnlockedIds } = get();
    const hasJoker = hand.some(card => card.isJoker);
    const hasUnlockedSpades2 = superCardUnlockedIds.includes('spades_2');
    
    // 根据玩法配置决定 Joker 概率
    // 规则：只有 JOKER+ 玩法为 8%（0.08），其他玩法为 0%
    // 若没有玩法配置，默认为 0（不生成 Joker）
    const jokerProbability =
      currentGameMode && typeof currentGameMode.jokerProbability === 'number'
        ? currentGameMode.jokerProbability
        : 0;
    
    if (jokerEnabled && hasUnlockedSpades2 && hand.length > 0 && !hasJoker && jokerProbability > 0 && Math.random() < jokerProbability) {
      // 随机选择一张牌替换为 Joker
      const replaceIndex = Math.floor(Math.random() * hand.length);
      const jokerCard: Card = {
        id: `joker_${Date.now()}_${Math.random()}`,
        suit: 'spades', // 默认 suit，实际使用时会被替换
        rank: 2, // 默认 rank，实际使用时会被替换
        quality: 'white',
        effects: [],
        baseValue: 10, // 默认值，计分时使用替代的牌数值
        multiplier: 0,
        isJoker: true
      };
      hand[replaceIndex] = jokerCard;
    }

    // 计算牌型（支持动态牌数和玩法规则）
    const result = currentGameMode 
      ? evaluateHandWithRules(hand, currentGameMode)
      : calculateHandScore(hand, cardCount);

    // 前置阶段完成：第一次翻5张牌时
    const shouldCompleteTutorial = tutorialStage === 'pre' && cardCount === 5;

    set((state) => {
        const newStats = { ...state.stats };
        // 更新统计：次数和总收益
        if (!newStats[result.type]) {
            newStats[result.type] = { count: 0, totalScore: 0 };
        }
        newStats[result.type] = {
            count: newStats[result.type].count + 1,
            totalScore: newStats[result.type].totalScore + result.score
        };

        // 检测成就进度（牌型成就，带5张牌限制）
        const newAchievements = { ...state.achievements };
        if (result.type !== 'high_card' && newAchievements[result.type]) {
          const currentCount = newStats[result.type].count;
          newAchievements[result.type] = checkAchievementProgressWithCardLimit(
            result.type,
            currentCount,
            newAchievements[result.type],
            cardCount,
            result.scoringCardIds?.length
          );
        }
        
        // 更新当前玩法任务进度（仅在新手阶段完成后）
        if (tutorialStage === 'complete' && currentGameModeId && currentGameMode) {
          const unlockConfig = getSuperCardUnlockByGameModeId(currentGameModeId);
          console.log('📊 更新任务进度:', {
            玩法ID: currentGameModeId,
            玩法名: currentGameMode.name,
            牌型: result.type,
            任务类型: unlockConfig?.unlockConditions.task.type || 'unknown'
          });
          const { updateGameModeTaskProgress } = get();
          updateGameModeTaskProgress(result.type);
        } else if (tutorialStage === 'pre') {
          console.log('⏭️ 新手阶段，不统计任务进度');
        } else {
          console.log('⚠️ 未设置当前玩法，任务进度不会更新');
        }
        
        // （已移除）单回合最高收益成就

        const newBestHands = [...state.bestHands, result]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        // 记录每日收益（心电图）- 仅在前置阶段完成后（5张牌）开始记录
        const today = new Date().toISOString().split('T')[0];
        let newDailyEarnings = { ...state.dailyEarnings };
        
        // 如果日期变化，重置记录
        if (newDailyEarnings.date !== today) {
            newDailyEarnings = {
                date: today,
                records: [],
                handCount: 0,
            };
        }
        
        // 只有在前置阶段完成后（5张牌）才开始记录
        if (tutorialStage === 'complete' || cardCount === 5) {
            // 如果是第一次翻5张牌（前置阶段完成），清空之前的记录，从第一个点开始
            if (tutorialStage === 'pre' && cardCount === 5) {
                newDailyEarnings = {
                    date: today,
                    records: [],
                    handCount: 0,
                };
            }
            
            // 添加新的收益记录
            newDailyEarnings.records.push(result.score);
            newDailyEarnings.handCount += 1;
        }
        // 前置阶段（1-4张牌）不记录数据

        return {
            currentHand: hand,
            handResult: result,
            isFlipped: true,
            flipsRemaining: state.flipsRemaining - 1,
            lastFlipTime: Date.now(),
            money: state.money + result.score,
            diamonds: state.diamonds + (result.diamondReward || 0), // 添加钻石奖励
            stats: newStats,
            achievements: newAchievements,
            bestHands: newBestHands,
            dailyEarnings: newDailyEarnings,
            // 完成前置阶段
            ...(shouldCompleteTutorial ? { tutorialStage: 'complete' as const } : {})
        };
    });
  },

  resetHand: () => {
    const { isVideoPokerMode } = get();
    if (isVideoPokerMode) {
      // 如果是 VPoker 模式，使用专门的重置函数
      get().resetVPokerState();
    } else {
      // 普通模式重置
    set({ 
        currentHand: [], 
        handResult: null, 
        isFlipped: false 
    });
    }
  },

  drawCard: () => {
     // ... (keep existing logic)
     const { diamonds, drawsSincePurple } = get();
     const COST = DRAW_SINGLE_DIAMOND_COST;

     if (diamonds < COST) return null;

     // 保底逻辑：30 抽必出紫卡
     const isGuaranteedPurple = drawsSincePurple >= 29;

     // 抽卡逻辑：85% 绿色，14% 蓝色，1% 紫色
     let quality: CardQuality;
     if (isGuaranteedPurple) {
         quality = 'purple';
     } else {
         const qualityRoll = Math.random();
         if (qualityRoll < 0.85) {
             quality = 'green';
         } else if (qualityRoll < 0.99) {
             quality = 'blue';
         } else {
             quality = 'purple';
         }
     }
     
     const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
     // 绿色品质只生成 2-10，不包含 J(11)、Q(12)、K(13)、A(14)
     const allRanks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
     const greenRanks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];
     const ranks = quality === 'green' ? greenRanks : allRanks;
     
     const randomSuit = suits[Math.floor(Math.random() * suits.length)];
     const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
     
     const newCard: Card = {
         id: `card_${Date.now()}_${Math.random()}`,
         suit: randomSuit,
         rank: randomRank,
         quality,
         effects: [],
         baseValue: randomRank >= 10 ? 10 : randomRank,
         multiplier: 0
     };
     
     // 生成效果的辅助函数
     const generateEffect = (type: string, isGreenQuality: boolean = false) => {
         if (type === 'high_score') {
            // 绿色品质高分牌 +5，蓝色品质高分牌 +10
            return { type: 'high_score' as const, value: isGreenQuality ? 5 : 10 };
         } else if (type === 'multiplier') {
            // 绿色品质倍数牌 +2，蓝色品质倍数牌 +3
            return { type: 'multiplier' as const, value: isGreenQuality ? 2 : 3 };
         } else if (type === 'double_suit') {
             const otherSuits = suits.filter(s => s !== newCard.suit);
             const secondSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
             return { type: 'double_suit' as const, suits: [newCard.suit, secondSuit] };
         } else if (type === 'cross_value') {
             const groups: Rank[][] = [
                 [2, 3, 4],
                 [5, 6, 7],
                 [8, 9, 10],
                 [11, 12, 13],
             ];
             let targetGroup = groups.find(g => g.includes(newCard.rank));
             if (!targetGroup) {
                 if (newCard.rank === 14) targetGroup = [12, 13, 14];
                 else targetGroup = groups[Math.floor(Math.random() * groups.length)];
             }
             return { type: 'cross_value' as const, ranks: targetGroup };
         }
         return { type: 'high_score' as const, value: 3 };
     };
     
     if (quality === 'green') {
         // 绿色品质：保留高分牌和倍数牌（去掉双花牌和跨数值牌）
         const types = ['high_score', 'multiplier'];
         const type = types[Math.floor(Math.random() * types.length)];
         newCard.effects.push(generateEffect(type, true));
     } else if (quality === 'blue') {
         // 蓝色品质：30% 高分+8，30% 倍数+4，40% 双效果组合
         const blueRoll = Math.random();
         
         if (blueRoll < 0.3) {
             // 蓝色高分牌 +10
             newCard.effects.push({ type: 'high_score' as const, value: 10 });
         } else if (blueRoll < 0.6) {
             // 蓝色倍数牌 +3
             newCard.effects.push(generateEffect('multiplier'));
         } else {
             // 双效果组合（绿色效果：高分+5 + 倍数+2）
             newCard.effects.push(generateEffect('high_score', true));
             newCard.effects.push(generateEffect('multiplier', true));
         }
    } else if (quality === 'purple') {
        // 紫色品质：25% 高分+20，25% 倍数+10，50% 组合效果
        // 限制：单效果高分牌只允许 9-A，单效果倍数只允许 9-A，双花效果只允许 9-A，跨数值不允许 234 和 567
        // 钻石牌：紫色品质牌有概率成为钻石牌（参与计分时每张额外奖励20钻石）
        // 钻石牌只作为单一牌面数字的额外属性，不和高分牌、倍数牌同时出现
        const isDiamondCard = Math.random() < 0.15; // 15% 概率成为钻石牌
        if (isDiamondCard) {
            newCard.isDiamondCard = true;
            newCard.diamondBonus = 20;
            // 钻石牌不添加任何效果，只保留牌面数字
        } else {
            // 非钻石牌才生成效果
            const purpleRoll = Math.random();
            const isHighRank = newCard.rank >= 9; // 9, 10, J, Q, K, A
            
            if (purpleRoll < 0.25) {
            // 紫色高分牌 +20（只允许 9-A）
            if (isHighRank) {
                newCard.effects.push({ type: 'high_score' as const, value: 20 });
            } else {
                // 小牌不允许高分效果，改为跨数值+高分（只允许 8-10 和 JQK）
                const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                if (!targetGroup) {
                    targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                }
                newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                newCard.effects.push({ type: 'high_score' as const, value: 10 });
            }
        } else if (purpleRoll < 0.5) {
            // 紫色倍数牌 +6（只允许 9-A）
            if (isHighRank) {
                newCard.effects.push({ type: 'multiplier' as const, value: 6 });
            } else {
                // 小牌不允许倍数效果，改为跨数值+倍数（只允许 8-10 和 JQK）
                const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                if (!targetGroup) {
                    targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                }
                newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                newCard.effects.push({ type: 'multiplier' as const, value: 3 });
            }
        } else {
            // 紫色组合效果（双花区间调大：35% 双花+高分，35% 双花+倍数）
            const comboRoll = Math.random();
            if (comboRoll < 0.35) {
                // 双花+高分(+10)（允许 8-A）
                if (newCard.rank >= 8) {
                    const otherSuits = suits.filter(s => s !== newCard.suit);
                    const secondSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
                    newCard.effects.push({ type: 'double_suit' as const, suits: [newCard.suit, secondSuit] });
                    newCard.effects.push({ type: 'high_score' as const, value: 10 });
                } else {
                    // 小牌不允许双花+高分，改为跨数值+高分（只允许 8-10 和 JQK）
                    const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                    let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                    if (!targetGroup) {
                        targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                    }
                    newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                    newCard.effects.push({ type: 'high_score' as const, value: 10 });
                }
            } else if (comboRoll < 0.5) {
                // 跨数值+高分(+10)（不允许 234 和 567）
                const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                if (!targetGroup) {
                    targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                }
                newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                newCard.effects.push({ type: 'high_score' as const, value: 10 });
            } else if (comboRoll < 0.85) {
                // 双花+倍数(+3)（允许 8-A）
                if (newCard.rank >= 8) {
                    const otherSuits = suits.filter(s => s !== newCard.suit);
                    const secondSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
                    newCard.effects.push({ type: 'double_suit' as const, suits: [newCard.suit, secondSuit] });
                    newCard.effects.push({ type: 'multiplier' as const, value: 3 });
                } else {
                    // 小牌不允许双花+倍数，改为跨数值+倍数（只允许 8-10 和 JQK）
                    const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                    let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                    if (!targetGroup) {
                        targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                    }
                    newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                    newCard.effects.push({ type: 'multiplier' as const, value: 3 });
                }
            } else {
                // 跨数值+倍数(+3)（不允许 234 和 567）
                const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                if (!targetGroup) {
                    targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                }
                newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                newCard.effects.push({ type: 'multiplier' as const, value: 3 });
            }
        }
        }
     }

     set((state) => {
       // 查找上阵牌池的第一个空位（只能在前52 + unlockedAttributeSlots个位置中查找）
       const maxIndex = 52 + state.unlockedAttributeSlots;
       const firstEmptyIndex = state.activeDeck.findIndex((card, index) => 
         index >= 52 && index < maxIndex && card === null
       );
       
       let newActiveDeck = state.activeDeck;
       let newReserveDeck = state.reserveDeck;
       
       if (firstEmptyIndex !== -1) {
         // 有空位，填充到上阵牌池
         newActiveDeck = [...state.activeDeck];
         newActiveDeck[firstEmptyIndex] = newCard;
       } else {
         // 无空位，进入剩余牌池并自动排序
         newReserveDeck = sortReserveDeck([...state.reserveDeck, newCard]);
       }
       
       // 更新卡牌数量统计
       const cardCounts = calculateCardCounts(newActiveDeck, newReserveDeck, state.superCardUnlockedCount);
       
       // 检测卡牌数量成就
       const newAchievements = { ...state.achievements };
       if (newAchievements['blue_card_count']) {
         newAchievements['blue_card_count'] = checkAchievementProgress(
           'blue_card_count',
           cardCounts.blueCardCount,
           newAchievements['blue_card_count']
         );
       }
       if (newAchievements['purple_card_count']) {
         newAchievements['purple_card_count'] = checkAchievementProgress(
           'purple_card_count',
           cardCounts.purpleCardCount,
           newAchievements['purple_card_count']
         );
       }
       if (newAchievements['green_card_count']) {
         newAchievements['green_card_count'] = checkAchievementProgress(
           'green_card_count',
           cardCounts.greenCardCount,
           newAchievements['green_card_count']
         );
       }
       
       return {
         activeDeck: newActiveDeck,
         reserveDeck: newReserveDeck,
         diamonds: state.diamonds - COST,
         drawsSincePurple: quality === 'purple' ? 0 : state.drawsSincePurple + 1,
         blueCardCount: cardCounts.blueCardCount,
         purpleCardCount: cardCounts.purpleCardCount,
         greenCardCount: cardCounts.greenCardCount,
         achievements: newAchievements
       };
     });

     return newCard;
  },

  draw10Cards: () => {
     const { diamonds } = get();
     const COST = DRAW_TEN_DIAMOND_COST;

     if (diamonds < COST) return [];

     const drawnCards: Card[] = [];
     
     // 执行 10 次抽卡
     for (let i = 0; i < 10; i++) {
         // 临时增加钻石以便单抽函数能正常工作
         set((state) => ({ diamonds: state.diamonds + DRAW_SINGLE_DIAMOND_COST }));
         const card = get().drawCard();
         if (card) {
             drawnCards.push(card);
         }
     }
     
     // 修正钻石（减去实际消费）
     set((state) => ({ diamonds: state.diamonds - COST }));
     
     return drawnCards;
  },

  recoverEnergy: () => {
      set((state) => {
          const now = Date.now();
          if (state.flipsRemaining >= state.maxFlips) {
              return { lastRecoveryTime: now };
          }
          
          const timeSinceLastRecover = now - state.lastRecoveryTime;
          const RECOVER_INTERVAL = get().getRecoverInterval(); // 使用技能系统

          if (timeSinceLastRecover >= RECOVER_INTERVAL) {
              const recoverAmount = Math.floor(timeSinceLastRecover / RECOVER_INTERVAL);
              const newFlips = Math.min(state.maxFlips, state.flipsRemaining + recoverAmount);
              // 重置时间，保留余数时间以保持平滑
              const newLastRecoveryTime = now - (timeSinceLastRecover % RECOVER_INTERVAL);
              
              return {
                  flipsRemaining: newFlips,
                  lastRecoveryTime: newLastRecoveryTime
              };
          }
          return {};
      });
  },

  getRecoveryProgress: () => {
      const state = get();
      const now = Date.now();
      
      // 如果体力已满，进度条为0
      if (state.flipsRemaining >= state.maxFlips) {
          return 0;
      }
      
      const timeSinceLastRecover = now - state.lastRecoveryTime;
      const RECOVER_INTERVAL = get().getRecoverInterval(); // 使用技能系统
      
      // 计算当前恢复进度 (0-1)
      const progress = Math.min(1, timeSinceLastRecover / RECOVER_INTERVAL);
      
      return progress;
  },
  
  craftBlueCard: (selectedGreenIds: string[]) => {
     // 从总牌池（上阵+剩余）中查找选中的牌
     const { activeDeck, reserveDeck } = get();
     const allCards = [...activeDeck.filter((c): c is Card => c !== null), ...reserveDeck];
     
     // 验证：必须选择 10 张绿色品质卡牌
     if (selectedGreenIds.length !== 10) return null;
     
     const selectedCards = allCards.filter(card => selectedGreenIds.includes(card.id));
     const allGreen = selectedCards.every(card => card.quality === 'green');
     
     if (!allGreen) return null;
     
     // 生成随机蓝色品质卡牌
     const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
     const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
     
     const randomSuit = suits[Math.floor(Math.random() * suits.length)];
     const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
     
     const newCard: Card = {
         id: `card_craft_blue_${Date.now()}_${Math.random()}`,
         suit: randomSuit,
         rank: randomRank,
         quality: 'blue',
         effects: [],
         baseValue: randomRank >= 10 ? 10 : randomRank,
         multiplier: 0
     };
     
     // 生成蓝色效果（复用抽卡逻辑）
     const blueRoll = Math.random();
     if (blueRoll < 0.3) {
         // 蓝色高分牌 +10
         newCard.effects.push({ type: 'high_score' as const, value: 10 });
     } else if (blueRoll < 0.6) {
         // 蓝色倍数牌 +3
         newCard.effects.push({ type: 'multiplier' as const, value: 3 });
     } else {
         // 双效果组合（绿色效果：高分+5 + 倍数+2）
         newCard.effects.push({ type: 'high_score' as const, value: 5 });
         newCard.effects.push({ type: 'multiplier' as const, value: 2 });
     }
     
     // 移除选中的绿色卡牌（从上阵牌池或剩余牌池），新卡牌进入剩余牌池（由用户手动上阵）
     set((state) => {
       // 从上阵牌池移除选中的牌（产生空位）
       const newActiveDeck = state.activeDeck.map(card => 
         card && selectedGreenIds.includes(card.id) ? null : card
       );
       
       // 从剩余牌池移除选中的牌
       const filteredReserveDeck = state.reserveDeck.filter(card => !selectedGreenIds.includes(card.id));
       
       // 新合成的蓝色卡牌进入剩余牌池并自动排序（由用户手动上阵）
       const newReserveDeck = sortReserveDeck([...filteredReserveDeck, newCard]);
       
       // 更新合成次数和卡牌数量统计
       const newCraftBlueCount = state.craftBlueCount + 1;
       const cardCounts = calculateCardCounts(newActiveDeck, newReserveDeck, state.superCardUnlockedCount);
       
      // 检测卡牌数量成就
       const newAchievements = { ...state.achievements };
       if (newAchievements['blue_card_count']) {
         newAchievements['blue_card_count'] = checkAchievementProgress(
           'blue_card_count',
           cardCounts.blueCardCount,
           newAchievements['blue_card_count']
         );
       }
       
       return {
         activeDeck: newActiveDeck,
         reserveDeck: newReserveDeck,
         craftBlueCount: newCraftBlueCount,
         blueCardCount: cardCounts.blueCardCount,
         achievements: newAchievements
       };
     });
     
     return newCard;
  },

  craftPurpleCard: (selectedBlueIds: string[]) => {
     // 从总牌池（上阵+剩余）中查找选中的牌
     const { activeDeck, reserveDeck } = get();
     const allCards = [...activeDeck.filter((c): c is Card => c !== null), ...reserveDeck];
     
     // 验证：必须选择 5 张蓝色品质卡牌（2张完全相同 + 3张任意蓝牌）
     if (selectedBlueIds.length !== 5) return null;
     
     const selectedCards = allCards.filter(card => selectedBlueIds.includes(card.id));
     if (selectedCards.length !== 5) return null;
     
     // 验证：必须是蓝色品质
     const allBlue = selectedCards.every(card => card.quality === 'blue');
     if (!allBlue) return null;
     
     // 验证：至少有2张完全相同的蓝牌（花色、数值、效果都相同）
     // 生成卡牌的唯一标识 key（用于判断两张卡牌是否完全相同）
     const getCardKey = (card: Card): string => {
       // 效果数组需要排序以确保一致性
       const effectsStr = card.effects
         .map(e => {
           if (e.type === 'double_suit' && e.suits) {
             // 对 suits 数组排序以确保一致性
             return `${e.type}:${[...e.suits].sort().join(',')}`;
           } else if (e.type === 'cross_value' && e.ranks) {
             // 对 ranks 数组排序以确保一致性
             return `${e.type}:${[...e.ranks].sort((a, b) => a - b).join(',')}`;
           } else {
             return `${e.type}:${e.value ?? ''}`;
           }
         })
         .sort() // 对效果字符串排序以确保一致性
         .join('|');
      const crossEffect = card.effects.find((e) => e.type === 'cross_value' && e.ranks?.length);
      const rankPart = crossEffect?.ranks?.length
        ? `cross:${[...crossEffect.ranks].sort((a, b) => a - b).join(',')}`
        : `rank:${card.rank}`;
      return `${card.suit}-${rankPart}-${effectsStr}`;
     };
     
     // 按（花色、数值、效果）分组
     const cardGroups: Card[][] = [];
     selectedCards.forEach(card => {
       const key = getCardKey(card);
       let found = false;
       for (const group of cardGroups) {
         if (group.length > 0) {
           const firstKey = getCardKey(group[0]);
           if (key === firstKey) {
             group.push(card);
             found = true;
             break;
           }
         }
       }
       if (!found) {
         cardGroups.push([card]);
       }
     });
     
     // 检查是否有至少2张完全相同的卡牌
     const hasPair = cardGroups.some(group => group.length >= 2);
     if (!hasPair) return null;
     
     // 生成随机紫色品质卡牌
     const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
     const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
     
     const randomSuit = suits[Math.floor(Math.random() * suits.length)];
     const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
     
     const newCard: Card = {
         id: `card_craft_purple_${Date.now()}_${Math.random()}`,
         suit: randomSuit,
         rank: randomRank,
         quality: 'purple',
         effects: [],
         baseValue: randomRank >= 10 ? 10 : randomRank,
         multiplier: 0
     };
     
    // 生成紫色效果（复用抽卡逻辑，带限制）
    // 钻石牌只作为单一牌面数字的额外属性，不和高分牌、倍数牌同时出现
    const isDiamondCard = Math.random() < 0.15; // 15% 概率成为钻石牌
    if (isDiamondCard) {
        newCard.isDiamondCard = true;
        newCard.diamondBonus = 20;
        // 钻石牌不添加任何效果，只保留牌面数字
    } else {
        // 非钻石牌才生成效果
        const purpleRoll = Math.random();
        const isHighRank = newCard.rank >= 9; // 9, 10, J, Q, K, A
        
        if (purpleRoll < 0.25) {
        // 紫色高分牌 +20（只允许 9-A）
        if (isHighRank) {
            newCard.effects.push({ type: 'high_score' as const, value: 20 });
        } else {
            // 小牌不允许高分效果，改为跨数值+高分（只允许 8-10 和 JQK）
            const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
            let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
            if (!targetGroup) {
                targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            }
            newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
            newCard.effects.push({ type: 'high_score' as const, value: 10 });
        }
    } else if (purpleRoll < 0.5) {
        // 紫色倍数牌 +6（只允许 9-A）
        if (isHighRank) {
            newCard.effects.push({ type: 'multiplier' as const, value: 6 });
        } else {
            // 小牌不允许倍数效果，改为跨数值+倍数（只允许 8-10 和 JQK）
            const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
            let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
            if (!targetGroup) {
                targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            }
            newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
            newCard.effects.push({ type: 'multiplier' as const, value: 3 });
        }
    } else {
        // 紫色组合效果（双花区间调大：35% 双花+高分，35% 双花+倍数）
        const comboRoll = Math.random();
        if (comboRoll < 0.35) {
            // 双花+高分(+10)（允许 8-A）
            if (newCard.rank >= 8) {
                const otherSuits = suits.filter(s => s !== newCard.suit);
                const secondSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
                newCard.effects.push({ type: 'double_suit' as const, suits: [newCard.suit, secondSuit] });
                newCard.effects.push({ type: 'high_score' as const, value: 10 });
            } else {
                // 小牌不允许双花+高分，改为跨数值+高分（只允许 8-10 和 JQK）
                const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                if (!targetGroup) {
                    targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                }
                newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                newCard.effects.push({ type: 'high_score' as const, value: 10 });
            }
        } else if (comboRoll < 0.5) {
            // 跨数值+高分(+10)（不允许 234 和 567）
            const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
            let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
            if (!targetGroup) {
                targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            }
            newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
            newCard.effects.push({ type: 'high_score' as const, value: 10 });
        } else if (comboRoll < 0.85) {
            // 双花+倍数(+3)（允许 8-A）
            if (newCard.rank >= 8) {
                const otherSuits = suits.filter(s => s !== newCard.suit);
                const secondSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
                newCard.effects.push({ type: 'double_suit' as const, suits: [newCard.suit, secondSuit] });
                newCard.effects.push({ type: 'multiplier' as const, value: 3 });
            } else {
                // 小牌不允许双花+倍数，改为跨数值+倍数（只允许 8-10 和 JQK）
                const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
                let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
                if (!targetGroup) {
                    targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                }
                newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
                newCard.effects.push({ type: 'multiplier' as const, value: 3 });
            }
        } else {
            // 跨数值+倍数(+3)（不允许 234 和 567）
            const allowedGroups: Rank[][] = [[8, 9, 10], [11, 12, 13]];
            let targetGroup = allowedGroups.find(g => g.includes(newCard.rank));
            if (!targetGroup) {
                targetGroup = newCard.rank === 14 ? [12, 13, 14] : allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            }
            newCard.effects.push({ type: 'cross_value' as const, ranks: targetGroup });
            newCard.effects.push({ type: 'multiplier' as const, value: 3 });
        }
    }
    }
     
     // 移除选中的蓝色卡牌（从上阵牌池或剩余牌池），新卡牌进入剩余牌池（由用户手动上阵）
     set((state) => {
       // 从上阵牌池移除选中的牌（产生空位）
       const newActiveDeck = state.activeDeck.map(card => 
         card && selectedBlueIds.includes(card.id) ? null : card
       );
       
       // 从剩余牌池移除选中的牌
       const filteredReserveDeck = state.reserveDeck.filter(card => !selectedBlueIds.includes(card.id));
       
       // 新合成的紫色卡牌进入剩余牌池并自动排序（由用户手动上阵）
       const newReserveDeck = sortReserveDeck([...filteredReserveDeck, newCard]);
       
       // 更新合成次数和卡牌数量统计
       const newCraftPurpleCount = state.craftPurpleCount + 1;
       const cardCounts = calculateCardCounts(newActiveDeck, newReserveDeck, state.superCardUnlockedCount);
       
      // 检测卡牌数量成就
       const newAchievements = { ...state.achievements };
       if (newAchievements['purple_card_count']) {
         newAchievements['purple_card_count'] = checkAchievementProgress(
           'purple_card_count',
           cardCounts.purpleCardCount,
           newAchievements['purple_card_count']
         );
       }
       
       return {
         activeDeck: newActiveDeck,
         reserveDeck: newReserveDeck,
         craftPurpleCount: newCraftPurpleCount,
         purpleCardCount: cardCounts.purpleCardCount,
         achievements: newAchievements
       };
     });
     
     return newCard;
  },

  craftGoldCard: (selectedPurpleIds: string[]) => {
    const { activeDeck, reserveDeck } = get();
    const allCards = [...activeDeck.filter((c): c is Card => c !== null), ...reserveDeck];

    // 规则：2 合 1，必须是两张完全相同的紫牌
    if (selectedPurpleIds.length !== 2) return null;
    const selectedCards = allCards.filter((card) => selectedPurpleIds.includes(card.id));
    if (selectedCards.length !== 2) return null;
    if (!selectedCards.every((card) => card.quality === 'purple')) return null;

    const [cardA, cardB] = selectedCards;
    if (getCardKey(cardA) !== getCardKey(cardB)) return null;

    const doubledEffects = cardA.effects.map((effect) => {
      if (effect.type === 'high_score' || effect.type === 'multiplier') {
        return { ...effect, value: (effect.value ?? 0) * 2 };
      }
      return { ...effect };
    });

    const newCard: Card = {
      ...cardA,
      id: `card_craft_gold_${Date.now()}_${Math.random()}`,
      quality: 'gold',
      effects: doubledEffects,
      isDiamondCard: cardA.isDiamondCard,
      diamondBonus: cardA.isDiamondCard ? (cardA.diamondBonus ?? 20) * 2 : undefined,
    };

    set((state) => {
      const newActiveDeck = state.activeDeck.map((card) =>
        card && selectedPurpleIds.includes(card.id) ? null : card
      );

      const filteredReserveDeck = state.reserveDeck.filter((card) => !selectedPurpleIds.includes(card.id));
      const newReserveDeck = sortReserveDeck([...filteredReserveDeck, newCard]);

      const newCraftGoldCount = state.craftGoldCount + 1;
      const cardCounts = calculateCardCounts(newActiveDeck, newReserveDeck, state.superCardUnlockedCount);
      const newAchievements = { ...state.achievements };
      if (newAchievements['craft_gold_count']) {
        newAchievements['craft_gold_count'] = checkAchievementProgress(
          'craft_gold_count',
          newCraftGoldCount,
          newAchievements['craft_gold_count']
        );
      }
      return {
        activeDeck: newActiveDeck,
        reserveDeck: newReserveDeck,
        purpleCardCount: cardCounts.purpleCardCount,
        craftGoldCount: newCraftGoldCount,
        achievements: newAchievements,
      };
    });

    return newCard;
  },

  // Removed tick, replaced with explicit actions
  tick: () => {}, 
  
  toggleAutoFlip: () => set(state => ({ isAutoFlipping: !state.isAutoFlipping })),
  
  unlockCardSlot: () => {
    const { money, unlockedCardSlots, tutorialStage } = get();
    
    // 只能在前置阶段解锁
    if (tutorialStage !== 'pre') return false;
    
    // 已经解锁到5张，不能再解锁
    if (unlockedCardSlots >= 5) return false;
    
    // 获取解锁费用
    const costs = [100, 200, 300, 400]; // 1->2, 2->3, 3->4, 4->5
    const cost = costs[unlockedCardSlots - 1];
    
    // 检查金币是否足够
    if (money < cost) return false;
    
    // 解锁下一个牌位，并重置体力为满
    set((state) => ({
      money: state.money - cost,
      unlockedCardSlots: state.unlockedCardSlots + 1,
      flipsRemaining: state.maxFlips, // 重置体力为满
      lastRecoveryTime: Date.now(), // 重置恢复时间
      // 重置该牌数阶段的翻牌计数
      tutorialFlipCount: {
        ...state.tutorialFlipCount,
        [state.unlockedCardSlots + 1]: 0
      }
    }));
    
    return true;
  },
  
  getUnlockCost: () => {
    const { unlockedCardSlots, tutorialStage } = get();
    
    // 只能在前置阶段解锁
    if (tutorialStage !== 'pre') return 0;
    
    // 已经解锁到5张，不能再解锁
    if (unlockedCardSlots >= 5) return 0;
    
    const costs = [100, 200, 300, 400]; // 1->2, 2->3, 3->4, 4->5
    return costs[unlockedCardSlots - 1];
  },
  
  resetGame: () => {
    // 清除 localStorage
    localStorage.removeItem('poker-game-storage');
    // 同时清除超级牌解锁系统的 localStorage（否则会出现“新手阶段后直接跳到♠️4”等现象）
    resetAllUnlockProgress();
    
    // 重置所有状态到初始值
    set({
      money: 0,
      flipsRemaining: 20,
      maxFlips: 20,
      lastFlipTime: Date.now(),
      lastRecoveryTime: Date.now(),
      isAutoFlipping: false,
      activeDeck: generateInitialActiveDeck(),
      reserveDeck: [],
      currentHand: [],
      handResult: null,
      isFlipped: false,
      bestHands: [],
      stats: {},
      drawsSincePurple: 0,
      tutorialStage: 'pre',
      unlockedCardSlots: 1,
      tutorialFlipCount: {},
      skillMaxFlips: 0,
      skillRecoverSpeed: 0,
      skillAutoFlipSpeed: 0,
      skill6Cards: false,
      skill7Cards: false,
      unlockedAttributeSlots: 20,
      blueCardCount: 0,
      purpleCardCount: 0,
      greenCardCount: 0,
      craftBlueCount: 0,
      craftPurpleCount: 0,
      craftGoldCount: 0,
      dailyEarnings: {
        date: new Date().toISOString().split('T')[0],
        records: [],
        handCount: 0,
      },
      superCardUnlockedCount: 0,
      superCardUnlockedIds: [],
      diamonds: IS_DEV_TEST_BUILD ? DEV_TEST_DIAMONDS_MIN : 0,
      achievements: createInitialAchievements(),
      // 玩法系统
      currentGameModeId: null,
      gameModeTaskProgress: {},
    });
  },
  
  upgradeSkill: (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => {
    const { money, diamonds, skillMaxFlips, skillRecoverSpeed, skillAutoFlipSpeed, skill6Cards, skill7Cards, unlockedAttributeSlots } = get();
    
    // 属性牌位置解锁（使用钻石）
    if (skillId === 'attributeSlot') {
      if (unlockedAttributeSlots >= MAX_UNLOCKED_ATTRIBUTE_SLOTS) return false; // 已解锁所有位置
      const cost = get().getAttributeSlotUnlockCost();
      if (diamonds < cost) return false;
      set((state) => ({
        diamonds: state.diamonds - cost,
        unlockedAttributeSlots: state.unlockedAttributeSlots + 1,
      }));
      return true;
    }
    
    // 6张和7张玩法是布尔值技能（使用钻石）
    if (skillId === '6Cards') {
      if (skill6Cards) return false; // 已解锁
      const cost = get().getSkillCost('6Cards');
      if (diamonds < cost) return false;
      set((state) => ({
        diamonds: state.diamonds - cost,
        skill6Cards: true,
      }));
      return true;
    }
    
    if (skillId === '7Cards') {
      if (skill7Cards) return false; // 已解锁
      const cost = get().getSkillCost('7Cards');
      if (diamonds < cost) return false;
      set((state) => ({
        diamonds: state.diamonds - cost,
        skill7Cards: true,
      }));
      return true;
    }
    
    // 其他技能是等级技能
    const currentLevel = skillId === 'maxFlips' ? skillMaxFlips 
                        : skillId === 'recoverSpeed' ? skillRecoverSpeed 
                        : skillAutoFlipSpeed;
    const maxLevel = 10;
    
    // 检查是否已满级
    if (currentLevel >= maxLevel) return false;
    
    // 获取升级费用
    const cost = get().getSkillCost(skillId);
    
    // 检查金币是否足够
    if (money < cost) return false;
    
    // 升级技能
    set((state) => {
      const newState: any = {
        money: state.money - cost,
      };
      
      if (skillId === 'maxFlips') {
        newState.skillMaxFlips = state.skillMaxFlips + 1;
        // 更新体力上限（不补满体力）
        const newMaxFlips = 20 + (state.skillMaxFlips + 1);
        newState.maxFlips = newMaxFlips;
      } else if (skillId === 'recoverSpeed') {
        newState.skillRecoverSpeed = state.skillRecoverSpeed + 1;
      } else if (skillId === 'autoFlipSpeed') {
        newState.skillAutoFlipSpeed = state.skillAutoFlipSpeed + 1;
      }
      
      return newState;
    });
    
    return true;
  },
  
  getSkillCost: (skillId: 'maxFlips' | 'recoverSpeed' | 'autoFlipSpeed' | '6Cards' | '7Cards' | 'attributeSlot') => {
    // 属性牌位置解锁费用
    if (skillId === 'attributeSlot') {
      return get().getAttributeSlotUnlockCost();
    }
    
    // 6张和7张玩法价格（钻石）
    if (skillId === '6Cards') {
      return 1000; // 1000 钻石
    }
    if (skillId === '7Cards') {
      return 8000; // 8000 钻石
    }
    
    const { skillMaxFlips, skillRecoverSpeed, skillAutoFlipSpeed } = get();
    
    // 获取当前等级
    const currentLevel = skillId === 'maxFlips' ? skillMaxFlips 
                        : skillId === 'recoverSpeed' ? skillRecoverSpeed 
                        : skillAutoFlipSpeed;
    
    // 费用公式：500 + (等级 * 500)
    return 500 + (currentLevel * 500);
  },
  
  getMaxFlips: () => {
    const { skillMaxFlips } = get();
    // 基础20 + 每级+1，最高30
    return Math.min(30, 20 + skillMaxFlips);
  },
  
  getRecoverInterval: () => {
    if (IS_DEV_TEST_BUILD) return DEV_TEST_RECOVER_INTERVAL_MS;
    // 技能系统已屏蔽，固定为 120 秒恢复一点体力
    return 120000; // 120秒 = 120000毫秒
  },
  
  getAutoFlipDuration: () => {
    const { skillAutoFlipSpeed } = get();
    // 基础6000ms (6秒) - 每级300ms (0.3秒)，最低3000ms (3秒)
    return Math.max(3000, 6000 - (skillAutoFlipSpeed * 300));
  },
  
  getCardCount: () => {
    const { tutorialStage, unlockedCardSlots, skill6Cards, skill7Cards, currentGameModeId } = get();
    if (tutorialStage === 'pre') {
      return unlockedCardSlots;
    }
    
    // 优先使用玩法配置的 cardCount
    if (currentGameModeId) {
      const currentGameMode = getGameModeById(currentGameModeId);
      if (currentGameMode && currentGameMode.cardCount) {
        return currentGameMode.cardCount;
      }
    }
    
    // 然后检查技能
    if (skill7Cards) {
      return 7;
    } else if (skill6Cards) {
      return 6;
    } else {
      return 5;
    }
  },
  
  // 超级扑克牌系统
  getCurrentSuperCardInfo: () => {
    const { superCardUnlockedCount } = get();
    if (superCardUnlockedCount >= 52) {
      return null; // 已解锁所有超级扑克牌
    }
    const cardInfo = getSuperCardFromIndex(superCardUnlockedCount);
    if (!cardInfo) return null;
    return {
      suit: cardInfo.suit,
      rank: cardInfo.rank,
      index: superCardUnlockedCount,
    };
  },
  
  getCurrentSuperCardPrice: () => {
    const { superCardUnlockedCount } = get();
    if (superCardUnlockedCount >= 52) {
      return 0; // 已解锁所有超级扑克牌
    }
    return getSuperCardPrice(superCardUnlockedCount);
  },
  
  unlockSuperCard: () => {
    const { money, superCardUnlockedCount, maxFlips } = get();
    
    // 检查是否已解锁所有超级扑克牌
    if (superCardUnlockedCount >= 52) {
      return null;
    }
    
    // 获取当前可解锁的超级扑克牌信息
    const cardInfo = getSuperCardFromIndex(superCardUnlockedCount);
    if (!cardInfo) return null;
    
    const { suit, rank } = cardInfo;
    const price = getSuperCardPrice(superCardUnlockedCount);
    
    // 检查金币是否足够
    if (money < price) {
      return null;
    }
    
    // 解锁超级扑克牌
    set((state) => {
      const newUnlockedCount = state.superCardUnlockedCount + 1;
      const superCardId = `super_${suit}_${rank}`;
      
      // 替换上阵牌池中所有对应的白色牌（前52个位置）
      const newActiveDeck = state.activeDeck.map((card, index) => {
        if (index < 52 && card && card.suit === suit && card.rank === rank && card.quality === 'white') {
          // 保留原ID，只修改属性
          // 超级牌+15，能力介于蓝卡和紫卡之间
          return {
            ...card,
            quality: 'super' as CardQuality,
            baseValue: card.baseValue + 15,
          };
        }
        return card;
      });
      
      // 替换手牌中对应的白色牌
      const newCurrentHand = state.currentHand.map(card => {
        if (card.suit === suit && card.rank === rank && card.quality === 'white') {
          // 超级牌+15，能力介于蓝卡和紫卡之间
          return {
            ...card,
            quality: 'super' as CardQuality,
            baseValue: card.baseValue + 15,
          };
        }
        return card;
      });
      
      // 检测超级牌数量成就
      const newAchievements = { ...state.achievements };
      if (newAchievements['super_card_count']) {
        newAchievements['super_card_count'] = checkAchievementProgress(
          'super_card_count',
          newUnlockedCount,
          newAchievements['super_card_count']
        );
      }
      
      return {
        money: state.money - price,
        diamonds: state.diamonds + getSuperCardUnlockDiamondReward(suit), // 按花色发放钻石奖励
        superCardUnlockedCount: newUnlockedCount,
        superCardUnlockedIds: [...state.superCardUnlockedIds, superCardId],
        activeDeck: newActiveDeck,
        currentHand: newCurrentHand,
        flipsRemaining: maxFlips, // 体力回满
        lastRecoveryTime: Date.now(), // 重置恢复时间
        achievements: newAchievements
      };
    });
    
    return {
      success: true,
      cardIndex: superCardUnlockedCount,
      suit,
      rank,
    };
  },
  
  // 用剩余牌池的牌替换上阵牌池的品质牌
  replaceCard: (activeIndex: number, reserveCardId: string) => {
    const { activeDeck, reserveDeck } = get();
    
    // 验证：不能替换白色牌和超级牌（前52个位置）
    if (activeIndex < 52) {
      const card = activeDeck[activeIndex];
      if (card && (card.quality === 'white' || card.quality === 'super')) {
        return; // 禁止替换
      }
    }
    
    // 验证：目标位置必须存在（不能是空位，除非是后48个位置）
    if (activeIndex >= 52 && activeDeck[activeIndex] === null) {
      // 后48个位置的空位，直接填充
      const reserveCard = reserveDeck.find(c => c.id === reserveCardId);
      if (!reserveCard) return;
      
      set((state) => {
        const newActiveDeck = [...state.activeDeck];
        const newReserveDeck = state.reserveDeck.filter(c => c.id !== reserveCardId);
        
        newActiveDeck[activeIndex] = reserveCard;
        
        return {
          activeDeck: newActiveDeck,
          reserveDeck: newReserveDeck
        };
      });
      return;
    }
    
    const reserveCard = reserveDeck.find(c => c.id === reserveCardId);
    if (!reserveCard) return;
    
    const oldCard = activeDeck[activeIndex];
    if (!oldCard) return; // 前52个位置不应该有空位
    
    set((state) => {
      const newActiveDeck = [...state.activeDeck];
      const newReserveDeck = state.reserveDeck.filter(c => c.id !== reserveCardId);
      
      // 替换上阵牌池的牌
      newActiveDeck[activeIndex] = reserveCard;
      
      // 被替换的牌进入剩余牌池并自动排序
      const sortedReserveDeck = sortReserveDeck([...newReserveDeck, oldCard]);
      
      return {
        activeDeck: newActiveDeck,
        reserveDeck: sortedReserveDeck
      };
    });
  },
  
  // 从剩余牌池添加到上阵牌池空位
  addToActiveDeck: (reserveCardId: string) => {
    const { activeDeck, reserveDeck, unlockedAttributeSlots } = get();
    
    const reserveCard = reserveDeck.find(c => c.id === reserveCardId);
    if (!reserveCard) return false;
    
    // 查找第一个空位（只能在前52 + unlockedAttributeSlots个位置中查找）
    const maxIndex = 52 + unlockedAttributeSlots;
    const firstEmptyIndex = activeDeck.findIndex((card, index) => index >= 52 && index < maxIndex && card === null);
    if (firstEmptyIndex === -1) return false; // 没有空位
    
    set((state) => {
      const newActiveDeck = [...state.activeDeck];
      const newReserveDeck = state.reserveDeck.filter(c => c.id !== reserveCardId);
      
      newActiveDeck[firstEmptyIndex] = reserveCard;
      
      return {
        activeDeck: newActiveDeck,
        reserveDeck: newReserveDeck
      };
    });
    
    return true;
  },
  
  // 从上阵牌池移除到剩余牌池
  removeFromActiveDeck: (activeIndex: number) => {
    const { activeDeck } = get();
    
    // 验证：不能移除白色牌和超级牌（前52个位置）
    if (activeIndex < 52) {
      const card = activeDeck[activeIndex];
      if (card && (card.quality === 'white' || card.quality === 'super')) {
        return; // 禁止移除
      }
    }
    
    const card = activeDeck[activeIndex];
    if (!card) return; // 已经是空位
    
    set((state) => {
      const newActiveDeck = [...state.activeDeck];
      
      // 移除上阵牌池的牌（产生空位）
      newActiveDeck[activeIndex] = null;
      
      // 被移除的牌进入剩余牌池并自动排序
      const newReserveDeck = sortReserveDeck([...state.reserveDeck, card]);
      
      return {
        activeDeck: newActiveDeck,
        reserveDeck: newReserveDeck
      };
    });
  },
  
  // 获取总牌池（上阵+剩余），用于合成界面
  getAllCards: () => {
    const { activeDeck, reserveDeck } = get();
    return [...activeDeck.filter((c): c is Card => c !== null), ...reserveDeck];
  },
  
  // 领取成就奖励
  claimAchievement: (achievementType: AchievementType, tier: number) => {
    const { achievements, stats, blueCardCount, purpleCardCount, greenCardCount, superCardUnlockedCount, craftGoldCount } = get();
    const progressRaw = achievements[achievementType];
    const progress = progressRaw ?? {
      achievementType,
      currentTier: -1,
      claimedTiers: [],
    };
    // 兼容：历史存档可能把 claimedTiers 序列化成字符串
    const claimedTiers = (progress.claimedTiers ?? [])
      .map((x: any) => (typeof x === 'number' ? x : Number(x)))
      .filter((n: number) => Number.isFinite(n));
    
    // 验证：档位索引有效
    if (tier < 0) return false;
    
    // 获取配置
    const config = ACHIEVEMENT_CONFIGS[achievementType];
    if (!config) return false;
    
    // 验证：档位索引不能超出范围
    if (tier >= config.thresholds.length) return false;
    
    // 获取当前数值
    let currentCount = 0;
    if (achievementType in HAND_TYPE_NAMES) {
      // 牌型成就
      const stat = stats[achievementType as HandType] || { count: 0, totalScore: 0 };
      currentCount = stat.count;
    } else {
      // 新成就类型
      switch (achievementType) {
        case 'blue_card_count':
          currentCount = blueCardCount;
          break;
        case 'purple_card_count':
          currentCount = purpleCardCount;
          break;
        case 'green_card_count':
          currentCount = greenCardCount;
          break;
        case 'super_card_count':
          currentCount = superCardUnlockedCount;
          break;
        case 'craft_gold_count':
          currentCount = craftGoldCount;
          break;
      }
    }
    
    // 验证：档位必须已完成
    const threshold = config.thresholds[tier];
    if (currentCount < threshold) return false;
    
    // 验证：档位必须未领取
    if (claimedTiers.includes(tier)) return false;

    // 实现 A：禁止跨档领取（必须按顺序领取）
    for (let i = 0; i < tier; i++) {
      if (!claimedTiers.includes(i)) {
        return false;
      }
    }
    
    // 获取奖励（支持动态奖励）
    const reward = typeof config.reward === 'function' ? config.reward(threshold) : config.reward;
    
    // 更新状态
    set((state) => {
      const newAchievements = { ...state.achievements };
      const baseProgress = newAchievements[achievementType] ?? {
        achievementType,
        currentTier: -1,
        claimedTiers: [],
      };
      const baseClaimed = (baseProgress.claimedTiers ?? [])
        .map((x: any) => (typeof x === 'number' ? x : Number(x)))
        .filter((n: number) => Number.isFinite(n));
      newAchievements[achievementType] = {
        ...baseProgress,
        claimedTiers: [...baseClaimed, tier]
      };
      
      return {
        achievements: newAchievements,
        diamonds: state.diamonds + reward
      };
    });
    
    return true;
  },
  
  // 解锁一个属性牌位置
  unlockAttributeSlot: () => {
    const { money, unlockedAttributeSlots } = get();
    
    // 已经解锁所有位置
    if (unlockedAttributeSlots >= MAX_UNLOCKED_ATTRIBUTE_SLOTS) return false;
    
    const COST = 500;
    if (money < COST) return false;
    
    set((state) => ({
      money: state.money - COST,
      unlockedAttributeSlots: state.unlockedAttributeSlots + 1
    }));
    
    return true;
  },
  
  // 获取属性牌位置解锁费用
  getAttributeSlotUnlockCost: () => {
    const { unlockedAttributeSlots } = get();
    if (unlockedAttributeSlots >= MAX_UNLOCKED_ATTRIBUTE_SLOTS) {
      return 0;
    }
    // 初始 20 格，最多解锁到 MAX_UNLOCKED_ATTRIBUTE_SLOTS（阶梯价）
    if (unlockedAttributeSlots < 23) {
      return 100;
    }
    return 200;
  },

  // ========== 玩法系统 ==========
  
  // 设置当前玩法
  setGameMode: (gameModeId: string) => {
    const gameMode = getGameModeById(gameModeId);
    if (!gameMode) {
      console.error('玩法不存在:', gameModeId);
      return;
    }
    
    set({ currentGameModeId: gameModeId });
  },
  
  // 获取当前玩法配置
  getCurrentGameMode: () => {
    const { currentGameModeId } = get();
    if (!currentGameModeId) return null;
    return getGameModeById(currentGameModeId) || null;
  },
  
  // 更新当前玩法任务进度
  updateGameModeTaskProgress: (handType: HandType) => {
    const { currentGameModeId, gameModeTaskProgress } = get();
    if (!currentGameModeId) return;
    
    const gameMode = getGameModeById(currentGameModeId);
    if (!gameMode) {
      console.warn('⚠️ 玩法不存在:', currentGameModeId);
      return;
    }
    
    // 从 superCardUnlocks.json 获取任务配置
    const unlockConfig = getSuperCardUnlockByGameModeId(currentGameModeId);
    if (!unlockConfig) {
      console.warn('⚠️ 未找到解锁配置:', currentGameModeId);
      return;
    }
    
    const taskType = unlockConfig.unlockConditions.task.type;
    
    // 检查牌型是否匹配任务类型
    const isMatching = isHandTypeMatchingTask(handType, taskType);
    console.log('📊 任务匹配检查:', {
      玩法ID: currentGameModeId,
      玩法名: gameMode.name,
      牌型: handType,
      任务类型: taskType,
      是否匹配: isMatching
    });
    
    if (isMatching) {
      // 更新任务进度
      const newProgress = { ...gameModeTaskProgress };
      newProgress[currentGameModeId] = (newProgress[currentGameModeId] || 0) + 1;
      
      console.log('✅ 任务进度更新:', {
        玩法ID: currentGameModeId,
        新进度: newProgress[currentGameModeId]
      });
      
      set({ gameModeTaskProgress: newProgress });
      
      // 如果是超级牌解锁玩法，同步更新超级牌解锁进度
      if (gameMode.isSuperCardUnlock && gameMode.superCardId) {
        updateSuperCardTaskProgress(gameMode.superCardId, 1);
      }
    } else {
      console.log('❌ 牌型不匹配任务类型');
    }
  },
  
  // 支付超级牌解锁费用
  paySuperCardUnlockCost: (superCardId: string, cost: number) => {
    const { money } = get();
    
    if (money < cost) {
      return false;
    }
    
    // 扣除金钱
    set((state) => ({ money: state.money - cost }));
    
    // 标记为已支付
    payCost(superCardId);
    
    return true;
  },
  
  // 使用新系统解锁超级牌
  unlockSuperCardWithTask: (superCardId: string) => {
    const { activeDeck, reserveDeck } = get();
    
    // 尝试解锁
    const result = unlockSuperCardWithManager(superCardId);
    
    if (!result || !result.success) {
      return false;
    }
    
    // 解锁成功，自动切换到下一张超级牌的玩法
    if (result.nextGameModeId) {
      get().setGameMode(result.nextGameModeId);
      console.log('✅ 已自动切换到下一张超级牌玩法:', result.nextGameModeId);
    }
    
    // 解锁成功，将超级牌添加到牌池
    // 找到对应的超级牌索引
    const parts = superCardId.split('_');
    if (parts.length !== 2) return false;
    
    const [suitName, rankName] = parts;
    
    const suitMap: Record<string, Suit> = {
      'spades': 'spades',
      'hearts': 'hearts',
      'clubs': 'clubs',
      'diamonds': 'diamonds'
    };
    
    const rankMap: Record<string, Rank> = {
      'A': 14,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      '10': 10,
      'J': 11,
      'Q': 12,
      'K': 13
    };
    
    const suit = suitMap[suitName];
    const rank = rankMap[rankName];
    
    if (!suit || !rank) return false;
    const diamondReward = getSuperCardUnlockDiamondReward(suit);
    
    // 创建超级牌
    // 超级牌+15，能力介于蓝卡和紫卡之间
    const baseRankValue = rank >= 10 ? 10 : rank;
    const superCard: Card = {
      id: `super_${suit}_${rank}`,
      suit,
      rank,
      quality: 'super',
      effects: [],
      baseValue: baseRankValue + 15, // 超级牌+15特殊属性
      multiplier: 0
    };
    
    // 计算超级牌在固定区的位置（前52个位置，索引0-51）
    const fixedIndex = getFixedDeckIndex(suit, rank);
    
    // 替换固定区对应位置的白牌
    const newActiveDeck = [...activeDeck];
    let replaced = false;
    
    // 检查固定区位置是否有效，且该位置是白牌（可以替换）
    if (fixedIndex >= 0 && fixedIndex < 52 && fixedIndex < newActiveDeck.length) {
      const existingCard = newActiveDeck[fixedIndex];
      // 如果位置是白牌，或者已经是同花色的超级牌，则替换
      if (existingCard && (existingCard.quality === 'white' || 
          (existingCard.quality === 'super' && existingCard.suit === suit && existingCard.rank === rank))) {
        newActiveDeck[fixedIndex] = superCard;
        replaced = true;
      } else if (existingCard === null) {
        // 如果位置是空的，也添加
        newActiveDeck[fixedIndex] = superCard;
        replaced = true;
      }
    }
    
    // 如果替换失败（位置已有其他牌），添加到剩余牌池
    if (!replaced) {
      const newReserveDeck = [...reserveDeck, superCard];
      const { maxFlips } = get();
      set((state) => ({ 
        reserveDeck: newReserveDeck,
        superCardUnlockedCount: state.superCardUnlockedCount + 1,
        superCardUnlockedIds: [...state.superCardUnlockedIds, superCardId],
        flipsRemaining: maxFlips, // 解锁超级牌后恢复满体力
        lastRecoveryTime: Date.now(), // 重置恢复时间
        diamonds: state.diamonds + diamondReward // 按花色发放钻石奖励
      }));
    } else {
      const { maxFlips } = get();
      set((state) => ({ 
        activeDeck: newActiveDeck,
        superCardUnlockedCount: state.superCardUnlockedCount + 1,
        superCardUnlockedIds: [...state.superCardUnlockedIds, superCardId],
        flipsRemaining: maxFlips, // 解锁超级牌后恢复满体力
        lastRecoveryTime: Date.now(), // 重置恢复时间
        diamonds: state.diamonds + diamondReward // 按花色发放钻石奖励
      }));
    }
    
    return true;
  },

  // ========== Video Poker 模式 ==========
  
  // VPoker 翻牌：消耗体力，根据玩法配置抽取对应数量的牌
  flipVPokerCards: () => {
    const { flipsRemaining, activeDeck, isFlipped, isVideoPokerMode, vpokerReplaced, currentGameModeId } = get();
    
    // 检查条件
    if (flipsRemaining <= 0) return;
    if (isFlipped && !vpokerReplaced) return; // 如果已经翻牌但未换牌，不允许再次翻牌
    if (isVideoPokerMode && vpokerReplaced) return; // 如果已经换牌，不允许再次翻牌
    
    // 根据玩法配置决定发牌数量
    const currentGameMode = currentGameModeId ? getGameModeById(currentGameModeId) : null;
    const cardCount = currentGameMode && currentGameMode.cardCount ? currentGameMode.cardCount : 5;
    
    // 过滤出非空位的牌（只从上阵牌池抽取）
    const allAvailableCards = activeDeck.filter((card): card is Card => card !== null);
    if (allAvailableCards.length < cardCount) return;

    // 应用隐藏规则：筛选实际牌池（每个数值最多5张品质牌）
    const availableCards = filterActualDeck(allAvailableCards);
    if (availableCards.length < cardCount) return;

    const hand: Card[] = [];
    const deckCopy = [...availableCards];
    
    // 根据玩法配置抽取对应数量的牌
    for (let i = 0; i < cardCount; i++) {
      const randomIndex = Math.floor(Math.random() * deckCopy.length);
      hand.push(deckCopy[randomIndex]);
      deckCopy.splice(randomIndex, 1);
    }

    // Joker 生成逻辑：统一按玩法配置决定概率
    // 规则：只有 JOKER+ 玩法为 8%（0.08），其他玩法为 0%
    // 限制：手牌中最多只能有一张 Joker
    // 解锁条件：需要先解锁超级牌 ♠️2 (spades_2)
    const { jokerEnabled, superCardUnlockedIds, currentGameModeId: currentModeIdForJoker } = get();
    const hasJoker = hand.some(card => card.isJoker);
    const hasUnlockedSpades2 = superCardUnlockedIds.includes('spades_2');
    const gameMode = currentModeIdForJoker ? getGameModeById(currentModeIdForJoker) : null;
    const jokerProbability =
      gameMode && typeof gameMode.jokerProbability === 'number' ? gameMode.jokerProbability : 0;

    if (jokerEnabled && hasUnlockedSpades2 && hand.length > 0 && !hasJoker && jokerProbability > 0 && Math.random() < jokerProbability) {
      // 随机选择一张牌替换为 Joker
      const replaceIndex = Math.floor(Math.random() * hand.length);
      const jokerCard: Card = {
        id: `joker_${Date.now()}_${Math.random()}`,
        suit: 'spades', // 默认 suit，实际使用时会被替换
        rank: 2, // 默认 rank，实际使用时会被替换
        quality: 'white',
        effects: [],
        baseValue: 10, // 默认值，计分时使用替代的牌数值
        multiplier: 0,
        isJoker: true
      };
      hand[replaceIndex] = jokerCard;
    }

    set((state) => ({
      currentHand: hand,
      isFlipped: true,
      isVideoPokerMode: true,
      vpokerHeldCards: [],
      vpokerInitialHand: hand,
      vpokerReplaced: false,
      handResult: null, // 翻牌时不结算
      flipsRemaining: state.flipsRemaining - 1, // 消耗体力
      lastFlipTime: Date.now(),
    }));
  },

  // 切换 Hold 状态（点击切换）
  toggleVPokerHold: (index: number) => {
    const { isVideoPokerMode, vpokerReplaced, currentGameModeId, vpokerInitialHand } = get();
    
    // 只在 VPoker 模式且未换牌时可以切换 Hold
    if (!isVideoPokerMode || vpokerReplaced) return;
    
    // 根据玩法配置决定手牌数量
    const currentGameMode = currentGameModeId ? getGameModeById(currentGameModeId) : null;
    const cardCount = currentGameMode && currentGameMode.cardCount ? currentGameMode.cardCount : (vpokerInitialHand?.length || 5);
    
    if (index < 0 || index >= cardCount) return;

    set((state) => {
      const heldCards = [...state.vpokerHeldCards];
      const holdIndex = heldCards.indexOf(index);
      
      if (holdIndex >= 0) {
        // 取消 Hold
        heldCards.splice(holdIndex, 1);
      } else {
        // 添加 Hold
        heldCards.push(index);
      }
      
      return {
        vpokerHeldCards: heldCards.sort((a, b) => a - b), // 排序保持一致性
      };
    });
  },

  // 换牌逻辑：替换未 Hold 的牌
  replaceVPokerCards: () => {
    const { 
      isVideoPokerMode, 
      vpokerReplaced, 
      vpokerInitialHand, 
      vpokerHeldCards, 
      activeDeck, 
      currentGameModeId
    } = get();
    
    // 检查条件
    if (!isVideoPokerMode) return;
    if (vpokerReplaced) return; // 已经换过牌了
    if (!vpokerInitialHand || vpokerInitialHand.length === 0) return;

    // 根据玩法配置决定手牌数量
    const currentGameMode = currentGameModeId ? getGameModeById(currentGameModeId) : null;
    const cardCount = currentGameMode && currentGameMode.cardCount ? currentGameMode.cardCount : 5;
    
    // 检查初始手牌数量是否匹配
    if (vpokerInitialHand.length !== cardCount) {
      console.warn(`初始手牌数量不匹配：期望 ${cardCount} 张，实际 ${vpokerInitialHand.length} 张`);
      return;
    }

    // 仅从上阵牌池抽换牌（与 flipVPokerCards 一致，不包含剩余牌池）
    const allAvailableCardsRaw = activeDeck.filter((card): card is Card => card !== null);
    
    // 排除已翻出的牌
    const initialHandIds = new Set(vpokerInitialHand.map(card => card.id));
    const allAvailableCards = allAvailableCardsRaw.filter(card => !initialHandIds.has(card.id));
    
    // 应用隐藏规则：筛选实际牌池（每个数值最多5张品质牌）
    // 注意：需要考虑已 Hold 的牌，确保最终手牌中每个数值最多5张
    const availableCards = filterActualDeck(allAvailableCards);
    
    // 需要替换的牌数量
    const replaceCount = cardCount - vpokerHeldCards.length;
    
    if (availableCards.length < replaceCount) {
      // 理论上不会发生，因为每手牌只换一次，但为了安全还是检查
      console.warn('牌池不足，无法完成换牌');
      return;
    }

    // 构建最终手牌：保留 Hold 的牌，替换其他牌
    const finalHand: Card[] = [];
    const deckCopy = [...availableCards];
    
    for (let i = 0; i < cardCount; i++) {
      if (vpokerHeldCards.includes(i)) {
        // 保留 Hold 的牌
        finalHand.push(vpokerInitialHand[i]);
      } else {
        // 随机替换
        const randomIndex = Math.floor(Math.random() * deckCopy.length);
        finalHand.push(deckCopy[randomIndex]);
        deckCopy.splice(randomIndex, 1);
      }
    }

    // Joker 生成逻辑：统一按玩法配置决定概率
    // 规则：只有 JOKER+ 玩法为 8%（0.08），其他玩法为 0%
    // 限制：手牌中最多只能有一张 Joker（包括初始手牌中可能已有的 Joker）
    // 解锁条件：需要先解锁超级牌 ♠️2 (spades_2)
    const { jokerEnabled, superCardUnlockedIds, currentGameModeId: currentModeIdForJoker } = get();
    const hasJoker = finalHand.some(card => card.isJoker);
    const hasUnlockedSpades2 = superCardUnlockedIds.includes('spades_2');
    const gameMode = currentModeIdForJoker ? getGameModeById(currentModeIdForJoker) : null;
    const jokerProbability =
      gameMode && typeof gameMode.jokerProbability === 'number' ? gameMode.jokerProbability : 0;

    if (jokerEnabled && hasUnlockedSpades2 && finalHand.length > 0 && !hasJoker && jokerProbability > 0 && Math.random() < jokerProbability) {
      // 随机选择一张牌替换为 Joker（不能是已 Hold 的牌）
      const replaceableIndices: number[] = [];
      for (let i = 0; i < cardCount; i++) {
        if (!vpokerHeldCards.includes(i)) {
          replaceableIndices.push(i);
        }
      }
      if (replaceableIndices.length > 0) {
        const replaceIndex = replaceableIndices[Math.floor(Math.random() * replaceableIndices.length)];
        const jokerCard: Card = {
          id: `joker_${Date.now()}_${Math.random()}`,
          suit: 'spades', // 默认 suit，实际使用时会被替换
          rank: 2, // 默认 rank，实际使用时会被替换
          quality: 'white',
          effects: [],
          baseValue: 10, // 默认值，计分时使用替代的牌数值
          multiplier: 0,
          isJoker: true
        };
        finalHand[replaceIndex] = jokerCard;
      }
    }

    // 计算牌型（使用玩法规则评估，如果有当前玩法）
    // 注意：currentGameModeId 已经在函数开头从 get() 中获取了
    let result: HandResult;
    
    if (currentGameModeId) {
      const gameMode = getGameModeById(currentGameModeId);
      if (gameMode) {
        // 使用玩法规则评估
        console.log('🎮 VPoker评估牌型:', {
          玩法: gameMode.name,
          cardCount: gameMode.cardCount,
          finalHand数量: finalHand.length,
          finalHand: finalHand.map(c => `${c.rank}${c.isJoker ? '(J)' : ''}`),
          extraRules: gameMode.extraRules
        });
        result = evaluateHandWithRules(finalHand, gameMode);
        console.log('🎮 VPoker评估结果:', {
          type: result.type,
          name: result.name,
          score: result.score,
          scoringCardIds: result.scoringCardIds,
          scoringCardCount: result.scoringCardIds?.length
        });
      } else {
        // 玩法不存在，使用标准评估
        result = calculateHandScore(finalHand, cardCount);
      }
    } else {
      // 没有当前玩法，使用标准评估
      result = calculateHandScore(finalHand, cardCount);
    }

    // 更新统计和成就（与普通翻牌一致）
    set((state) => {
      const newStats = { ...state.stats };
      // 更新统计：次数和总收益
      if (!newStats[result.type]) {
        newStats[result.type] = { count: 0, totalScore: 0 };
      }
      newStats[result.type] = {
        count: newStats[result.type].count + 1,
        totalScore: newStats[result.type].totalScore + result.score
      };

      // 检测成就进度（牌型成就，带5张牌构成限制）
      const newAchievements = { ...state.achievements };
      if (result.type !== 'high_card' && newAchievements[result.type]) {
        const currentCount = newStats[result.type].count;
        newAchievements[result.type] = checkAchievementProgressWithCardLimit(
          result.type,
          currentCount,
          newAchievements[result.type],
          cardCount,
          result.scoringCardIds?.length
        );
      }
      
      // （已移除）单回合最高收益成就

      // 更新最佳手牌
      const newBestHands = [...state.bestHands, result]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // 更新每日收益记录
      const newDailyEarnings = { ...state.dailyEarnings };
      const today = new Date().toISOString().split('T')[0];
      if (newDailyEarnings.date !== today) {
        newDailyEarnings.date = today;
        newDailyEarnings.records = [];
        newDailyEarnings.handCount = 0;
      }
      newDailyEarnings.records.push(result.score);
      newDailyEarnings.handCount += 1;

      return {
        currentHand: finalHand,
        handResult: result,
        vpokerReplaced: true,
        isFlipped: false, // 先设置为 false，让新卡显示为未翻牌状态，触发翻牌动画
        money: state.money + result.score,
        diamonds: state.diamonds + (result.diamondReward || 0), // 添加钻石奖励
        stats: newStats,
        achievements: newAchievements,
        bestHands: newBestHands,
        dailyEarnings: newDailyEarnings,
      };
    });
    
    // 更新当前玩法任务进度（VPoker 模式换牌后）
    const { tutorialStage, currentGameModeId: currentModeId } = get();
    if (tutorialStage === 'complete' && currentModeId) {
      const gameMode = getGameModeById(currentModeId);
      if (gameMode) {
        const unlockConfig = getSuperCardUnlockByGameModeId(currentModeId);
        console.log('📊 VPoker换牌后更新任务进度:', {
          玩法ID: currentModeId,
          玩法名: gameMode.name,
          牌型: result.type,
          任务类型: unlockConfig?.unlockConditions.task.type || 'unknown'
        });
        const { updateGameModeTaskProgress } = get();
        updateGameModeTaskProgress(result.type);
      }
    }
  },

  // 重置 VPoker 状态
  resetVPokerState: () => {
    set({
      isVideoPokerMode: false,
      vpokerHeldCards: [],
      vpokerInitialHand: null,
      vpokerReplaced: false,
      currentHand: [],
      handResult: null,
      isFlipped: false,
    });
  },

  // 设置翻牌状态（用于换牌动画）
  setFlipped: (flipped: boolean) => {
    set({ isFlipped: flipped });
  },
    }),
    {
      name: 'poker-game-storage', // localStorage key
      version: 11, // 升级版本号：更新已有卡牌的倍数效果
      partialize: (state) => ({
        // 只持久化这些字段
        money: state.money,
        flipsRemaining: state.flipsRemaining,
        maxFlips: state.maxFlips, // 持久化体力上限
        lastRecoveryTime: state.lastRecoveryTime,
        activeDeck: state.activeDeck,
        reserveDeck: state.reserveDeck,
        bestHands: state.bestHands,
        stats: state.stats,
        drawsSincePurple: state.drawsSincePurple, // 保底计数器
        tutorialStage: state.tutorialStage, // 前置阶段状态
        unlockedCardSlots: state.unlockedCardSlots, // 已解锁牌位
        tutorialFlipCount: state.tutorialFlipCount, // 各牌数阶段的翻牌计数
        skillMaxFlips: state.skillMaxFlips, // 技能等级
        skillRecoverSpeed: state.skillRecoverSpeed,
        skillAutoFlipSpeed: state.skillAutoFlipSpeed,
        skill6Cards: state.skill6Cards, // 6张玩法
        skill7Cards: state.skill7Cards, // 7张玩法
        unlockedAttributeSlots: state.unlockedAttributeSlots, // 已解锁属性牌位置
        dailyEarnings: state.dailyEarnings, // 每日收益记录
        superCardUnlockedCount: state.superCardUnlockedCount, // 超级扑克牌解锁数量
        superCardUnlockedIds: state.superCardUnlockedIds, // 超级扑克牌解锁ID列表
        diamonds: state.diamonds, // 钻石数量
        achievements: state.achievements, // 成就进度
        blueCardCount: state.blueCardCount,
        purpleCardCount: state.purpleCardCount,
        greenCardCount: state.greenCardCount,
        craftBlueCount: state.craftBlueCount,
        craftPurpleCount: state.craftPurpleCount,
        craftGoldCount: state.craftGoldCount,
        jokerEnabled: state.jokerEnabled, // Joker 玩法开关
      }),
      migrate: (persistedState: any, version: number) => {
        // 迁移旧版本数据
        if (version === 0) {
          // 从版本0升级：转换stats格式
          if (persistedState.stats) {
            const newStats: Record<string, { count: number; totalScore: number }> = {};
            Object.entries(persistedState.stats).forEach(([type, value]) => {
              if (typeof value === 'number') {
                // 旧格式：只有count
                newStats[type] = { count: value, totalScore: 0 };
              } else {
                // 已经是新格式
                newStats[type] = value as { count: number; totalScore: number };
              }
            });
            persistedState.stats = newStats;
          }
        }
        // 从版本1升级：添加前置阶段状态
        if (version <= 1) {
          // 老用户：直接完成前置阶段
          persistedState.tutorialStage = 'complete';
          persistedState.unlockedCardSlots = 5;
          persistedState.tutorialFlipCount = {};
        }
        // 从版本4升级：强制修复固定区顺序为 2-A
        if (version <= 4) {
          if (persistedState.activeDeck && Array.isArray(persistedState.activeDeck)) {
            const activeDeck = persistedState.activeDeck;
            // 总是重新排序固定区为 2-A 顺序
            if (activeDeck.length >= 52) {
              const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
              const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 2-A 顺序
              
              // 重新构建固定区（前52张）
              const fixedCards: (Card | null)[] = [];
              const qualityCards: Card[] = [];
              
              // 收集所有固定区的牌（白色或超级牌）
              const fixedCardsMap = new Map<string, Card>();
              for (let i = 0; i < 52 && i < activeDeck.length; i++) {
                const card = activeDeck[i];
                if (card && (card.quality === 'white' || card.quality === 'super')) {
                  const key = `${card.suit}-${card.rank}`;
                  fixedCardsMap.set(key, card);
                }
              }
              
              // 按 2-A 顺序重新排列固定区
              for (const suit of suits) {
                for (const rank of ranks) {
                  const key = `${suit}-${rank}`;
                  const card = fixedCardsMap.get(key);
                  if (card) {
                    fixedCards.push(card);
                  } else {
                    // 如果找不到对应的牌，创建一个白色牌
                    fixedCards.push({
                      id: `card_${fixedCards.length + 1}`,
                      suit,
                      rank,
                      quality: 'white',
                      effects: [],
                      baseValue: rank >= 10 ? 10 : rank,
                      multiplier: 0,
                    });
                  }
                }
              }
              
              // 收集属性牌区的牌（后48张）
              for (let i = 52; i < activeDeck.length && i < 100; i++) {
                const card = activeDeck[i];
                if (card) {
                  qualityCards.push(card);
                }
              }
              
              // 重新构建 activeDeck
              const newActiveDeck: (Card | null)[] = [...fixedCards];
              
              // 属性牌优先填充空位（最多48张）
              for (let i = 0; i < Math.min(48, qualityCards.length); i++) {
                newActiveDeck.push(qualityCards[i]);
              }
              
              // 填充剩余空位
              while (newActiveDeck.length < 100) {
                newActiveDeck.push(null);
              }
              
              persistedState.activeDeck = newActiveDeck;
            }
          }
        }
        
        // 从版本2升级：将 deck 拆分为 activeDeck 和 reserveDeck
        if (version <= 2) {
          if (persistedState.deck && Array.isArray(persistedState.deck)) {
            const oldDeck: Card[] = persistedState.deck;
            // 前52张白色牌和超级牌保留在上阵牌池（按位置）
            // 需要按照标准顺序排列：spades 2-A, hearts 2-A, clubs 2-A, diamonds 2-A
            const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
            const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 2-A 顺序
            
            const activeDeck: (Card | null)[] = [];
            const qualityCards: Card[] = [];
            
            // 构建标准52张牌的位置（白色或超级牌）
            for (const suit of suits) {
              for (const rank of ranks) {
                const card = oldDeck.find(c => c.suit === suit && c.rank === rank && (c.quality === 'white' || c.quality === 'super'));
                if (card) {
                  activeDeck.push(card);
                } else {
                  // 如果找不到对应的牌，创建一个白色牌
                  activeDeck.push({
                    id: `card_${activeDeck.length + 1}`,
                    suit,
                    rank,
                    quality: 'white',
                    effects: [],
                    baseValue: rank >= 10 ? 10 : rank,
                    multiplier: 0,
                  });
                }
              }
            }
            
            // 其他品质牌（绿色、蓝色、紫色等）
            const otherCards = oldDeck.filter(c => c.quality !== 'white' && c.quality !== 'super');
            qualityCards.push(...otherCards);
            
            // 品质牌优先填充上阵牌池空位（最多48张）
            for (let i = 0; i < Math.min(48, qualityCards.length); i++) {
              activeDeck.push(qualityCards[i]);
            }
            
            // 剩余品质牌进入剩余牌池
            const reserveDeck: Card[] = [];
            for (let i = 48; i < qualityCards.length; i++) {
              reserveDeck.push(qualityCards[i]);
            }
            
            // 填充剩余空位
            while (activeDeck.length < 100) {
              activeDeck.push(null);
            }
            
            persistedState.activeDeck = activeDeck;
            persistedState.reserveDeck = reserveDeck;
            delete persistedState.deck;
          } else {
            // 如果没有 deck，初始化新的结构
            persistedState.activeDeck = generateInitialActiveDeck();
            persistedState.reserveDeck = [];
          }
        }
        // 从版本5升级：添加成就系统
        if (version <= 5) {
          if (!persistedState.diamonds) {
            persistedState.diamonds = 0;
          }
          if (!persistedState.achievements) {
            persistedState.achievements = createInitialAchievements();
          }
        }
        // 从版本7升级：添加 Joker 玩法开关（默认开启）
        if (version <= 7) {
          if (persistedState.jokerEnabled === undefined) {
            persistedState.jokerEnabled = true;
          }
        }
        // 从版本8升级到版本9：属性牌区默认开放20格
        if (version <= 8) {
          // 如果当前解锁数量小于20，升级到20
          if (!persistedState.unlockedAttributeSlots || persistedState.unlockedAttributeSlots < 20) {
            persistedState.unlockedAttributeSlots = 20;
          }
        }
        // 从版本9升级到版本10：强制修复固定区顺序为 2-A
        if (version <= 10) {
          if (persistedState.activeDeck && Array.isArray(persistedState.activeDeck)) {
            const activeDeck = persistedState.activeDeck;
            // 总是重新排序固定区为 2-A 顺序
            if (activeDeck.length >= 52) {
              const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
              const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 2-A 顺序
              
              // 重新构建固定区（前52张）
              const fixedCards: (Card | null)[] = [];
              const qualityCards: Card[] = [];
              
              // 收集所有固定区的牌（白色或超级牌）
              const fixedCardsMap = new Map<string, Card>();
              for (let i = 0; i < 52 && i < activeDeck.length; i++) {
                const card = activeDeck[i];
                if (card && (card.quality === 'white' || card.quality === 'super')) {
                  const key = `${card.suit}-${card.rank}`;
                  fixedCardsMap.set(key, card);
                }
              }
              
              // 按 2-A 顺序重新排列固定区
              for (const suit of suits) {
                for (const rank of ranks) {
                  const key = `${suit}-${rank}`;
                  const card = fixedCardsMap.get(key);
                  if (card) {
                    fixedCards.push(card);
                  } else {
                    // 如果找不到对应的牌，创建一个白色牌
                    fixedCards.push({
                      id: `card_${fixedCards.length + 1}`,
                      suit,
                      rank,
                      quality: 'white',
                      effects: [],
                      baseValue: rank >= 10 ? 10 : rank,
                      multiplier: 0,
                    });
                  }
                }
              }
              
              // 收集属性牌区的牌（后48张）
              for (let i = 52; i < activeDeck.length && i < 100; i++) {
                const card = activeDeck[i];
                if (card) {
                  qualityCards.push(card);
                }
              }
              
              // 重新构建 activeDeck
              const newActiveDeck: (Card | null)[] = [...fixedCards];
              
              // 属性牌优先填充空位（最多48张）
              for (let i = 0; i < Math.min(48, qualityCards.length); i++) {
                newActiveDeck.push(qualityCards[i]);
              }
              
              // 填充剩余空位
              while (newActiveDeck.length < 100) {
                newActiveDeck.push(null);
              }
              
              persistedState.activeDeck = newActiveDeck;
            }
          }
        }
        // 从版本10升级到版本11：更新已有卡牌的倍数效果
        if (version <= 10) {
          // 更新卡牌倍数效果的辅助函数
          const updateCardMultiplier = (card: any): Card => {
            if (!card.effects || card.effects.length === 0) return card as Card;
            
            const updatedEffects = card.effects.map((effect: any) => {
              if (effect.type === 'multiplier') {
                // 蓝色品质：倍数从 4 改为 3
                if (card.quality === 'blue' && effect.value === 4) {
                  return { ...effect, value: 3 };
                }
                // 紫色品质：单效果倍数从 8 改为 6
                if (card.quality === 'purple' && effect.value === 8) {
                  return { ...effect, value: 6 };
                }
                // 紫色品质：组合效果倍数从 4 改为 3（双花+倍数、跨数值+倍数）
                if (card.quality === 'purple' && effect.value === 4) {
                  // 检查是否有其他效果（双花或跨数值）
                  const hasDoubleSuit = card.effects.some((e: any) => e.type === 'double_suit');
                  const hasCrossValue = card.effects.some((e: any) => e.type === 'cross_value');
                  if (hasDoubleSuit || hasCrossValue) {
                    return { ...effect, value: 3 };
                  }
                }
              }
              return effect;
            });
            
            return { ...card, effects: updatedEffects } as Card;
          };
          
          // 更新 activeDeck
          if (persistedState.activeDeck && Array.isArray(persistedState.activeDeck)) {
            persistedState.activeDeck = persistedState.activeDeck.map((card: any) => 
              card ? updateCardMultiplier(card) : card
            );
          }
          
          // 更新 reserveDeck
          if (persistedState.reserveDeck && Array.isArray(persistedState.reserveDeck)) {
            persistedState.reserveDeck = persistedState.reserveDeck.map(updateCardMultiplier);
          }
        }

        // 兼容：新增成就类型时，为老存档补齐缺失的成就key（不覆盖已有进度）
        {
          const initial = createInitialAchievements();
          if (persistedState.achievements && typeof persistedState.achievements === 'object') {
            persistedState.achievements = {
              ...initial,
              ...persistedState.achievements,
            };
          } else {
            persistedState.achievements = initial;
          }
        }

        if (
          typeof persistedState.unlockedAttributeSlots === 'number' &&
          persistedState.unlockedAttributeSlots > MAX_UNLOCKED_ATTRIBUTE_SLOTS
        ) {
          persistedState.unlockedAttributeSlots = MAX_UNLOCKED_ATTRIBUTE_SLOTS;
        }

        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        // 恢复时，根据技能等级重新计算体力上限
        if (state) {
          if (
            typeof state.unlockedAttributeSlots === 'number' &&
            state.unlockedAttributeSlots > MAX_UNLOCKED_ATTRIBUTE_SLOTS
          ) {
            state.unlockedAttributeSlots = MAX_UNLOCKED_ATTRIBUTE_SLOTS;
          }
          if (IS_DEV_TEST_BUILD) {
            const d = state.diamonds ?? 0;
            state.diamonds = Math.max(d, DEV_TEST_DIAMONDS_MIN);
          }
          const { skillMaxFlips } = state;
          const correctMaxFlips = Math.min(30, 20 + skillMaxFlips);
          if (state.maxFlips !== correctMaxFlips) {
            state.maxFlips = correctMaxFlips;
            // 如果当前体力超过新的上限，调整到上限
            if (state.flipsRemaining > correctMaxFlips) {
              state.flipsRemaining = correctMaxFlips;
            }
          }
        }
      },
    }
  )
);

