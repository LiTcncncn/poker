import { create } from 'zustand';
import { Card, CardQuality, HandResult, Rank, Suit } from '../types/poker';
import { calculateHandScore } from '../utils/pokerLogic';

// 初始牌池生成 helper
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

interface GameState {
  // 资源
  money: number;
  
  // 翻牌相关
  flipsRemaining: number;
  maxFlips: number;
  lastRecoveryTime: number; // 上次恢复体力的时间

  // Actions
  flipCards: () => void;
  resetHand: () => void; 
  drawCard: () => void; 
  recoverEnergy: () => void; // 恢复体力逻辑
  toggleAutoFlip: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  money: 0,
  flipsRemaining: 20,
  maxFlips: 20,
  lastFlipTime: Date.now(),
  lastRecoveryTime: Date.now(),
  isAutoFlipping: false,
  
  deck: generateInitialDeck(),
  currentHand: [],
  handResult: null,
  isFlipped: false,
  
  bestHands: [],
  stats: {},

  flipCards: () => {
    const { flipsRemaining, deck, isFlipped } = get();
    
    if (flipsRemaining <= 0) return;
    if (isFlipped) return; 

    const hand: Card[] = [];
    const deckCopy = [...deck];
    
    if (deckCopy.length < 5) return;

    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * deckCopy.length);
      hand.push(deckCopy[randomIndex]);
      deckCopy.splice(randomIndex, 1);
    }

    const result = calculateHandScore(hand);

    set((state) => {
        const newStats = { ...state.stats };
        newStats[result.type] = (newStats[result.type] || 0) + 1;

        const newBestHands = [...state.bestHands, result]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        return {
            currentHand: hand,
            handResult: result,
            isFlipped: true,
            flipsRemaining: state.flipsRemaining - 1,
            lastFlipTime: Date.now(),
            money: state.money + result.score,
            stats: newStats,
            bestHands: newBestHands
        };
    });
  },

  resetHand: () => {
    set({ 
        currentHand: [], 
        handResult: null, 
        isFlipped: false 
    });
  },

  drawCard: () => {
     // ... (keep existing logic)
     const { money, deck } = get();
     const COST = 100;
     
     if (money < COST) return;

     // 抽卡逻辑
     const isBlue = Math.random() < 0.2;
     const quality: CardQuality = isBlue ? 'blue' : 'green';
     
     const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
     const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
     
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
     
     if (quality === 'green') {
         const types = ['high_score', 'multiplier', 'double_suit', 'cross_value'];
         const type = types[Math.floor(Math.random() * types.length)];
         
         if (type === 'high_score') {
            newCard.effects.push({ type: 'high_score', value: 3 });
         } else if (type === 'multiplier') {
            newCard.effects.push({ type: 'multiplier', value: 2 });
         } else if (type === 'double_suit') {
             const otherSuits = suits.filter(s => s !== newCard.suit);
             const secondSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
             newCard.effects.push({ type: 'double_suit', suits: [newCard.suit, secondSuit] });
         } else if (type === 'cross_value') {
             // 随机分配一个包含当前数值的组合，例如 234, 567, 89t, jqk (11,12,13), A (14)
             const groups: Rank[][] = [
                 [2, 3, 4],
                 [5, 6, 7],
                 [8, 9, 10],
                 [11, 12, 13], // J, Q, K
                 [12, 13, 14], // Q, K, A (just a fallback or specific group)
             ];
             // 寻找包含当前数值的组，优先匹配
             let targetGroup = groups.find(g => g.includes(newCard.rank));
             // 如果没找到（比如 A 可能只在某些组，或者有特殊处理），就取默认或最近的
             if (!targetGroup) {
                 if (newCard.rank === 14) targetGroup = [12, 13, 14];
                 else targetGroup = [newCard.rank, newCard.rank + 1, newCard.rank + 2].filter(r => r <= 14) as Rank[];
             }
             
             newCard.effects.push({ type: 'cross_value', ranks: targetGroup });
         }
     }

     set((state) => ({
         money: state.money - COST,
         deck: [...state.deck, newCard]
     }));
  },

  recoverEnergy: () => {
      set((state) => {
          const now = Date.now();
          if (state.flipsRemaining >= state.maxFlips) {
              return { lastRecoveryTime: now };
          }
          
          const timeSinceLastRecover = now - state.lastRecoveryTime;
          const RECOVER_INTERVAL = 5000; // 5秒

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
  
  // Removed tick, replaced with explicit actions
  tick: () => {}, 
  
  toggleAutoFlip: () => set(state => ({ isAutoFlipping: !state.isAutoFlipping })),
}));

