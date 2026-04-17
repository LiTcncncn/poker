import React, { useState } from 'react';
import { Card } from './Card';
import { Card as CardType } from '../types/poker';
import { X, Wand2, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

/** 与「我的牌池」属性牌区同规格格位，排列更紧密 */
const CRAFT_POOL_CELL =
  'flex h-[5.25rem] w-14 shrink-0 items-center justify-center sm:h-24 sm:w-16';
const CRAFT_CARD_W = 120;
const CRAFT_CARD_H = 180;

/** 合成蓝牌 / 合成紫牌共用操作按钮尺寸，避免两种模式不一致 */
const CRAFT_ACTION_RESET_CLASS =
  'min-h-10 shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-600 sm:min-h-11 sm:px-5 sm:py-2.5 sm:text-base';
const CRAFT_ACTION_PRIMARY_CLASS =
  'min-h-10 shrink-0 rounded-lg px-5 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-2 sm:min-h-11 sm:px-6 sm:py-2.5 sm:text-base';

interface CraftViewProps {
  allCards: CardType[]; // 总牌池（上阵+剩余）
  onClose: () => void;
  onCraftBlue: (selectedIds: string[]) => CardType | null;
  onCraftPurple: (selectedIds: string[]) => CardType | null;
  onCraftGold: (selectedIds: string[]) => CardType | null;
}

export const CraftView: React.FC<CraftViewProps> = ({ 
  allCards, 
  onClose, 
  onCraftBlue, 
  onCraftPurple,
  onCraftGold
}) => {
  const [craftMode, setCraftMode] = useState<'blue' | 'purple' | 'gold'>('blue');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [craftedCard, setCraftedCard] = useState<CardType | null>(null);

  // 筛选可用于合成的卡牌
  const greenCards = allCards.filter(c => c.quality === 'green');
  const blueCards = allCards.filter(c => c.quality === 'blue');
  const purpleCards = allCards.filter(c => c.quality === 'purple');

  // 生成卡牌的唯一标识 key（用于判断两张卡牌是否完全相同）
  const getCardKey = (card: CardType): string => {
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
    const diamondPart = card.isDiamondCard ? (card.diamondBonus ?? 20) : 0;
    return `${card.suit}-${rankPart}-${effectsStr}-diamond:${diamondPart}`;
  };

  // 找出重复的蓝色卡牌（用于紫色合成）- 已移除，不再需要
  // const blueCardGroups = blueCards.reduce((groups, card) => {
  //   const key = `${card.suit}-${card.rank}-${card.effects.map(e => `${e.type}:${e.value}`).join('|')}`;
  //   if (!groups[key]) groups[key] = [];
  //   groups[key].push(card);
  //   return groups;
  // }, {} as Record<string, CardType[]>);

  const handleCardClick = (cardId: string) => {
    if (craftedCard) return; // 已合成，不能再选择

    const maxSelection = craftMode === 'blue' ? 10 : craftMode === 'purple' ? 5 : 2;
    
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
    } else if (craftMode === 'purple') {
      if (selectedCards.length === 5) {
        // 验证：至少有2张完全相同的蓝牌
        const selectedCardObjects = blueCards.filter(card => selectedCards.includes(card.id));
        if (selectedCardObjects.length === 5) {
          const cardGroups: CardType[][] = [];
          selectedCardObjects.forEach(card => {
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
          const hasPair = cardGroups.some(group => group.length >= 2);
          if (hasPair) {
            result = onCraftPurple(selectedCards);
          }
        }
      }
    } else {
      if (selectedCards.length === 2) {
        const selectedCardObjects = purpleCards.filter(card => selectedCards.includes(card.id));
        if (selectedCardObjects.length === 2 && getCardKey(selectedCardObjects[0]) === getCardKey(selectedCardObjects[1])) {
          result = onCraftGold(selectedCards);
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
    return cardGroups.some(group => group.length >= 2);
  };

  const canCraft = craftMode === 'blue' 
    ? selectedCards.length === 10
    : craftMode === 'purple'
      ? canCraftPurple()
      : (() => {
          if (selectedCards.length !== 2) return false;
          const selectedCardObjects = purpleCards.filter(card => selectedCards.includes(card.id));
          if (selectedCardObjects.length !== 2) return false;
          return getCardKey(selectedCardObjects[0]) === getCardKey(selectedCardObjects[1]);
        })();

  // 合成紫卡时显示所有蓝牌（不限于重复的），让用户可以选择任意5张（其中至少2张相同）
  // 对蓝卡进行排序：相同卡牌排在最前面，其他按牌面顺序排列
  const sortedBlueCards = (() => {
    if (craftMode !== 'purple') return blueCards;
    
    // 按 key 分组
    const cardGroups: Record<string, CardType[]> = {};
    blueCards.forEach(card => {
      const key = getCardKey(card);
      if (!cardGroups[key]) {
        cardGroups[key] = [];
      }
      cardGroups[key].push(card);
    });
    
    // 分离有相同卡牌的组和没有相同卡牌的组
    const duplicateGroups: CardType[][] = [];
    const singleGroups: CardType[][] = [];
    
    Object.values(cardGroups).forEach(group => {
      if (group.length >= 2) {
        duplicateGroups.push(group);
      } else {
        singleGroups.push(group);
      }
    });
    
    // 排序函数：按 suit 和 rank 排序
    const sortByCard = (a: CardType, b: CardType): number => {
      const suitOrder: Record<string, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
      const suitDiff = (suitOrder[a.suit] ?? 0) - (suitOrder[b.suit] ?? 0);
      if (suitDiff !== 0) return suitDiff;
      return a.rank - b.rank;
    };
    
    // 对每个组内的卡牌排序
    duplicateGroups.forEach(group => group.sort(sortByCard));
    singleGroups.forEach(group => group.sort(sortByCard));
    
    // 对组本身排序（按第一张卡牌）
    duplicateGroups.sort((a, b) => sortByCard(a[0], b[0]));
    singleGroups.sort((a, b) => sortByCard(a[0], b[0]));
    
    // 合并：先是有相同卡牌的组，然后是单独的卡牌
    return [...duplicateGroups.flat(), ...singleGroups.flat()];
  })();
  
  // 合成金卡：紫卡排序（相同卡牌优先）
  const sortedPurpleCards = (() => {
    if (craftMode !== 'gold') return purpleCards;

    const cardGroups: Record<string, CardType[]> = {};
    purpleCards.forEach(card => {
      const key = getCardKey(card);
      if (!cardGroups[key]) {
        cardGroups[key] = [];
      }
      cardGroups[key].push(card);
    });

    const duplicateGroups: CardType[][] = [];
    const singleGroups: CardType[][] = [];

    Object.values(cardGroups).forEach(group => {
      if (group.length >= 2) {
        duplicateGroups.push(group);
      } else {
        singleGroups.push(group);
      }
    });

    const sortByCard = (a: CardType, b: CardType): number => {
      const suitOrder: Record<string, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
      const suitDiff = (suitOrder[a.suit] ?? 0) - (suitOrder[b.suit] ?? 0);
      if (suitDiff !== 0) return suitDiff;
      return a.rank - b.rank;
    };

    duplicateGroups.forEach(group => group.sort(sortByCard));
    singleGroups.forEach(group => group.sort(sortByCard));
    duplicateGroups.sort((a, b) => sortByCard(a[0], b[0]));
    singleGroups.sort((a, b) => sortByCard(a[0], b[0]));

    return [...duplicateGroups.flat(), ...singleGroups.flat()];
  })();

  const hasCraftableGold = (() => {
    const grouped: Record<string, number> = {};
    purpleCards.forEach((card) => {
      const key = getCardKey(card);
      grouped[key] = (grouped[key] ?? 0) + 1;
    });
    return Object.values(grouped).some((count) => count >= 2);
  })();
  
  const availableCards = craftMode === 'blue' ? greenCards : craftMode === 'purple' ? sortedBlueCards : sortedPurpleCards;

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="craft-view-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-600/50 bg-slate-900/35 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <Wand2 className="h-7 w-7 shrink-0 text-purple-400 sm:h-8 sm:w-8" aria-hidden />
          <h2
            id="craft-view-title"
            className="truncate text-2xl font-bold text-slate-100 sm:text-3xl"
          >
            卡牌合成
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-700/80"
        >
          <X className="h-6 w-6 text-slate-400" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] sm:p-4">
        {/* Mode Selector */}
        <div className="border-b border-slate-600/50 pb-3 sm:pb-4">
          <div className="flex gap-2 sm:gap-4">
            <button
              type="button"
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
              <span className="text-sm sm:text-lg">合成蓝牌</span>
            </button>
            <button
              type="button"
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
              <span className="text-sm sm:text-lg">合成紫牌</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCraftMode('gold');
                setSelectedCards([]);
                setCraftedCard(null);
              }}
              className={clsx(
                "relative flex-1 px-2 sm:px-6 py-2 sm:py-4 rounded-lg sm:rounded-xl font-bold transition-all border-2 text-xs sm:text-base",
                craftMode === 'gold'
                  ? "bg-amber-500 text-white border-amber-300 shadow-lg shadow-amber-500/50"
                  : "bg-slate-700/50 text-slate-300 border-amber-500/50 hover:bg-slate-700"
              )}
            >
              <span className="text-sm sm:text-lg">合成金牌</span>
              {hasCraftableGold && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 shadow-sm" />
              )}
            </button>
          </div>
        </div>

        {/* Selection Status */}
        <div className="py-3 sm:py-4">
          {craftMode === 'purple' ? (() => {
            // 计算卡牌分组
            const selectedCardObjects = blueCards.filter(card => selectedCards.includes(card.id));
            const cardGroups: CardType[][] = [];
            selectedCardObjects.forEach(card => {
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
                  <div className="text-sm font-medium text-slate-300 sm:text-base">
                    相同蓝牌（需要 2 张）
                  </div>
                  <div className="flex gap-2 sm:gap-3 justify-center sm:justify-start">
                    {[0, 1].map((index) => {
                      const card = sameCards[index];
                      const isFilled = !!card;
                      
                      return (
                        <div
                          key={`same-${index}`}
                          className={clsx(
                            CRAFT_POOL_CELL,
                            'relative rounded-lg sm:rounded-xl border-2 border-dashed transition-all',
                            isFilled
                              ? hasEnoughSame
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-yellow-500 bg-yellow-500/10'
                              : 'border-slate-600 bg-slate-800/50'
                          )}
                        >
                          {card ? (
                            <div className="absolute inset-0 overflow-hidden [container-type:inline-size]">
                              <div
                                style={{
                                  width: CRAFT_CARD_W,
                                  height: CRAFT_CARD_H,
                                  transform: 'scale(calc(100cqw / 120px))',
                                  transformOrigin: 'top left',
                                }}
                              >
                                <Card
                                  card={card}
                                  isFlipped
                                  showDetails={false}
                                  className="max-w-none cursor-pointer"
                                  style={{ width: CRAFT_CARD_W, height: CRAFT_CARD_H }}
                                  onClick={() =>
                                    setSelectedCards(selectedCards.filter((id) => id !== card.id))
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xl text-slate-500 sm:text-2xl">+</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* 第二行：3个任意蓝卡框 */}
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="text-sm font-medium text-slate-300 sm:text-base">
                    任意蓝牌（需要 3 张）
                  </div>
                  <div className="flex gap-2 sm:gap-3 justify-center sm:justify-start flex-wrap">
                    {[0, 1, 2].map((index) => {
                      const card = anyCards[index];
                      const isFilled = !!card;
                      
                      return (
                        <div
                          key={`any-${index}`}
                          className={clsx(
                            CRAFT_POOL_CELL,
                            'relative rounded-lg sm:rounded-xl border-2 border-dashed transition-all',
                            isFilled
                              ? hasEnoughAny
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-yellow-500 bg-yellow-500/10'
                              : 'border-slate-600 bg-slate-800/50'
                          )}
                        >
                          {card ? (
                            <div className="absolute inset-0 overflow-hidden [container-type:inline-size]">
                              <div
                                style={{
                                  width: CRAFT_CARD_W,
                                  height: CRAFT_CARD_H,
                                  transform: 'scale(calc(100cqw / 120px))',
                                  transformOrigin: 'top left',
                                }}
                              >
                                <Card
                                  card={card}
                                  isFlipped
                                  showDetails={false}
                                  className="max-w-none cursor-pointer"
                                  style={{ width: CRAFT_CARD_W, height: CRAFT_CARD_H }}
                                  onClick={() =>
                                    setSelectedCards(selectedCards.filter((id) => id !== card.id))
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xl text-slate-500 sm:text-2xl">+</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              
              {/* 操作按钮 */}
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                {selectedCards.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className={CRAFT_ACTION_RESET_CLASS}
                  >
                    重置
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCraft}
                  disabled={!canCraft}
                  className={clsx(
                    CRAFT_ACTION_PRIMARY_CLASS,
                    canCraft
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                      : 'cursor-not-allowed bg-slate-700 text-slate-500'
                  )}
                >
                  <Wand2 className="h-5 w-5 shrink-0" />
                  开始合成
                </button>
              </div>
            </div>
            );
          })() : craftMode === 'gold' ? (() => {
            const selectedCardObjects = purpleCards.filter(card => selectedCards.includes(card.id));
            const hasEnough = selectedCardObjects.length === 2
              && getCardKey(selectedCardObjects[0]) === getCardKey(selectedCardObjects[1]);

            return (
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="text-sm font-medium text-slate-300 sm:text-base">
                    相同紫牌（需要 2 张）
                  </div>
                  <div className="flex gap-2 sm:gap-3 justify-center sm:justify-start">
                    {[0, 1].map((index) => {
                      const card = selectedCardObjects[index];
                      const isFilled = !!card;
                      return (
                        <div
                          key={`gold-same-${index}`}
                          className={clsx(
                            CRAFT_POOL_CELL,
                            'relative rounded-lg sm:rounded-xl border-2 border-dashed transition-all',
                            isFilled
                              ? hasEnough
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-yellow-500 bg-yellow-500/10'
                              : 'border-slate-600 bg-slate-800/50'
                          )}
                        >
                          {card ? (
                            <div className="absolute inset-0 overflow-hidden [container-type:inline-size]">
                              <div
                                style={{
                                  width: CRAFT_CARD_W,
                                  height: CRAFT_CARD_H,
                                  transform: 'scale(calc(100cqw / 120px))',
                                  transformOrigin: 'top left',
                                }}
                              >
                                <Card
                                  card={card}
                                  isFlipped
                                  showDetails={false}
                                  className="max-w-none cursor-pointer"
                                  style={{ width: CRAFT_CARD_W, height: CRAFT_CARD_H }}
                                  onClick={() =>
                                    setSelectedCards(selectedCards.filter((id) => id !== card.id))
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xl text-slate-500 sm:text-2xl">+</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  {selectedCards.length > 0 && (
                    <button type="button" onClick={handleReset} className={CRAFT_ACTION_RESET_CLASS}>
                      重置
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCraft}
                    disabled={!canCraft}
                    className={clsx(
                      CRAFT_ACTION_PRIMARY_CLASS,
                      canCraft
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600'
                        : 'cursor-not-allowed bg-slate-700 text-slate-500'
                    )}
                  >
                    <Wand2 className="h-5 w-5 shrink-0" />
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
              <div className="flex flex-wrap gap-3">
                {selectedCards.length > 0 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className={CRAFT_ACTION_RESET_CLASS}
                  >
                    重置
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCraft}
                  disabled={!canCraft}
                  className={clsx(
                    CRAFT_ACTION_PRIMARY_CLASS,
                    canCraft
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                      : 'cursor-not-allowed bg-slate-700 text-slate-500'
                  )}
                >
                  <Wand2 className="h-5 w-5 shrink-0" />
                  开始合成
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Grid */}
        <div className="pb-4 pt-1">
          {availableCards.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="text-xl">
                {craftMode === 'blue' 
                  ? '没有可用的绿色品质卡牌'
                  : craftMode === 'purple'
                    ? '没有可用的蓝色品质卡牌'
                    : '没有可用的紫色品质卡牌'
                }
              </p>
              <p className="text-sm mt-2">
                {craftMode === 'blue' 
                  ? '通过抽卡获取更多绿色卡牌'
                  : craftMode === 'purple'
                    ? '需要 5 张蓝色卡牌（其中至少 2 张完全相同）才能合成'
                    : '需要 2 张完全相同的紫牌才能合成金牌'
                }
              </p>
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <div className="inline-grid grid-cols-5 justify-items-stretch gap-x-1 gap-y-1">
                {availableCards.map((card, index) => {
                  const isSelected = selectedCards.includes(card.id);
                  return (
                  <div key={`${card.id}-${index}`} className={CRAFT_POOL_CELL}>
                    <button
                      type="button"
                      onClick={() => handleCardClick(card.id)}
                      className={clsx(
                        'relative h-full w-full cursor-pointer overflow-hidden p-0 [container-type:inline-size]',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                        !isSelected && 'hover:brightness-110'
                      )}
                    >
                      <div
                        style={{
                          width: CRAFT_CARD_W,
                          height: CRAFT_CARD_H,
                          transform: 'scale(calc(100cqw / 120px))',
                          transformOrigin: 'top left',
                        }}
                      >
                        <Card
                          card={card}
                          isFlipped
                          showDetails={false}
                          className="max-w-none pointer-events-none"
                          style={{ width: CRAFT_CARD_W, height: CRAFT_CARD_H }}
                        />
                      </div>
                      {isSelected && (
                        <div
                          className="pointer-events-none absolute inset-0 bg-slate-950/55"
                          aria-hidden
                        />
                      )}
                      {isSelected && (
                        <div className="absolute right-0.5 top-0.5 rounded-full bg-emerald-600 p-0.5 sm:p-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
                        </div>
                      )}
                    </button>
                  </div>
                  );
                })}
              </div>
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
              craftedCard.quality === 'purple' && "text-purple-400 animate-pulse",
              craftedCard.quality === 'gold' && "text-amber-300"
            )}>
              获得 {craftedCard.quality === 'blue' ? '蓝色' : craftedCard.quality === 'purple' ? '紫色' : '金色'} 品质卡牌
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
            type="button"
            onClick={() => {
              setCraftedCard(null);
              setSelectedCards([]);
            }}
            className="mt-12 px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-colors"
          >
            继续合成
          </button>

          {/* 特效 */}
          {(craftedCard.quality === 'purple' || craftedCard.quality === 'gold') && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className={clsx(
                    "absolute w-2 h-2 rounded-full animate-ping",
                    craftedCard.quality === 'gold' ? 'bg-amber-300' : 'bg-purple-400'
                  )}
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

