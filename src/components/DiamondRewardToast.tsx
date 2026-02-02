import React, { useEffect, useState, useRef } from 'react';
import { Gem } from 'lucide-react';

interface DiamondRewardToastProps {
  amount: number;
  onComplete?: () => void;
}

export const DiamondRewardToast: React.FC<DiamondRewardToastProps> = ({ 
  amount, 
  onComplete 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const onCompleteRef = useRef(onComplete);
  
  // 保持 onComplete 引用最新
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // 触发显示动画
    const showTimer = setTimeout(() => {
      setIsAnimating(true);
    }, 50);
    
    // 2秒后开始淡出
    const fadeOutTimer = setTimeout(() => {
      setIsAnimating(false);
    }, 2000);
    
    // 2.3秒后完全消失（淡出动画300ms）
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      // 使用 ref 调用，避免依赖问题
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
    }, 2300);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(hideTimer);
    };
  }, [amount]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none">
      <div
        className={`
          bg-gradient-to-r from-yellow-500 to-orange-500 
          text-black font-bold text-xl sm:text-2xl
          px-6 sm:px-8 py-3 sm:py-4
          rounded-xl shadow-2xl
          flex items-center gap-2 sm:gap-3
          border-2 border-yellow-300
          transition-all duration-300
          ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-20px] scale-95'}
        `}
      >
        <span>获得 {amount}</span>
        <Gem className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />
      </div>
    </div>
  );
};
