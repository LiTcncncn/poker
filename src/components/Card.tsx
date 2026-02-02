import React from 'react';
import clsx from 'clsx';
import { Card as CardType } from '../types/poker';
import { getRankDisplay } from '../utils/pokerLogic';
import { getCardBackImagePath, getCardImagePath } from '../utils/cardImageMapping';
import { getSuperCardIndex } from '../utils/superCardPrices';

interface CardProps {
  card: CardType;
  isFlipped: boolean;
  isScoring?: boolean; // 是否参与计分
  isHeld?: boolean; // 是否被 Hold（VPoker 模式）
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  showDetails?: boolean;
}

const suitSymbols: Record<string, string> = {
  spades: '♠️',
  hearts: '♥️',
  clubs: '♣️',
  diamonds: '♦️',
};

const suitColors: Record<string, string> = {
  spades: 'text-gray-900',
  hearts: 'text-red-600',
  clubs: 'text-gray-900',
  diamonds: 'text-red-600',
};

const qualityStyles: Record<string, string> = {
  white: 'border-gray-300 bg-white',
  green: 'border-green-500 bg-gradient-to-br from-green-200 to-emerald-300 shadow-[0_0_20px_rgba(34,197,94,0.5)] ring-2 ring-green-400/50',
  blue: 'border-blue-500 bg-gradient-to-br from-blue-200 to-cyan-300 shadow-[0_0_25px_rgba(59,130,246,0.6)] ring-2 ring-blue-400/60',
  purple: 'border-purple-500 bg-gradient-to-br from-purple-200 via-fuchsia-300 to-purple-200 shadow-[0_0_35px_rgba(168,85,247,0.8)] ring-4 ring-purple-400/70',
  orange: 'border-orange-500 bg-orange-200',
  super: 'border-yellow-500 bg-gradient-to-br from-yellow-200 via-amber-300 to-yellow-200 shadow-[0_0_30px_rgba(234,179,8,0.6)] ring-2 ring-yellow-400/60',
};

