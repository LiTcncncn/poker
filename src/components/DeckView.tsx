import React from 'react';
import { Card } from './Card';
import { Card as CardType, CardQuality } from '../types/poker';
import { X, Lock } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { MAX_UNLOCKED_ATTRIBUTE_SLOTS } from '../constants/deckPool';

interface DeckViewProps {
  activeDeck: (CardType | null)[]; // 上阵牌池，100张固定位置
  reserveDeck: CardType[]; // 剩余牌池
  onClose: () => void;
}

/**
 * 牌池全屏层：铺满视口，半透明+毛玻璃透出下层主界面背景；格子固定尺寸以控制行距；牌面必须与 Pencil「Poker Cards Library / cinXZ」一致：
 * 参考绘制尺寸 120×180、圆角 14、描边 1px（#CBD5E1 / #FBCFE8，矢量面在 CardFaceV2）。
 * 在格内用 container + scale(calc(100cqw/120px)) 整体缩放 120×180 的 Card，圆角/描边/比例与画布同构，而非把牌压进小格导致描边变粗或圆角失真。
 */
const DECK_CELL_FIXED =
  'flex h-[3.75rem] w-10 shrink-0 items-center justify-center sm:h-[4.5rem] sm:w-12';
const DECK_CELL_ATTR =
  'flex h-[5.25rem] w-14 shrink-0 items-center justify-center sm:h-24 sm:w-16';

/** 与 pencil-new.cinXZ 同源像素基准（仅牌池缩放用，不影响主界面翻牌区） */
const PENCIL_CARD_W = 120;
const PENCIL_CARD_H = 180;

/** 固定区（白牌+超级牌）在格内统一再缩至 85%，密网格留白更匀 */
const DECK_FIXED_ZONE_SCALE = 0.85;

type DeckPoolCardProps = {
  card: CardType;
  /** 属性区 / 剩余池：可点击 */
  interactive?: boolean;
  onInteractiveClick?: () => void;
  title?: string;
  /** 固定区：不可点 */
  nonInteractiveTitle?: string;
  /** 固定区 52 格：相对 Pencil 基准再整体 85% */
  fixedZoneNinety?: boolean;
};

const DeckPoolCard: React.FC<DeckPoolCardProps> = ({
  card,
  interactive,
  onInteractiveClick,
  title,
  nonInteractiveTitle,
  fixedZoneNinety,
}) => {
  const scaleExpr = fixedZoneNinety
    ? `scale(calc(100cqw / 120px * ${DECK_FIXED_ZONE_SCALE}))`
    : 'scale(calc(100cqw / 120px))';

  /** 固定区 85% 缩放时勿用 top-left 原点，否则牌面会视觉偏右上；居中 flex + center 原点 */
  const scaled = (
    <div
      className={
        fixedZoneNinety
          ? 'flex h-full w-full items-center justify-center overflow-hidden [container-type:inline-size]'
          : 'h-full w-full overflow-hidden [container-type:inline-size]'
      }
    >
      <div
        style={{
          width: PENCIL_CARD_W,
          height: PENCIL_CARD_H,
          transformOrigin: fixedZoneNinety ? 'center center' : 'top left',
          transform: scaleExpr,
        }}
      >
        <Card
          card={card}
          isFlipped
          showDetails={false}
          superCardStatic={card.quality === 'super'}
          className="max-w-none"
          style={{ width: PENCIL_CARD_W, height: PENCIL_CARD_H }}
        />
      </div>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onInteractiveClick}
        className="h-full w-full cursor-pointer p-0 transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        title={title}
      >
        {scaled}
      </button>
    );
  }

  return (
    <div
      className="flex h-full w-full cursor-not-allowed items-center justify-center"
      title={nonInteractiveTitle}
    >
      {scaled}
    </div>
  );
};

