/**
 * 超级扑克牌价格计算
 * 价格递增规律：每次递增金额增加$100
 * 第1张：$300
 * 第2张：$500（+$200）
 * 第3张：$800（+$300）
 * 第4张：$1,200（+$400）
 * ...
 */

export const SUPER_CARD_PRICES: number[] = (() => {
  const prices: number[] = [];
  let currentPrice = 300;
  let increment = 200;
  
  for (let i = 0; i < 52; i++) {
    prices.push(currentPrice);
    currentPrice += increment;
    increment += 100; // 每次递增金额增加100
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
 * 根据花色和数值获取超级扑克牌的索引
 * @param suit 花色
 * @param rank 数值
 */
export function getSuperCardIndex(suit: string, rank: number): number {
  const suitOrder: Record<string, number> = {
    'spades': 0,    // ♠️ 0-12
    'hearts': 1,    // ♥️ 13-25
    'clubs': 2,     // ♣️ 26-38
    'diamonds': 3,  // ♦️ 39-51
  };
  
  const rankOrder = rank === 14 ? 0 : rank - 1; // A=0, 2=1, 3=2, ..., K=12
  
  return suitOrder[suit] * 13 + rankOrder;
}

/**
 * 根据索引获取超级扑克牌的花色和数值
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
  const rank = rankIndex === 0 ? 14 : rankIndex + 1; // A=14, 2=2, 3=3, ..., K=13
  
  return { suit, rank };
}










