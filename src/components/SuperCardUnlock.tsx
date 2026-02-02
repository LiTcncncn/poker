import React from 'react';
import { useGameStore } from '../store/gameStore';
import { getSuperCardIndex } from '../utils/superCardPrices';
import clsx from 'clsx';

interface SuperCardUnlockProps {
  onUnlock?: (cardIndex: number, suit: string, rank: number) => void;
}

export const SuperCardUnlock: React.FC<SuperCardUnlockProps> = ({ onUnlock }) => {
  const { 
    money, 
    superCardUnlockedCount,
    getCurrentSuperCardInfo, 
    getCurrentSuperCardPrice,
    unlockSuperCard 
  } = useGameStore();
  
  const cardInfo = getCurrentSuperCardInfo();
  const price = getCurrentSuperCardPrice();
  
  // 如果已解锁所有超级扑克牌，不显示
  if (!cardInfo || superCardUnlockedCount >= 52) {
    return null;
  }
  
  const { suit, rank } = cardInfo;
  const canAfford = money >= price;
  
  // 获取图片路径
  const cardIndex = getSuperCardIndex(suit, rank);
  const imagePath = `${import.meta.env.BASE_URL}pokers/poker${cardIndex + 1}.png`;
  
  const handleUnlock = () => {
    if (canAfford) {
      const result = unlockSuperCard();
      if (result && result.success && onUnlock) {
        onUnlock(result.cardIndex, result.suit, result.rank);
      }
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 rounded-xl sm:rounded-2xl shadow-lg border-2 border-purple-500/60 w-[270px] h-[270px] sm:w-[200px] sm:h-[200px] md:w-[240px] md:h-[240px] aspect-square">
      {/* 当前超级扑克牌显示 */}
      <div className="relative flex-1 flex items-center justify-center">
        <div className="relative w-32 h-44 sm:w-28 sm:h-40 md:w-36 md:h-52 rounded-lg overflow-hidden">
          <img 
            src={imagePath}
            alt="Super Card"
            className="w-full h-full object-cover"
            draggable={false}
          />
          {/* 金色闪光特效 */}
          <div className="absolute inset-0 animate-super-card-glow pointer-events-none" />
        </div>
      </div>
      
      {/* 解锁按钮 */}
      <button
        onClick={handleUnlock}
        disabled={!canAfford}
        className={clsx(
          "w-full px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-sm md:text-base font-bold transition-all text-center flex-shrink-0",
          canAfford
            ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105 animate-button-pulse-strong"
            : "bg-slate-700 text-slate-500 cursor-not-allowed"
        )}
      >
        ${price.toLocaleString()}
      </button>
    </div>
  );
};

