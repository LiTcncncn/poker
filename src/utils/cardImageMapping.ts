import { Card, Suit } from '../types/poker';

/**
 * 扑克牌图片映射
 * 根据花色和数值返回对应的图片编号
 * 
 * 假设图片顺序：
 * poker1-13: 黑桃 A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
 * poker14-26: 红心 A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
 * poker27-39: 梅花 A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
 * poker40-52: 方块 A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
 */
export const getCardImagePath = (card: Card): string => {
  // Joker 牌使用 poker53.png
  if (card.isJoker) {
    return `${import.meta.env.BASE_URL}pokers/poker53.png`;
  }
  
  // 白色品质使用真实图片
  if (card.quality === 'white') {
    const suitOrder: Record<Suit, number> = {
      spades: 0,    // 黑桃 1-13
      hearts: 1,    // 红心 14-26
      clubs: 2,     // 梅花 27-39
      diamonds: 3,  // 方块 40-52
    };

    // Rank 14 = A, 应该是每组的第一张
    // Rank 2-13 按顺序排列
    let rankIndex: number;
    if (card.rank === 14) {
      // A 是第一张
      rankIndex = 1;
    } else {
      // 2-13 按顺序
      rankIndex = card.rank;
    }

    const imageNumber = suitOrder[card.suit] * 13 + rankIndex;
    return `${import.meta.env.BASE_URL}pokers/poker${imageNumber}.png`;
  }
  
  // 绿色、蓝色等品质暂时返回空（继续使用CSS绘制）
  return '';
};

/**
 * 获取牌背图片路径
 */
export const getCardBackImagePath = (): string => {
  return `${import.meta.env.BASE_URL}pokers/poker_back_arena.png`;
};

