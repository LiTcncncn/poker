import React from 'react';
import clsx from 'clsx';
import { Card as CardType } from '../types/poker';
import { getRankDisplay } from '../utils/pokerLogic';

interface CardProps {
  card: CardType;
  isFlipped: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
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
  green: 'border-green-500 bg-green-50 shadow-[0_0_15px_rgba(34,197,94,0.4)] ring-2 ring-green-400/50',
  blue: 'border-blue-500 bg-blue-50 shadow-[0_0_15px_rgba(59,130,246,0.4)] ring-2 ring-blue-400/50',
  purple: 'border-purple-500 bg-purple-50',
  orange: 'border-orange-500 bg-orange-50',
};

export const Card: React.FC<CardProps> = ({ card, isFlipped, className, onClick, style }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative w-24 h-36 cursor-pointer select-none',
        className
      )}
      style={{ perspective: '1000px', ...style }}
    >
      <div 
        className={clsx(
            "w-full h-full relative preserve-3d transition-transform duration-500 ease-out shadow-xl rounded-xl",
            isFlipped ? "rotate-y-0" : "rotate-y-180"
        )}
      >
          {/* Front Face */}
          <div className={clsx(
              "absolute inset-0 backface-hidden rounded-xl border-2 flex flex-col p-2 justify-between overflow-hidden",
              qualityStyles[card.quality]
          )}>
              {/* Top Left */}
              <div className="flex flex-col items-center leading-none">
                <span className={clsx("text-xl font-bold font-mono", suitColors[card.suit])}>
                  {getRankDisplay(card.rank)}
                </span>
                <span className="text-xl">{suitSymbols[card.suit]}</span>
              </div>
              
              {/* Center */}
              <div className="absolute inset-0 flex justify-center items-center pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
                <span className={clsx("text-6xl", suitColors[card.suit])}>
                  {suitSymbols[card.suit]}
                </span>
              </div>
              <div className="z-10 flex justify-center">
                 {/* Main Center Symbol - Optional based on design */}
              </div>

              {/* Bottom Right */}
              <div className="flex flex-col items-center rotate-180 leading-none">
                <span className={clsx("text-xl font-bold font-mono", suitColors[card.suit])}>
                  {getRankDisplay(card.rank)}
                </span>
                <span className="text-xl">{suitSymbols[card.suit]}</span>
              </div>
              
              {/* Effects Indicators */}
              {(card.quality === 'green' || card.quality === 'blue') && (
                <>
                    <div className="absolute top-0 right-0 p-1">
                        <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse shadow-sm" />
                    </div>
                    {/* Effects Text (Tiny) */}
                    <div className="absolute bottom-1 left-0 w-full text-[0.5rem] text-center font-bold text-slate-500/80 uppercase tracking-tighter">
                        {card.effects.map(e => e.type.replace('_', ' ')).join(' • ')}
                    </div>
                </>
              )}
          </div>

          {/* Back Face */}
          <div className={clsx(
              "absolute inset-0 backface-hidden rotate-y-180 rounded-xl border-2 border-indigo-900 bg-indigo-950 overflow-hidden"
          )}>
            <div className="w-full h-full opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-400 via-indigo-900 to-black" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-24 border-2 border-indigo-500/30 rounded-lg bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-50" />
            </div>
          </div>
      </div>
    </div>
  );
};
