import React from 'react';

interface GameStartScreenProps {
  onClose: () => void;
}

export const GameStartScreen: React.FC<GameStartScreenProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="text-center max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl sm:text-6xl font-black text-yellow-400 mb-4 drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]">
          老登，
        </div>
        <div className="text-3xl sm:text-5xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]">
          凑齐 5 张牌！
        </div>
        <div className="mt-8 text-sm sm:text-base text-purple-300 animate-pulse">
          点击任意处开始
        </div>
      </div>
    </div>
  );
};










