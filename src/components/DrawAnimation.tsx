import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Card as CardType } from '../types/poker';
import { Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface DrawAnimationProps {
  card: CardType;
  onComplete: () => void;
}

export const DrawAnimation: React.FC<DrawAnimationProps> = ({ card, onComplete }) => {
  const [stage, setStage] = useState<'start' | 'flip' | 'show'>('start');

  useEffect(() => {
    // 动画序列
    // 1. start: 卡背出现 (0ms)
    // 2. flip: 翻转 (500ms)
    // 3. show: 展示 (1000ms)
    // 4. complete: 结束 (3000ms)

    const t1 = setTimeout(() => setStage('flip'), 100);
    const t2 = setTimeout(() => setStage('show'), 600);
    const t3 = setTimeout(onComplete, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-300 cursor-pointer"
      onClick={onComplete}
    >
      {/* 标题 */}
      <div className={clsx(
        "text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 transition-all duration-500 transform px-4",
        stage === 'start' ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0",
        stage === 'show' ? "text-yellow-400 scale-110" : "text-white"
      )}>
        {stage === 'show' ? (
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 animate-spin-slow" />
            <span>获得新卡牌！</span>
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 animate-spin-slow" />
          </div>
        ) : (
          "抽卡中..."
        )}
      </div>

      {/* 卡牌容器 */}
      <div className="relative perspective-1000">
        {/* 光效背景 */}
        {stage === 'show' && (
          <div className="absolute inset-0 -m-20 bg-gradient-to-tr from-yellow-500/30 via-purple-500/30 to-blue-500/30 rounded-full blur-3xl animate-pulse" />
        )}
        
        {/* 卡牌 */}
        <div className={clsx(
          "transform transition-all duration-1000",
          stage === 'start' && "scale-50 opacity-0 rotate-y-180",
          stage === 'flip' && "scale-100 opacity-100 rotate-y-180",
          stage === 'show' && "scale-125 sm:scale-150 rotate-y-0"
        )}>
          <Card 
            card={card} 
            isFlipped={stage === 'show'} // 在 show 阶段才翻开
            showDetails={true}
            className="shadow-2xl"
          />
        </div>
      </div>

      {/* 点击跳过 */}
      <div className="mt-20 text-slate-500 text-sm animate-pulse hover:text-white">
        点击任意处关闭
      </div>
    </div>
  );
};

