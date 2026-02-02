import React, { useEffect } from 'react';
import { getSuperCardIndex } from '../utils/superCardPrices';
import { Gem } from 'lucide-react';

interface SuperCardUnlockModalProps {
  cardIndex: number;
  suit: string;
  rank: number;
  onClose: () => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠️',
  hearts: '♥️',
  clubs: '♣️',
  diamonds: '♦️',
};

const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const SuperCardUnlockModal: React.FC<SuperCardUnlockModalProps> = ({
  cardIndex,
  suit,
  rank,
  onClose,
}) => {
  // 获取图片路径
  const imageIndex = getSuperCardIndex(suit, rank);
  const imagePath = `${import.meta.env.BASE_URL}pokers/poker${imageIndex + 1}.png`;
  
  // 3秒后自动关闭
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-yellow-500/30 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400">
            赎回第 {cardIndex + 1} 张超级牌
          </h2>
        </div>
        
        {/* 牌面展示 */}
        <div className="flex justify-center mb-6">
          <div className="relative w-32 h-48 sm:w-40 sm:h-60 rounded-xl overflow-hidden shadow-2xl">
            <img 
              src={imagePath}
              alt={`${SUIT_SYMBOLS[suit]}${RANK_NAMES[rank]}`}
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* 金色闪光特效 */}
            <div className="absolute inset-0 animate-super-card-glow pointer-events-none" />
          </div>
        </div>
        
        {/* 属性说明 */}
        <div className="text-center mb-4">
          <div className="text-3xl sm:text-5xl font-black text-yellow-400">
            每次计分+30
          </div>
          <div className="text-sm sm:text-base text-slate-400 mt-2">
            已替换牌池中对应的白色牌
          </div>
        </div>
        
        {/* 奖励信息 */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-cyan-400">
            <span className="text-xl sm:text-2xl font-bold">+100</span>
            <Gem className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
        
        {/* 体力已充满提示 */}
        <div className="text-center mb-4">
          <div className="text-base sm:text-lg text-green-400 font-semibold">
            体力已充满
          </div>
        </div>
        
        {/* 关闭提示 */}
        <div className="text-center text-xs sm:text-sm text-slate-500 animate-pulse">
          点击任意处关闭
        </div>
      </div>
    </div>
  );
};

