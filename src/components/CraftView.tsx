import React, { useState } from 'react';
import { Card } from './Card';
import { Card as CardType } from '../types/poker';
import { X, Wand2, CheckCircle2, Info } from 'lucide-react';
import clsx from 'clsx';

interface CraftViewProps {
  allCards: CardType[]; // 总牌池（上阵+剩余）
  onClose: () => void;
  onCraftBlue: (selectedIds: string[]) => CardType | null;
  onCraftPurple: (selectedIds: string[]) => CardType | null;
}

export const CraftView: React.FC<CraftViewProps> = ({ 
  allCards, 
  onClose, 
  onCraftBlue, 
  onCraftPurple 
}) => {
  const [craftMode, setCraftMode] = useState<'blue' | 'purple'>('blue');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [craftedCard, setCraftedCard] = useState<CardType | null>(null);

  // 筛选可用于合成的卡牌
  const greenCards = allCards.filter(c => c.quality === 'green');
  const blueCards = allCards.filter(c => c.quality === 'blue');

  // 找出重复的蓝色卡牌（用于紫色合成）- 已移除，不再需要
  // const blueCardGroups = blueCards.reduce((groups, card) => {
  //   const key = `${card.suit}-${card.rank}-${card.effects.map(e => `${e.type}:${e.value}`).join('|')}`;
  //   if (!groups[key]) groups[key] = [];
  //   groups[key].push(card);
  //   return groups;
  // }, {} as Record<string, CardType[]>);

  const handleCardClick = (cardId: string) => {
    if (craftedCard) return; // 已合成，不能再选择

    const maxSelection = craftMode === 'blue' ? 10 : 5;
    
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
    } else {
      if (selectedCards.length < maxSelection) {
        setSelectedCards([...selectedCards, cardId]);
      }
    }
  };

  const handleCraft = () => {
    let result: CardType | null = null;
    
    if (craftMode === 'blue') {
      if (selectedCards.length === 10) {
        result = onCraftBlue(selectedCards);
      }
    } else {
      if (selectedCards.length === 5) {
        // 验证：至少有2张完全相同的蓝牌
        const selectedCardObjects = blueCards.filter(card => selectedCards.includes(card.id));
        if (selectedCardObjects.length === 5) {
          const cardGroups: CardType[][] = [];
          selectedCardObjects.forEach(card => {
            const key = `${card.suit}-${card.rank}-${card.effects.map(e => `${e.type}:${e.value ?? ''}`).join('|')}`;
            let found = false;
            for (const group of cardGroups) {
              if (group.length > 0) {
                const first = group[0];
                const firstKey = `${first.suit}-${first.rank}-${first.effects.map(e => `${e.type}:${e.value ?? ''}`).join('|')}`;
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
          const hasPair = cardGroups.some(group => group.length >= 2);
          if (hasPair) {
            result = onCraftPurple(selectedCards);
          }
        }
      }
    }
    
    if (result) {
      setCraftedCard(result);
      setSelectedCards([]);
    }
  };

  const handleReset = () => {
    setCraftedCard(null);
    setSelectedCards([]);
  };

  // 合成紫卡：需要5张蓝牌，且至少有2张完全相同
  const canCraftPurple = () => {
    if (selectedCards.length !== 5) return false;
    const selectedCardObjects = blueCards.filter(card => selectedCards.includes(card.id));
    if (selectedCardObjects.length !== 5) return false;
    
    // 检查是否有至少2张完全相同的卡牌
    const cardGroups: CardType[][] = [];
    selectedCardObjects.forEach(card => {
      const key = `${card.suit}-${card.rank}-${card.effects.map(e => `${e.type}:${e.value ?? ''}`).join('|')}`;
      let found = false;
      for (const group of cardGroups) {
        if (group.length > 0) {
          const first = group[0];
          const firstKey = `${first.suit}-${first.rank}-${first.effects.map(e => `${e.type}:${e.value ?? ''}`).join('|')}`;
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
    return cardGroups.some(group => group.length >= 2);
  };

  const canCraft = craftMode === 'blue' 
    ? selectedCards.length === 10
    : canCraftPurple();

  // 合成紫卡时显示所有蓝牌（不限于重复的），让用户可以选择任意5张（其中至少2张相同）
  const availableCards = craftMode === 'blue' ? greenCards : blueCards;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[98vh] sm:max-h-[90vh] flex flex-col border-2 border-purple-500/50 my-2 sm:my-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-slate-700">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <Wand2 className="w-5 h-5 sm:w-8 sm:h-8 text-purple-400 flex-shrink-0" />
              <h2 className="text-xl sm:text-3xl font-bold text-slate-100 truncate">卡牌合成</h2>
            </div>
            <p className="text-slate-400 mt-1 text-xs sm:text-base">将低品质卡牌合成为高品质卡牌</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-2 sm:p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={() => {
                setCraftMode('blue');
                setSelectedCards([]);
                setCraftedCard(null);
              }}
              className={clsx(
                "flex-1 px-2 sm:px-6 py-2 sm:py-4 rounded-lg sm:rounded-xl font-bold transition-all border-2 text-xs sm:text-base",
                craftMode === 'blue'
                  ? "bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/50"
                  : "bg-slate-700/50 text-slate-300 border-blue-500/50 hover:bg-slate-700"
              )}
            >
              <div className="text-sm sm:text-lg">合成蓝卡</div>
              <div className="text-xs sm:text-sm opacity-80 mt-0.5 sm:mt-1">10 张绿卡 → 1 张蓝卡</div>
            </button>
            <button
              onClick={() => {
                setCraftMode('purple');
                setSelectedCards([]);
                setCraftedCard(null);
              }}
              className={clsx(
                "flex-1 px-2 sm:px-6 py-2 sm:py-4 rounded-lg sm:rounded-xl font-bold transition-all border-2 text-xs sm:text-base",
                craftMode === 'purple'
                  ? "bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/50 animate-pulse"
                  : "bg-slate-700/50 text-slate-300 border-purple-500/50 hover:bg-slate-700"
              )}
            >
              <div className="text-sm sm:text-lg">合成紫卡</div>
              <div className="text-xs sm:text-sm opacity-80 mt-0.5 sm:mt-1 leading-tight">2 张相同 + 3 张任意</div>
            </button>
          </div>

          {/* Info */}
          <div className="mt-2 sm:mt-4 flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400 bg-slate-900/50 p-2 sm:p-3 rounded-lg">
            <Info className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {craftMode === 'blue' 
                ? '选择任意 10 张绿色品质卡牌进行合成，将随机获得 1 张蓝色品质卡牌。'
                : '选择 5 张蓝色品质卡牌进行合成，其中至少需要 2 张完全相同的蓝卡（花色、数值、效果都相同），其余 3 张可以是任意蓝卡。将随机获得 1 张紫色品质卡牌。'
              }
            </div>
          </div>
        </div>

        {/* Selection Status */}
        <div className="p-3 sm:p-4 bg-slate-900/30 overflow-y-auto">
          {craftMode === 'purple' ? (() => {
            // 计算卡牌分组
            const selectedCardObjects = blueCards.filter(card => selectedCards.includes(card.id));
            const cardGroups: CardType[][] = [];
            selectedCardObjects.forEach(card => {
              const key = `${card.suit}-${card.rank}-${card.effects.map(e => `${e.type}:${e.value ?? ''}`).join('|')}`;
              let found = false;
              for (const group of cardGroups) {
                if (group.length > 0) {
                  const first = group[0];
                  const firstKey = `${first.suit}-${first.rank}-${first.effects.map(e => `${e.type}:${e.value ?? ''}`).join('|')}`;
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
            
            // 找出最大的相同卡牌组（至少2张）
            const sameCardGroups = cardGroups.filter(group => group.length >= 2);
            const maxSameGroup = sameCardGroups.length > 0 
              ? sameCardGroups.reduce((max, group) => group.length > max.length ? group : max, sameCardGroups[0])
              : null;
            
            // 第一行：相同蓝卡（从最大相同组中取前2张）
            const sameCards = maxSameGroup ? maxSameGroup.slice(0, 2) : [];
            const hasEnoughSame = sameCards.length >= 2;
            
            // 第二行：任意蓝卡（剩余的卡牌）
            const sameCardIds = sameCards.map(c => c.id);
            const anyCards = selectedCardObjects.filter(card => !sameCardIds.includes(card.id));
            const hasEnoughAny = anyCards.length >= 3;
            
            return (
              // 紫色合成：5个待加入框
              <div className="space-y-3 sm:space-y-4">
                {/* 第一行：2个相同蓝卡框 */}
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="text-xs sm:text-sm text-slate-400 font-medium">相同蓝卡（需要2张）</div>
                  <div className="flex gap-2 sm:gap-3 justify-center sm:justify-start">
                    {[0, 1].map((index) => {
                      const card = sameCards[index];
                      const isFilled = !!card;
                      
                      return (
                        <div
                          key={`same-${index}`}
                          className={clsx(
                            "relative w-14 sm:w-20 rounded-lg sm:rounded-xl border-2 border-dashed flex items-center justify-center transition-all flex-shrink-0 overflow-hidden",
                            isFilled
                              ? hasEnoughSame
                                ? "border-green-500 bg-green-500/10"
                                : "border-yellow-500 bg-yellow-500/10"
                              : "border-slate-600 bg-slate-800/50"
                          )}
                          style={{ aspectRatio: '2/3', height: 'auto' }} // 保持Card组件的默认宽高比 2:3
                        >
                          {card ? (
                            <div className="scale-[0.58] sm:scale-[0.83] origin-center">
                              <Card
                                card={card}
                                isFlipped={true}
                                onClick={() => setSelectedCards(selectedCards.filter(id => id !== card.id))}
                              />
                            </div>
                          ) : (
                            <span className="text-xl sm:text-2xl text-slate-500">+</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 第二行：3个任意蓝卡框 */}
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="text-xs sm:text-sm text-slate-400 font-medium">任意蓝卡（需要3张）</div>
                  <div className="flex gap-2 sm:gap-3 justify-center sm:justify-start flex-wrap">
                    {[0, 1, 2].map((index) => {
                      const card = anyCards[index];
                      const isFilled = !!card;
                      
                      return (
                        <div
                          key={`any-${index}`}
                          className={clsx(
                            "relative w-14 sm:w-20 rounded-lg sm:rounded-xl border-2 border-dashed flex items-center justify-center transition-all flex-shrink-0 overflow-hidden",
                            isFilled
                              ? hasEnoughAny
                                ? "border-green-500 bg-green-500/10"
                                : "border-yellow-500 bg-yellow-500/10"
                              : "border-slate-600 bg-slate-800/50"
                          )}
                          style={{ aspectRatio: '2/3', height: 'auto' }} // 保持Card组件的默认宽高比 2:3
                        >
                          {card ? (
                            <div className="scale-[0.58] sm:scale-[0.83] origin-center">
                              <Card
                                card={card}
                                isFlipped={true}
                                onClick={() => setSelectedCards(selectedCards.filter(id => id !== card.id))}
                              />
                            </div>
                          ) : (
                            <span className="text-xl sm:text-2xl text-slate-500">+</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-2 sm:gap-3 justify-end pt-2 flex-wrap">
                {selectedCards.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm sm:text-base"
                  >
                    重置
                  </button>
                )}
                <button
                  onClick={handleCraft}
                  disabled={!canCraft}
                  className={clsx(
                    "px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base",
                    canCraft
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/50 animate-pulse"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  )}
                >
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  开始合成
                </button>
              </div>
            </div>
            );
          })() : (
            // 蓝色合成：原有显示
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-lg text-slate-300">
                  已选择：
                  <span className={clsx(
                    "ml-2 font-bold",
                    canCraft ? "text-green-400" : "text-yellow-400"
                  )}>
                    {selectedCards.length} / 10
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                {selectedCards.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    重置
                  </button>
                )}
                <button
                  onClick={handleCraft}
                  disabled={!canCraft}
                  className={clsx(
                    "px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2",
                    canCraft
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/50"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  )}
                >
                  <Wand2 className="w-5 h-5" />
                  开始合成
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:p-4">
          {availableCards.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="text-xl">
                {craftMode === 'blue' 
                  ? '没有可用的绿色品质卡牌'
                  : '没有可用的蓝色品质卡牌'
                }
              </p>
              <p className="text-sm mt-2">
                {craftMode === 'blue' 
                  ? '通过抽卡获取更多绿色卡牌'
                  : '需要 5 张蓝色卡牌（其中至少 2 张完全相同）才能合成'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 sm:gap-1 justify-items-center">
              {availableCards.map((card, index) => (
                <div 
                  key={`${card.id}-${index}`} 
                  className="flex justify-center items-center relative"
                >
                  <div 
                    onClick={() => handleCardClick(card.id)}
                    className={clsx(
                      "relative cursor-pointer scale-[0.78] sm:scale-100 origin-center",
                      selectedCards.includes(card.id) && "opacity-50"
                    )}
                  >
                    <Card 
                      card={card} 
                      isFlipped={true}
                      showDetails={false}
                      className={clsx(
                        "transition-all duration-200",
                        selectedCards.includes(card.id)
                          ? "ring-4 ring-green-400"
                          : "hover:scale-110 hover:z-10"
                      )}
                    />
                    {selectedCards.includes(card.id) && (
                      <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Crafted Card Result */}
      {craftedCard && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="text-center mb-8">
            <div className="text-4xl font-bold text-white mb-2">合成成功！</div>
            <div className={clsx(
              "text-2xl font-semibold",
              craftedCard.quality === 'blue' && "text-blue-400",
              craftedCard.quality === 'purple' && "text-purple-400 animate-pulse"
            )}>
              获得 {craftedCard.quality === 'blue' ? '蓝色' : '紫色'} 品质卡牌
            </div>
          </div>

          <div className="transform scale-150 animate-in zoom-in duration-500">
            <Card 
              card={craftedCard} 
              isFlipped={true}
              showDetails={true}
            />
          </div>

          <button
            onClick={() => {
              setCraftedCard(null);
              setSelectedCards([]);
            }}
            className="mt-12 px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-colors"
          >
            继续合成
          </button>

          {/* 特效 */}
          {craftedCard.quality === 'purple' && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-purple-400 animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random()}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

