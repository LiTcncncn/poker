import React from 'react';
import { Card } from './Card';
import { Card as CardType, CardQuality } from '../types/poker';
import { X, Lock } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

interface DeckViewProps {
  activeDeck: (CardType | null)[]; // 上阵牌池，100张固定位置
  reserveDeck: CardType[]; // 剩余牌池
  onClose: () => void;
}

export const DeckView: React.FC<DeckViewProps> = ({ activeDeck, reserveDeck, onClose }) => {
  const { addToActiveDeck, removeFromActiveDeck, unlockedAttributeSlots } = useGameStore();
  
  // 获取所有卡牌（用于统计）
  const allCards = [...activeDeck.filter((c): c is CardType => c !== null), ...reserveDeck];
  
  // 剩余牌池按品质排序：purple > blue > green > 其他
  const qualityOrder: Record<CardQuality, number> = {
    purple: 1,
    blue: 2,
    green: 3,
    orange: 4,
    super: 5,
    white: 6,
  };
  
  const sortedReserveDeck = [...reserveDeck].sort((a, b) => {
    const orderA = qualityOrder[a.quality] || 99;
    const orderB = qualityOrder[b.quality] || 99;
    return orderA - orderB;
  });

  const handleActiveCardClick = (index: number) => {
    // 点击属性牌区，移除到剩余牌池
    removeFromActiveDeck(index);
  };

  const handleReserveCardClick = (cardId: string) => {
    // 点击剩余牌池的牌，自动上阵（如有空位）
    addToActiveDeck(cardId);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col border-2 border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-3xl font-bold text-slate-100">我的牌池</h2>
            <p className="text-slate-400 mt-1">
              上阵牌池: {activeDeck.filter(c => c !== null).length}/100 | 
              剩余牌池: {reserveDeck.length} | 
              总计: {allCards.length} 张
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>


        {/* Content: Two Sections */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 上阵牌池区域 */}
          <div className="flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-100">上阵牌池 (100张)</h3>
              <span className="text-sm text-slate-400">
                {activeDeck.filter(c => c !== null).length}/100
              </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-3 space-y-4">
              {/* 上半区：固定区（白色牌或超级牌），每行13张 A-K */}
              <div>
                <div className="mb-2 text-sm text-slate-400">固定区（52张）</div>
                <div className="grid grid-cols-13 gap-0.5 justify-items-center">
                  {activeDeck.slice(0, 52).map((card, index) => (
                    <div 
                      key={index} 
                      className="flex justify-center items-center relative"
                    >
                      {card ? (
                        <div 
                          className="scale-[0.5] sm:scale-[0.6] origin-center transition-all cursor-not-allowed"
                          title="白色牌和超级牌不可替换"
                        >
                          <Card 
                            card={card} 
                            isFlipped={true}
                            showDetails={false}
                            className="transition-transform duration-200"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-12 sm:w-10 sm:h-14 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
                          <span className="text-xs text-slate-500">空</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 下半区：属性牌区，每行5张 */}
              <div>
                <div className="mb-2 text-sm text-slate-400">属性牌区（{unlockedAttributeSlots}/48 已解锁）</div>
                <div className="grid grid-cols-5 gap-1 justify-items-center">
                  {activeDeck.slice(52, 100).map((card, index) => {
                    const actualIndex = index + 52;
                    const isUnlocked = index < unlockedAttributeSlots;
                    
                    return (
                      <div 
                        key={actualIndex} 
                        className="flex justify-center items-center relative"
                      >
                        {!isUnlocked ? (
                          // 未解锁位置：显示锁定图标
                          <div 
                            className="w-12 h-16 sm:w-16 sm:h-24 rounded-lg border-2 border-slate-700 bg-slate-800/80 flex flex-col items-center justify-center"
                            title="未解锁"
                          >
                            <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 mb-1" />
                            <span className="text-xs text-slate-500">锁定</span>
                          </div>
                        ) : card ? (
                          <div 
                            onClick={() => handleActiveCardClick(actualIndex)}
                            className="scale-[0.7] sm:scale-90 origin-center transition-all cursor-pointer"
                            title="点击移除到剩余牌池"
                          >
                            <Card 
                              card={card} 
                              isFlipped={true}
                              showDetails={false}
                              className="hover:scale-110 hover:z-10 transition-transform duration-200"
                            />
                          </div>
                        ) : (
                          <div 
                            className="w-12 h-16 sm:w-16 sm:h-24 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center"
                            title="空位"
                          >
                            <span className="text-xs text-slate-500">空</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 剩余牌池区域 */}
          <div className="flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-100">剩余牌池</h3>
              <span className="text-sm text-slate-400">{sortedReserveDeck.length} 张</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-3">
              {sortedReserveDeck.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                  <p className="text-xl">暂无剩余牌</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 sm:gap-1 justify-items-center">
                  {sortedReserveDeck.map((card, index) => (
                    <div 
                      key={`${card.id}-${index}`} 
                      className="flex justify-center items-center relative"
                    >
                      <div 
                        onClick={() => handleReserveCardClick(card.id)}
                        className="scale-[0.7] sm:scale-90 origin-center cursor-pointer transition-all"
                        title="点击自动上阵（如有空位）"
                      >
                        <Card 
                          card={card} 
                          isFlipped={true}
                          showDetails={false}
                          className="hover:scale-110 hover:z-10 transition-transform duration-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