export const Card: React.FC<CardProps> = ({ card, isFlipped, isScoring = false, isHeld = false, className, onClick, style, showDetails = false }) => {
  const isPurpleQuality = card.quality === 'purple';
  const isWhiteQuality = card.quality === 'white';
  const isSuperQuality = card.quality === 'super';
  const isJoker = card.isJoker;
  
  // 根据style中的fontSize计算基础字体大小，确保元素按比例缩放
  // 如果style中有fontSize，使用它；否则默认为1rem（5张牌）
  const baseFontSize = (style && style.fontSize) ? String(style.fontSize) : '1rem';
  
  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative cursor-pointer select-none',
        // 如果传入了style，则不使用固定尺寸类名（由外部容器控制）
        !style && (showDetails ? 'w-20 h-28 sm:w-32 sm:h-44' : 'w-[18vw] max-w-20 h-[25.2vw] max-h-28 sm:w-24 sm:h-36'),
        isScoring && isFlipped && 'animate-scoring-float',
        className
      )}
      style={{ 
        perspective: '1000px', 
        WebkitPerspective: '1000px', 
        fontSize: baseFontSize, // 设置基础字体大小，所有em单位会相对于此缩放
        ...style 
      }}
    >
      {/* 计分卡牌的外发光特效 */}
      {isScoring && isFlipped && (
        <div className="absolute inset-0 -m-0.5 rounded-xl bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 blur-sm opacity-40 z-0" />
      )}
      
      {/* Hold 状态标记 */}
      {isHeld && isFlipped && (
        <>
          {/* Hold 边框高亮 */}
          <div className="absolute inset-0 -m-1 rounded-xl border-4 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.8)] z-20 pointer-events-none" />
          {/* HOLD 文字标记 */}
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 font-black text-xs sm:text-sm px-2 py-0.5 rounded z-30 pointer-events-none shadow-lg">
            HOLD
          </div>
        </>
      )}
      <div 
        className={clsx(
            "w-full h-full relative transition-transform duration-500 ease-out rounded-xl",
            isFlipped ? "rotate-y-0" : "rotate-y-180",
            isScoring && isFlipped 
              ? "ring-4 ring-yellow-400 z-10 scale-105 animate-golden-ring-flow" 
              : "shadow-xl",
            isHeld && isFlipped && "scale-105" // Hold 状态轻微放大
        )}
        style={{ 
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
        }}
      >
          {/* Front Face */}
          <div className={clsx(
              "absolute inset-0 backface-hidden rotate-y-0 rounded-xl border-2 flex flex-col overflow-hidden transition-all duration-300",
              qualityStyles[card.quality]
          )}>
              {/* Joker 牌：使用 poker53.png */}
              {isJoker && isFlipped && (
                <>
                  <img 
                    src={getCardImagePath(card)}
                    alt="Joker"
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                </>
              )}
              
              {/* 超级品质：使用图片 + 金色闪光特效 */}
              {isSuperQuality && !isJoker && (() => {
                const cardIndex = getSuperCardIndex(card.suit, card.rank);
                const imagePath = `${import.meta.env.BASE_URL}pokers/poker${cardIndex + 1}.png`;
                return (
                  <>
                    <img 
                      src={imagePath}
                      alt={`${card.suit} ${card.rank}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                    {/* 金色闪光特效层 */}
                    <div className="absolute inset-0 animate-super-card-glow pointer-events-none" />
                  </>
                );
              })()}

              {/* 紫色品质斜向流光特效层 */}
              {isPurpleQuality && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                  <div className="absolute -top-1/2 -left-1/2 animate-shimmer-diagonal" />
                </div>
              )}

              {/* 所有品质牌：统一构图形式（顶部花色、中间数字、底部效果） */}
              {/* 超级品质和 Joker 不显示文本内容，只显示图片 */}
              {!isSuperQuality && !isJoker && (() => {
                // 判断是否同时有高分和倍数效果
                const hasHighScore = card.effects.some(e => e.type === 'high_score');
                const hasMultiplier = card.effects.some(e => e.type === 'multiplier');
                const hasBothEffects = hasHighScore && hasMultiplier;
                
                // 根据品质确定数字颜色
                const getRankColor = () => {
                  if (isWhiteQuality) return suitColors[card.suit];
                  if (card.quality === 'purple') return "text-purple-700";
                  if (card.quality === 'blue') return "text-blue-700";
                  if (card.quality === 'green') return "text-green-700";
                  if (card.quality === 'orange') return "text-orange-700";
                  if (card.quality === 'super') return "text-yellow-700";
                  return suitColors[card.suit];
                };
                
                return (
                  <div className="relative h-full z-10">
                    {/* 花色：顶部居左 */}
                    <div className="absolute flex items-center" style={{ top: '0.5em', left: '0.5em' }}>
                      {card.effects.find(e => e.type === 'double_suit')?.suits ? (
                        <div className="flex" style={{ fontSize: '1.25em', gap: '0.125em' }}>
                          {card.effects.find(e => e.type === 'double_suit')!.suits!.map((suit, i) => (
                            <span key={i} className={suitColors[suit]}>{suitSymbols[suit]}</span>
                          ))}
                        </div>
                      ) : (
                        <span className={suitColors[card.suit]} style={{ fontSize: '1.25em' }}>
                          {suitSymbols[card.suit]}
                        </span>
                      )}
                    </div>
                    
                    {/* 数字：整体牌面上下居中 */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      {card.effects.find(e => e.type === 'cross_value')?.ranks ? (
                        <div className={clsx("font-bold", getRankColor())} style={{ fontSize: '1.25em' }}>
                          {card.effects.find(e => e.type === 'cross_value')!.ranks!.map(r => {
                            if (r === 10) return 'T';
                            if (r === 11) return 'J';
                            if (r === 12) return 'Q';
                            if (r === 13) return 'K';
                            if (r === 14) return 'A';
                            return r;
                          }).join('')}
                        </div>
                      ) : (
                        <span className={clsx("font-bold", getRankColor())} style={{ fontSize: '1.25em' }}>
                          {getRankDisplay(card.rank)}
                        </span>
                      )}
                    </div>
                    
                    {/* 效果：底部居中（仅当有效果时显示） */}
                    {(hasHighScore || hasMultiplier) && (
                      <div className="absolute left-0 right-0 flex items-center justify-center" style={{ bottom: '0.5em', gap: '0.5em', paddingLeft: '0.25em', paddingRight: '0.25em' }}>
                        {card.effects.filter(e => e.type === 'high_score' || e.type === 'multiplier').map((effect, idx) => {
                          if (effect.type === 'high_score') {
                            const scoreValue = effect.value || 3;
                            return (
                              <div 
                                key={idx} 
                                className={clsx(
                                  "font-black",
                                  scoreValue >= 20 ? "text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,1)] animate-pulse" :
                                  scoreValue >= 10 ? "text-green-500 drop-shadow-[0_0_12px_rgba(34,197,94,0.9)]" : 
                                  scoreValue >= 8 ? "text-green-600 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" : 
                                  "text-green-600 drop-shadow-[0_0_8px_rgba(34,197,94,0.7)]"
                                )}
                                style={{ fontSize: hasBothEffects ? '1.25em' : '1.5em' }}
                              >
                                +{scoreValue}
                              </div>
                            );
                          } else if (effect.type === 'multiplier') {
                            const multiplierValue = effect.value || 2;
                            return (
                              <div 
                                key={idx} 
                                className={clsx(
                                  "font-black",
                                  multiplierValue >= 10 ? "text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,1)] animate-pulse" : 
                                  multiplierValue >= 6 ? "text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.9)]" : 
                                  multiplierValue >= 4 ? "text-orange-600 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]" : 
                                  "text-orange-600 drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]"
                                )}
                                style={{ fontSize: hasBothEffects ? '1.25em' : '1.5em' }}
                              >
                                ×{multiplierValue}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                    
                    {/* 钻石牌标识：右下角显示💎图标 */}
                    {card.isDiamondCard && (
                      <div className="absolute" style={{ bottom: '0.5em', right: '0.5em' }}>
                        <span className="text-2xl drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ fontSize: '1.5em' }}>
                          💎
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Back Face */}
          <div className={clsx(
              "absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden"
          )}>
            <img 
              src={getCardBackImagePath()} 
              alt="Card back"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
      </div>
    </div>
  );
};
