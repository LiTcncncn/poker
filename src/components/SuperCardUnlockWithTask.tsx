import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import clsx from 'clsx';
import { 
  getCurrentUnlockTargetCard,
  getUnlockSummary,
} from '../utils/superCardUnlockManager';
import { 
  getTaskTypeDisplayName,
  getGameModeById,
  normalizeGameModeDisplayTitle,
} from '../utils/gameModeLoader';
import { useGameStore } from '../store/gameStore';
import type { Card, Rank, Suit } from '../types/poker';
import { CardFaceV2 } from './CardFaceV2';

interface SuperCardUnlockWithTaskProps {
  onUnlock?: (superCardId: string) => void;
  currentMoney: number;
}

/** Pencil OVRX4：圆角 18、p-14；子项 gap-2（较原 gap-3 少 12px 总高） */
const V2_UNLOCK_PANEL_CLASS =
  'flex w-[240px] max-w-[min(240px,calc(100vw-32px))] flex-col items-center gap-2 rounded-[18px] border border-[#F59E0B] bg-gradient-to-b from-[#111827] to-[#0B1220] p-[14px] shadow-[0_12px_22px_rgba(245,158,11,0.2)]';

/** 单行玩法名：不换行，按容器宽度自动缩小字号 */
function FitSingleLineTitle({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const fitFontSize = useCallback(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;
    const maxW = container.clientWidth;
    if (maxW <= 0) return;
    const isSmUp =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1320px)').matches;
    const maxFont = isSmUp ? 24 : 28;
    const minFont = 9;
    el.style.whiteSpace = 'nowrap';
    el.style.width = '100%';
    el.style.textAlign = 'center';
    let size = maxFont;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > maxW && size > minFont) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, []);

  useLayoutEffect(() => {
    fitFontSize();
  }, [text, fitFontSize]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => fitFontSize());
    ro.observe(c);
    window.addEventListener('resize', fitFontSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fitFontSize);
    };
  }, [fitFontSize]);

  return (
    <div ref={containerRef} className="w-full min-w-0 px-1">
      <div
        ref={textRef}
        className="overflow-hidden font-black text-[#FDE68A] [font-variant-emoji:text]"
        style={{ fontSize: `${18}px`, whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * 超级牌解锁条件区组件
 * 显示：目标超级牌、玩法名、任务进度、$和解锁按钮
 */
export const SuperCardUnlockWithTask: React.FC<SuperCardUnlockWithTaskProps> = ({
  onUnlock,
  currentMoney,
}) => {
  // 使用状态来触发重新渲染
  const [refreshKey, setRefreshKey] = useState(0);
  const setGameMode = useGameStore(state => state.setGameMode);
  const paySuperCardUnlockCost = useGameStore(state => state.paySuperCardUnlockCost);
  const unlockSuperCardWithTask = useGameStore(state => state.unlockSuperCardWithTask);
  
  // 每次 refreshKey 变化时重新获取目标
  const targetCard = React.useMemo(() => {
    // refreshKey 用于触发重新计算
    const target = getCurrentUnlockTargetCard();
    if (target) {
      console.log('🎯 当前解锁目标:', target.superCardId, '玩法:', target.gameModeId);
    }
    return target;
  }, [refreshKey]);
  
  // 监听解锁状态变化，定期刷新
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 500); // 每500ms检查一次，确保解锁后能及时更新
    
    return () => clearInterval(interval);
  }, []);

  // 始终让「当前玩法」跟随当前解锁目标，避免出现“显示目标牌是♠️A但统计/任务走了其他玩法”的错位
  useEffect(() => {
    if (targetCard?.gameModeId) {
      setGameMode(targetCard.gameModeId);
    }
  }, [targetCard?.gameModeId, setGameMode]);

  if (!targetCard) {
    return (
      <div
        className={clsx(V2_UNLOCK_PANEL_CLASS, 'min-h-[188px] justify-center sm:min-h-[168px]')}
        style={{ WebkitFontSmoothing: 'antialiased' }}
      >
        <div className="text-center text-base font-bold text-[#FDE68A]">🎉 所有超级牌已解锁！</div>
      </div>
    );
  }
  
  const summary = getUnlockSummary(targetCard.superCardId);
  
  if (!summary) return null;
  
  const gameMode = getGameModeById(targetCard.gameModeId);
  
  if (!gameMode) return null;
  
  const { unlockConfig, progress, taskComplete } = summary;
  const price = unlockConfig.unlockConditions.cost;
  const canAfford = currentMoney >= price;
  const canUnlockButton = taskComplete && canAfford;
  
  // 获取超级牌图片：**直接从 superCardId 解析**，避免 emoji 截断导致永远显示♠️A
  const parts = targetCard.superCardId.split('_');
  const suit = parts[0] || 'spades';
  const rankText = parts[1] || 'A';
  const rankMap: Record<string, number> = {
    A: 14,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
  };
  const rank = rankMap[rankText] ?? 14;
  const suitKey = (['spades', 'hearts', 'clubs', 'diamonds'].includes(suit)
    ? suit
    : 'spades') as Suit;

  /** 与手牌同一套 CardFaceV2，避免预览区与实战矢量不一致 */
  const previewCard: Card = {
    id: 'super-unlock-preview',
    suit: suitKey,
    rank: rank as Rank,
    quality: 'super',
    effects: [],
    baseValue: 0,
    multiplier: 1,
  };

  const handleUnlock = () => {
    if (!canUnlockButton) return;

    // 一次性支付：点击“解锁”时扣钱并标记已支付，然后解锁
    const paid = paySuperCardUnlockCost(targetCard.superCardId, price);
    if (!paid) return;

    const success = unlockSuperCardWithTask(targetCard.superCardId);
    if (success) {
      // 立即触发重新渲染，显示下一张超级牌
      setRefreshKey(prev => prev + 1);
      onUnlock?.(targetCard.superCardId);
    }
  };

  const panelBody = (
    <>
      <FitSingleLineTitle text={normalizeGameModeDisplayTitle(gameMode.name)} />

      <div className="w-full">
        <div className="w-full text-center">
        <div className="rounded-xl border border-[#F59E0B] bg-[#0B1220] px-4 py-[9px] text-center text-[16px] font-extrabold leading-tight text-[#FDE68A]">
            {getTaskTypeDisplayName(unlockConfig.unlockConditions.task.type)}{' '}
            <span
              className={taskComplete ? 'text-[#BBF7D0]' : 'text-[#FDE68A]'}
            >
              {Math.min(progress?.taskProgress.current ?? 0, progress?.taskProgress.target ?? 0)}/{progress?.taskProgress.target ?? 0}
            </span>
            {taskComplete && (
              <span className="ml-1 text-[#BBF7D0]">✅</span>
            )}
          </div>
        </div>
      </div>

      <div
        className="relative aspect-[2/3] w-[90px] overflow-hidden rounded-xl min-[1320px]:w-[96px]"
        style={{ lineHeight: 1 }}
      >
        <div className="absolute inset-0 min-h-0 min-w-0 [container-type:inline-size]">
          <div className="absolute inset-0 min-h-0 min-w-0" style={{ fontSize: '25.806cqw' }}>
            <CardFaceV2 card={previewCard} />
          </div>
        </div>
      </div>

      <div className="w-full">
        <button
          type="button"
          onClick={handleUnlock}
          disabled={!canUnlockButton}
            className={clsx(
            'w-full transition-all',
            canUnlockButton
              ? 'rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#FDE68A] px-4 py-[11px] text-[15px] font-black leading-none text-[#111827] tabular-nums active:scale-[0.98]'
              : 'cursor-not-allowed rounded-xl bg-[#334155] px-4 py-[11px] text-[15px] font-bold leading-none text-[#94A3B8] tabular-nums'
          )}
        >
          ${price.toLocaleString()} 解锁
        </button>
      </div>
    </>
  );

  return (
    <div className={V2_UNLOCK_PANEL_CLASS} style={{ WebkitFontSmoothing: 'antialiased' }}>
      {panelBody}
    </div>
  );
};
