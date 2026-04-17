import React, { useEffect } from 'react';
import { getSuperCardUnlockDiamondReward } from '../utils/superCardPrices';
import { Gem } from 'lucide-react';
import { Card } from './Card';
import { buildSuperPreviewCard } from '../utils/superPreviewCard';

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
  const preview = buildSuperPreviewCard(suit, rank);
  const diamondReward = getSuperCardUnlockDiamondReward(suit);

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
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400">
            赎回第 {cardIndex + 1} 张超级牌
          </h2>
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative w-[min(42vw,11rem)] min-[1320px]:w-52 aspect-[2/3] max-w-[220px]">
            <Card
              card={preview}
              isFlipped={true}
              className="shadow-2xl"
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="text-3xl sm:text-5xl font-black text-yellow-400">
            每次计分+15
          </div>
          <div className="text-sm sm:text-base text-slate-400 mt-2">
            已替换牌池中对应的白色牌
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-xl sm:text-2xl font-bold text-cyan-400">
            <Gem className="w-6 h-6 sm:w-8 sm:h-8" />
            <span>+{diamondReward} 钻石</span>
          </div>
          <div className="text-sm text-slate-400 mt-2">
            {SUIT_SYMBOLS[suit]}
            {RANK_NAMES[rank]} 花色首次解锁奖励
          </div>
        </div>

        <div className="text-center text-sm text-slate-500">点击任意处关闭</div>
      </div>
    </div>
  );
};
