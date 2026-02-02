import React, { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { Card } from './components/Card';
import { Coins, Zap, Trophy, BarChart3, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';

function App() {
  const { 
    money, 
    flipsRemaining, 
    maxFlips, 
    currentHand, 
    isFlipped, 
    handResult,
    flipCards, 
    resetHand,
    drawCard,
    recoverEnergy,
    isAutoFlipping,
    toggleAutoFlip
  } = useGameStore();

  const timerRef = useRef<number>();

  useEffect(() => {
    // 启动全局计时器，用于体力恢复
    const interval = setInterval(() => {
        recoverEnergy();
    }, 1000);
    return () => clearInterval(interval);
  }, [recoverEnergy]);

  useEffect(() => {
      // 自动翻牌逻辑
      if (isAutoFlipping && flipsRemaining > 0) {
          if (!isFlipped) {
              flipCards();
          } else {
              // 如果已经翻开，延迟一下自动重置
              timerRef.current = window.setTimeout(() => {
                  resetHand();
                  // 重置后再次检查是否需要翻牌将在下一个渲染周期或 effect 触发
                  // 由于 resetHand 改变了 isFlipped，会触发组件重绘，但 flipCards 需要在这里或依赖变化再次触发
                  // 更好的方式可能是监听 isFlipped 变化
              }, 2000);
          }
      }
      return () => clearTimeout(timerRef.current);
  }, [isAutoFlipping, flipsRemaining, isFlipped, flipCards, resetHand]);

  // 当 isFlipped 变为 false 且自动翻牌开启时，再次尝试翻牌
  useEffect(() => {
      if (isAutoFlipping && !isFlipped && flipsRemaining > 0) {
          const t = setTimeout(() => {
              flipCards();
          }, 500); // 短暂延迟
          return () => clearTimeout(t);
      }
  }, [isAutoFlipping, isFlipped, flipsRemaining, flipCards]);


  const handleMainClick = () => {
    if (isFlipped) {
      resetHand();
    } else {
      flipCards();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-8 px-4">
      {/* Header / Stats Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center bg-slate-800 p-4 rounded-2xl mb-8 shadow-lg border border-slate-700">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-yellow-400">
            <Coins className="w-6 h-6" />
            <span className="text-2xl font-bold font-mono">${money}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-400">
            <Zap className="w-6 h-6" />
            <div className="flex flex-col">
                <span className="text-sm font-bold leading-none">{flipsRemaining}/{maxFlips}</span>
                <div className="w-24 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${(flipsRemaining / maxFlips) * 100}%` }} 
                    />
                </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
             <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="统计">
                 <BarChart3 className="w-6 h-6 text-slate-400" />
             </button>
             <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="牌池">
                 <LayoutGrid className="w-6 h-6 text-slate-400" />
             </button>
             <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="成就">
                 <Trophy className="w-6 h-6 text-slate-400" />
             </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-5xl gap-12">
        
        {/* Result Display */}
        <div className="h-24 flex flex-col items-center justify-center">
            {handResult && isFlipped ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent mb-2">
                        {handResult.name}
                    </h2>
                    <div className="flex items-baseline gap-2 text-xl text-slate-300">
                        <span>Score: {handResult.score}</span>
                        <span className="text-sm text-slate-500">
                            (Base x{handResult.baseMultiplier} 
                            {handResult.bonusMultiplier > 0 && ` + Bonus +${handResult.bonusMultiplier}`})
                        </span>
                    </div>
                </div>
            ) : (
                <div className="text-slate-600 text-xl font-medium animate-pulse">
                    点击翻牌
                </div>
            )}
        </div>

        {/* Cards Container */}
        <div 
            className="flex gap-4 perspective-1000"
            onClick={handleMainClick}
        >
          {currentHand.length > 0 ? (
            currentHand.map((card, index) => (
              <Card 
                key={`${card.id}-${index}`} 
                card={card} 
                isFlipped={isFlipped}
                className={clsx(
                    "shadow-2xl hover:-translate-y-2 transition-transform duration-300",
                    isFlipped && "animate-in zoom-in-50 duration-500 fill-mode-backwards"
                )}
                // Stagger animation delay
                // style={{ animationDelay: `${index * 100}ms` }} 
              />
            ))
          ) : (
              // Empty/Back slots placeholders
              Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-24 h-36 rounded-xl border-2 border-slate-700 bg-slate-800/50 flex items-center justify-center">
                      <div className="w-full h-full opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] rounded-lg" />
                  </div>
              ))
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-6 mt-8">
            <button 
                onClick={handleMainClick}
                disabled={flipsRemaining <= 0 && !isFlipped}
                className={clsx(
                    "px-8 py-4 rounded-xl font-bold text-xl shadow-lg transition-all transform active:scale-95",
                    flipsRemaining > 0 
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 shadow-blue-500/20" 
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                )}
            >
                {isFlipped ? "下一手" : "翻牌"}
            </button>

            <button 
                onClick={drawCard}
                disabled={money < 100}
                className={clsx(
                    "px-8 py-4 rounded-xl font-bold text-xl shadow-lg transition-all transform active:scale-95 border-2",
                    money >= 100
                        ? "border-green-500 text-green-400 hover:bg-green-500/10 shadow-green-500/20"
                        : "border-slate-700 text-slate-600 cursor-not-allowed"
                )}
            >
                抽卡 ($100)
            </button>
            
            <button
                onClick={toggleAutoFlip}
                className={clsx(
                    "px-6 py-4 rounded-xl font-bold text-lg border-2 transition-all",
                    isAutoFlipping 
                        ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                )}
            >
                {isAutoFlipping ? "自动中" : "自动"}
            </button>
        </div>
      </div>
    </div>
  );
}

export default App;
