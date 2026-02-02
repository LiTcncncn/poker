import React, { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';

interface ScoreAnimationProps {
  score: number;
  startPosition?: { x: number; y: number };
  onComplete?: () => void;
}

export const ScoreAnimation: React.FC<ScoreAnimationProps> = ({ 
  score, 
  startPosition,
  onComplete 
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div 
      className="fixed pointer-events-none z-40"
      style={{
        left: startPosition?.x || '50%',
        top: startPosition?.y || '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* 金币图标 */}
      <div 
        className="flex items-center gap-2 text-yellow-400 font-bold text-2xl"
        style={{
          animation: 'coin-fly-in 0.8s ease-out forwards',
          '--start-x': startPosition ? '0px' : '0px',
          '--start-y': startPosition ? '0px' : '100px',
        } as React.CSSProperties}
      >
        <Coins className="w-8 h-8" />
        <span className="drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">
          +${score}
        </span>
      </div>
    </div>
  );
};










