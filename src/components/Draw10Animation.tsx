import React from 'react';
import { Card } from './Card';
import { Card as CardType } from '../types/poker';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface Draw10AnimationProps {
  cards: CardType[];
  onComplete: () => void;
}

export const Draw10Animation: React.FC<Draw10AnimationProps> = ({ cards, onComplete }) => {
  // 按品质分组统计
  const qualityStats = {
    green: cards.filter(c => c.quality === 'green').length,
    blue: cards.filter(c => c.quality === 'blue').length,
    purple: cards.filter(c => c.quality === 'purple').length,
  };

  const hasPurple = qualityStats.purple > 0;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      {/* 关闭按钮 */}
      <button 
        onClick={onComplete}
        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors z-10"
      >
        <X className="w-8 h-8 text-white" />
      </button>

      {/* 标题（原 text-2xl / sm:text-4xl 的 1.5 倍） */}
      <div className="text-center mb-4 sm:mb-8">
        <div className="mb-3 flex items-center justify-center sm:mb-4">
          <h2 className="text-[2.25rem] font-bold leading-tight text-white sm:text-[3.375rem]">
            十连抽
          </h2>
        </div>
        
        {/* 统计信息 */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 text-sm sm:text-lg">
          <span className="text-green-400">绿色 ×{qualityStats.green}</span>
          <span className="text-blue-400">蓝色 ×{qualityStats.blue}</span>
          {hasPurple && (
            <span className="text-purple-400 font-bold animate-pulse">
              紫色 ×{qualityStats.purple} 🎉
            </span>
          )}
        </div>
      </div>

      {/* 卡牌网格 */}
      <div className="grid grid-cols-5 sm:grid-cols-5 gap-2 sm:gap-4 mb-8 max-w-full overflow-x-auto px-4 justify-items-center">
        {cards.map((card, index) => (
          <div 
            key={`${card.id}-${index}`}
            className={clsx(
              "transform transition-all duration-500 flex justify-center items-center",
              "animate-in zoom-in"
            )}
            style={{
              animationDelay: `${index * 0.1}s`,
              animationFillMode: 'backwards'
            }}
          >
            <div className="scale-[0.78] sm:scale-100 origin-center">
              <Card 
                card={card} 
                isFlipped={true}
                showDetails={false}
                className="transition-transform hover:scale-110"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 紫卡特效 */}
      {hasPurple && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
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
  );
};