export const DeckView: React.FC<DeckViewProps> = ({ activeDeck, reserveDeck, onClose }) => {
  const { addToActiveDeck, removeFromActiveDeck, unlockedAttributeSlots } = useGameStore();

  // 剩余牌池按品质排序：gold > purple > blue > green > 其他
  const qualityOrder: Record<CardQuality, number> = {
    gold: 1,
    purple: 2,
    blue: 3,
    green: 4,
    orange: 5,
    super: 6,
    white: 7,
  };
  
  const sortedReserveDeck = [...reserveDeck].sort((a, b) => {
    const orderA = qualityOrder[a.quality] || 99;
    const orderB = qualityOrder[b.quality] || 99;
    return orderA - orderB;
  });

  const handleActiveCardClick = (index: number) => {
    // 点击属性牌区，移除到剩余牌池
    removeFromActiveDeck(index);
  };

  const handleReserveCardClick = (cardId: string) => {
    // 点击剩余牌池的牌，自动上阵（如有空位）
    addToActiveDeck(cardId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-view-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-600/50 bg-slate-900/35 px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <h2 id="deck-view-title" className="text-2xl font-bold text-slate-100 sm:text-3xl">
            我的牌池
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 transition-colors hover:bg-slate-700/80"
        >
          <X className="h-6 w-6 text-slate-400" />
        </button>
      </div>

      {/* 小标题居左；牌网格单独 flex 居中。scrollbar-gutter: stable 避免纵向滚动条挤偏视觉中心 */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] sm:p-4">
          <section className="w-full">
            <div className="mb-1 text-left text-sm text-slate-400">固定区（52张）</div>
            <div className="flex w-full justify-center">
              <div className="inline-grid grid-cols-13 justify-items-stretch gap-x-0.5 gap-y-1 sm:gap-y-1.5">
              {activeDeck.slice(0, 52).map((card, index) => (
                <div key={index} className={DECK_CELL_FIXED}>
                  {card ? (
                    <DeckPoolCard
                      card={card}
                      nonInteractiveTitle="白色牌和超级牌不可替换"
                      fixedZoneNinety
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center border border-dashed border-slate-600"
                      style={{ borderRadius: 'calc(100% * 14 / 120)' }}
                    >
                      <span className="text-[0.6rem] text-slate-500">空</span>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          </section>

          <section className="w-full">
            <div className="mb-1 text-left text-sm text-slate-400">
              属性牌区（{unlockedAttributeSlots}/{MAX_UNLOCKED_ATTRIBUTE_SLOTS} 已解锁）
            </div>
            <div className="flex w-full flex-col items-center gap-1">
            <div className="inline-grid grid-cols-5 justify-items-stretch gap-x-1 gap-y-1">
              {Array.from({ length: unlockedAttributeSlots }).map((_, index) => {
                const actualIndex = index + 52;
                const card = activeDeck[actualIndex];
                return (
                  <div key={actualIndex} className={DECK_CELL_ATTR}>
                    {card ? (
                      <DeckPoolCard
                        card={card}
                        interactive
                        onInteractiveClick={() => handleActiveCardClick(actualIndex)}
                        title="点击移除到剩余牌池"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center border border-dashed border-slate-600"
                        style={{ borderRadius: 'calc(100% * 14 / 120)' }}
                        title="空位"
                      >
                        <span className="text-[0.65rem] text-slate-500 sm:text-xs">空</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {unlockedAttributeSlots < MAX_UNLOCKED_ATTRIBUTE_SLOTS && (
              <div className="inline-grid grid-cols-5 justify-items-stretch gap-x-1 gap-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`attr-lock-row-${i}`} className={DECK_CELL_ATTR}>
                    <div
                      className="flex h-full w-full flex-col items-center justify-center border border-slate-700 bg-slate-800/80"
                      style={{ borderRadius: 'calc(100% * 14 / 120)' }}
                      title="未解锁"
                    >
                      <Lock className="mb-0.5 h-5 w-5 text-slate-500 sm:h-6 sm:w-6" />
                      <span className="text-[0.65rem] text-slate-500 sm:text-xs">锁定</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </section>

          <section className="w-full">
            <div className="mb-1 text-left text-sm text-slate-400">
              剩余牌池
              <span className="ml-2 tabular-nums text-slate-500">{sortedReserveDeck.length} 张</span>
            </div>
            {sortedReserveDeck.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p className="text-base">暂无剩余牌</p>
              </div>
            ) : (
              <div className="flex w-full justify-center">
              <div className="inline-grid grid-cols-5 justify-items-stretch gap-x-1 gap-y-1 sm:grid-cols-8 sm:gap-x-1 sm:gap-y-1">
                {sortedReserveDeck.map((card, index) => (
                  <div key={`${card.id}-${index}`} className={DECK_CELL_ATTR}>
                    <DeckPoolCard
                      card={card}
                      interactive
                      onInteractiveClick={() => handleReserveCardClick(card.id)}
                      title="点击自动上阵（如有空位）"
                    />
                  </div>
                ))}
              </div>
              </div>
            )}
          </section>
      </div>
    </div>
  );
};
