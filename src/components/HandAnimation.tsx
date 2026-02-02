import React, { useEffect, useState } from 'react';
import { HandResult } from '../types/poker';
import clsx from 'clsx';

interface HandAnimationProps {
  result: HandResult;
  onComplete?: () => void;
}

export const HandAnimation: React.FC<HandAnimationProps> = ({ result, onComplete }) => {
  const [show, setShow] = useState(true);
  const [stage, setStage] = useState<'enter' | 'score' | 'exit'>('score'); // 初始直接显示，不要透明状态

  useEffect(() => {
    // 动画流程：
    // 0ms: 立即显示结算板（score 状态）
    // 2500ms: Exit (开始消失)
    // 3000ms: 完全隐藏
    
    const t1 = setTimeout(() => {
        setStage('exit');
    }, 2500);
    const t2 = setTimeout(() => {
        setShow(false);
        onComplete?.();
    }, 3000); // 给退出动画留出时间

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  if (!show) return null;

  const { type, name, score, baseMultiplier, bonusMultiplier } = result;

  // 根据牌型级别决定颜色主题和特效级别
  const getThemeConfig = () => {
    const configs = {
      royal_flush: { 
        color: 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,1)]',
        icon: '👑',
        level: 'legendary'
      },
      straight_flush: { 
        color: 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,1)]',
        icon: '🌟',
        level: 'epic'
      },
      four_of_a_kind: { 
        color: 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,1)]',
        icon: '💥',
        level: 'epic'
      },
      five_of_a_kind: { 
        color: 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,1)]',
        icon: '🔥',
        level: 'legendary'
      },
      six_of_a_kind: { 
        color: 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,1)]',
        icon: '🔥',
        level: 'legendary'
      },
      seven_of_a_kind: { 
        color: 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,1)]',
        icon: '🔥',
        level: 'legendary'
      },
      full_house: { 
        color: 'text-purple-400 drop-shadow-[0_0_12px_rgba(192,132,252,0.9)]',
        icon: '🏠',
        level: 'rare'
      },
      flush: { 
        color: 'text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.9)]',
        icon: '💧',
        level: 'rare'
      },
      straight: { 
        color: 'text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.9)]',
        icon: '➡️',
        level: 'rare'
      },
      three_of_a_kind: { 
        color: 'text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]',
        icon: '⚡',
        level: 'uncommon'
      },
      two_pairs: { 
        color: 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]',
        icon: '✨',
        level: 'uncommon'
      },
      one_pair: { 
        color: 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]',
        icon: '⭐',
        level: 'common'
      },
      high_card: {
        color: 'text-gray-400',
        icon: '🃏',
        level: 'common'
      },
    };
    return configs[type] || { color: 'text-gray-400', icon: '🃏', level: 'common' };
  };

  const config = getThemeConfig();
  const isHighLevel = config.level === 'legendary' || config.level === 'epic';
  const isRare = config.level === 'rare';

  return (
    <div className="fixed inset-0 pointer-events-none z-[45] flex flex-col items-center justify-center overflow-hidden">
        {/* 背景遮罩 (高级牌型) */}
        {isHighLevel && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" />
        )}

        {/* 背景光效层 */}
        {config.level === 'legendary' && (
            <div className="absolute inset-0">
                {/* 金色脉冲 */}
                <div className="absolute inset-0 bg-gradient-radial from-yellow-500/30 via-orange-500/10 to-transparent animate-pulse" />
                {/* 旋转光环 */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border-8 border-yellow-400/30 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
            </div>
        )}

        {config.level === 'epic' && (
            <div className="absolute inset-0">
                {/* 彩虹光效 */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />
            </div>
        )}

        {isRare && type === 'flush' && (
            // 花瓣飘落效果
            <div className="absolute inset-0">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute text-4xl opacity-60"
                        style={{
                            left: `${10 + i * 12}%`,
                            top: '-10%',
                            animation: `petal-fall ${2 + Math.random()}s ease-in ${i * 0.2}s infinite`,
                        }}
                    >
                        {['♠️', '♥️', '♣️', '♦️'][i % 4]}
                    </div>
                ))}
            </div>
        )}

        {isRare && type === 'straight' && (
            // 流动光线效果
            <div className="absolute top-1/2 left-0 right-0 h-1 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-flow-light" />
            </div>
        )}

        {/* 主体动画容器 */}
        <div className={clsx(
            "flex flex-col items-center transform transition-all duration-300 relative z-10",
            stage === 'enter' && "scale-90 opacity-100 translate-y-0", // 改为可见
            stage === 'score' && "scale-100 opacity-100 translate-y-0", // 正常大小
            stage === 'exit' && "scale-110 opacity-0 -translate-y-10"
        )}>
            {/* 图标与名称 */}
            <div className="flex items-center gap-4 mb-4">
                <span className={clsx(
                    "text-6xl",
                    config.level === 'legendary' && "animate-bounce",
                    (config.level === 'epic' || isRare) && "animate-pulse"
                )}>
                    {config.icon}
                </span>
                
                <span className={clsx(
                    "text-5xl md:text-6xl font-black font-sans uppercase tracking-wider",
                    config.color,
                    config.level === 'legendary' && "animate-pulse"
                )}>
                    {name}
                </span>
                
                <span className={clsx(
                    "text-6xl",
                    config.level === 'legendary' && "animate-bounce",
                    (config.level === 'epic' || isRare) && "animate-pulse"
                )} style={{ animationDelay: '0.1s' }}>
                    {config.icon}
                </span>
            </div>

            {/* 分数详情卡片 */}
            <div className={clsx(
                "bg-slate-900/95 border-2 rounded-2xl p-6 flex flex-col items-center shadow-2xl transition-all duration-300 backdrop-blur-sm",
                (stage === 'enter' || stage === 'score') ? "opacity-100 scale-100" : "opacity-0 scale-90",
                config.level === 'legendary' && "border-yellow-400/70 shadow-yellow-400/50",
                config.level === 'epic' && "border-cyan-400/70 shadow-cyan-400/50",
                isRare && "border-purple-400/70 shadow-purple-400/50",
                config.level === 'uncommon' && "border-emerald-400/50",
                config.level === 'common' && "border-slate-600/50"
            )}>
                {/* 积分数字 */}
                <div className={clsx(
                    "text-5xl font-bold mb-2 font-mono",
                    config.level === 'legendary' && "text-yellow-400 animate-pulse",
                    config.level === 'epic' && "text-cyan-400",
                    isRare && "text-purple-300",
                    (config.level === 'uncommon' || config.level === 'common') && "text-white"
                )}>
                    +${score}
                </div>
                
                {/* 倍率详情 */}
                <div className="flex items-center gap-3 text-lg text-slate-300">
                    <span className={clsx(
                        "px-3 py-1 rounded border font-semibold",
                        config.level === 'legendary' && "bg-yellow-900/50 border-yellow-600 text-yellow-300",
                        config.level === 'epic' && "bg-cyan-900/50 border-cyan-600 text-cyan-300",
                        isRare && "bg-purple-900/50 border-purple-600 text-purple-300",
                        (config.level === 'uncommon' || config.level === 'common') && "bg-slate-800 border-slate-600"
                    )}>
                        基础 x{baseMultiplier}
                    </span>
                    {bonusMultiplier > 0 && (
                        <>
                            <span className="text-slate-500">+</span>
                            <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded border border-green-700/50 animate-pulse font-semibold">
                                加成 x{bonusMultiplier}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* 粒子爆炸效果 (传奇牌型) */}
        {stage === 'score' && config.level === 'legendary' && (
             <div className="absolute inset-0 pointer-events-none">
                 {Array.from({ length: 24 }).map((_, i) => {
                    const angle = (i * 360) / 24;
                    const distance = 150 + Math.random() * 100;
                    const tx = Math.cos((angle * Math.PI) / 180) * distance;
                    const ty = Math.sin((angle * Math.PI) / 180) * distance;
                    return (
                        <div
                            key={i}
                            className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500"
                            style={{
                                animation: `particle-explode 1s ease-out ${i * 0.02}s forwards`,
                                '--tx': `${tx}px`,
                                '--ty': `${ty}px`,
                            } as React.CSSProperties}
                        />
                    );
                })}
             </div>
        )}

        {/* 史诗级光柱 */}
        {stage === 'score' && config.level === 'epic' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-2 h-full bg-gradient-to-b from-transparent via-cyan-400 to-transparent opacity-60 animate-pulse" />
                <div className="absolute w-full h-2 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-60 animate-pulse" />
            </div>
        )}
    </div>
  );
};
