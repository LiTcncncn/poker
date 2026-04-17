/**
 * 超级扑克牌价格计算
 * 按花色步长递增：♠️2-A 步长+100，♥️2-A 步长+200，♣️2-A 步长+300，♦️2-A 步长+500
 * 首张 $300，之后每张 price += increment，每张后 increment += 当前花色步长
 */

const STEP_DELTA_BY_SUIT = [100, 200, 300, 500]; // ♠️ ♥️ ♣️ ♦️

export const SUPER_CARD_PRICES: number[] = (() => {
  const prices: number[] = [];
  let currentPrice = 300;
  let increment = 200;
  for (let i = 0; i < 52; i++) {
    prices.push(currentPrice);
    const suitIndex = Math.floor(i / 13);
    currentPrice += increment;
    increment += STEP_DELTA_BY_SUIT[suitIndex];
  }
  return prices;
})();

/**
 * 获取超级扑克牌的价格
 * @param index 索引 (0-51)
 */
export function getSuperCardPrice(index: number): number {
  if (index < 0 || index >= 52) {
    return 0;
  }
  return SUPER_CARD_PRICES[index];
}

/** 超级牌解锁钻石奖励：♠️/♥️/♣️/♦️ = 50/100/200/300（与 gameStore 发放一致） */
export function getSuperCardUnlockDiamondReward(suit: string): number {
  const rewardMap: Record<string, number> = {
    spades: 50,
    hearts: 100,
    clubs: 200,
    diamonds: 300,
  };
  return rewardMap[suit] ?? 100;
}

/**
 * 获取超级扑克牌的累计价格（解锁到第n张需要的总价）
 * @param index 索引 (0-51)
 */
export function getSuperCardTotalPrice(index: number): number {
  if (index < 0) return 0;
  if (index >= 52) index = 51;
  
  return SUPER_CARD_PRICES.slice(0, index + 1).reduce((sum, price) => sum + price, 0);
}

/**
 * 根据花色和数值获取超级扑克牌的索引（0–51，与解锁/价格顺序一致）
 * @param suit 花色
 * @param rank 数值（A,2,3…K → A=0, 2=1, …, K=12）
 */
export function getSuperCardIndex(suit: string, rank: number): number {
  const suitOrder: Record<string, number> = {
    'spades': 0,    // ♠️ 0-12
    'hearts': 1,    // ♥️ 13-25
    'clubs': 2,     // ♣️ 26-38
    'diamonds': 3,  // ♦️ 39-51
  };
  
  // A,2,3...K 顺序：A=0, 2=1, 3=2, ..., K=12
  const rankOrder = rank === 14 ? 0 : rank - 1;
  
  return suitOrder[suit] * 13 + rankOrder;
}

/**
 * 固定区位置索引（用于固定区显示与替换位置）
 * 固定区每行按 2-A 顺序排列（2=0, 3=1, ..., A=12）
 */
export function getFixedDeckIndex(suit: string, rank: number): number {
  const suitOrder: Record<string, number> = {
    'spades': 0,
    'hearts': 1,
    'clubs': 2,
    'diamonds': 3,
  };

  const rankOrder = rank === 14 ? 12 : rank - 2;
  return suitOrder[suit] * 13 + rankOrder;
}

/**
 * 根据索引获取超级扑克牌的花色和数值（与 getSuperCardIndex 配套：A,2,3...K）
 * @param index 索引 (0-51)
 */
export function getSuperCardFromIndex(index: number): { suit: string; rank: number } | null {
  if (index < 0 || index >= 52) {
    return null;
  }
  
  const suits: string[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const suitIndex = Math.floor(index / 13);
  const rankIndex = index % 13;
  
  const suit = suits[suitIndex];
  const rank = rankIndex === 0 ? 14 : rankIndex + 1; // A=14, 2=2, ..., K=13
  
  return { suit, rank };
}










