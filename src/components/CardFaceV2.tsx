import type { FC } from 'react';
import clsx from 'clsx';
import { Gem } from 'lucide-react';
import type { Card as CardType, Rank } from '../types/poker';
import { getRankDisplay } from '../utils/pokerLogic';

/** 与 Pencil「Poker Cards Library」对齐的矢量牌面（普通 / 属性 / 超级闪牌） */

const rankChar = (r: Rank): string => {
  if (r <= 10) return r === 10 ? '10' : String(r);
  if (r === 11) return 'J';
  if (r === 12) return 'Q';
  if (r === 13) return 'K';
  if (r === 14) return 'A';
  return String(r);
};

function formatCrossValueRanks(ranks: Rank[]): string {
  const sorted = [...ranks].sort((a, b) => a - b);
  if (sorted.length === 3 && sorted[0] === 11 && sorted[1] === 12 && sorted[2] === 13) {
    return 'JQK';
  }
  let consecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      consecutive = false;
      break;
    }
  }
  /** 普通连字符在窄牌宽会在「8-」与「10」间断行；用 U+2011 不间断连字符保持单行 */
  const nbHyphen = '\u2011';
  if (consecutive && sorted.length >= 2) {
    return `${rankChar(sorted[0])}${nbHyphen}${rankChar(sorted[sorted.length - 1])}`;
  }
  return sorted.map(rankChar).join('');
}

function isJqkCrossRanks(ranks: Rank[] | undefined): boolean {
  if (!ranks || ranks.length !== 3) return false;
  const s = new Set(ranks);
  return s.has(11) && s.has(12) && s.has(13);
}

/** 跨 8-9-10 显示为「8‑10」，两位数字+连字符易超牌宽；仅此牌型略缩顶行，其它跨牌仍 1.55em */
function isEightThroughTenCross(ranks: Rank[] | undefined): boolean {
  if (!ranks || ranks.length !== 3) return false;
  const s = new Set(ranks);
  return s.has(8) && s.has(9) && s.has(10);
}

const suitSymbol: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

/** Pencil cinXZ/bRQHw：suit 44px / rank 48px → 相对根字号 1.42em；全牌面统一，避免属性牌误用 1.18em 变小 */
const SUIT_GLYPH_CLASS = 'text-[1.42em]';

function shellForQuality(card: CardType): string {
  const { quality } = card;
  switch (quality) {
    case 'green':
      return 'bg-[#BBF7D0] border-[#22C55E]';
    case 'blue':
      return 'bg-[#93C5FD] border-[#3B82F6]';
    case 'purple':
      return 'bg-[#F5D0FE] border-[#C026D3]';
    case 'gold':
      return 'bg-[linear-gradient(180deg,#FFF7CC_0%,#FDE68A_45%,#F59E0B_100%)] border-[#D97706]';
    case 'orange':
      return 'bg-orange-200 border-orange-500';
    default:
      return 'bg-[#FDFAF6] border-slate-300';
  }
}

/**
 * 普通白牌：pencil-new.cinXZ — 120×180、行高 70/60/50、描边 1px、rank 48 / suit 44（仅 em；根字号由 Card 用 cqw 统一缩放，全视口一致）
 */
const WhitePlainFace: FC<{
  card: CardType;
  ink: string;
  borderClass: string;
}> = ({ card, ink, borderClass }) => (
  <div
    className={clsx(
      'relative h-full w-full overflow-hidden rounded-[14px] border-[1px] bg-[#FDFAF6] font-sans flex flex-col',
      borderClass
    )}
  >
    {/* grid 行高比 7:6:5 ≈ pencil 70:60:50 */}
    <div className="grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
      {/* 数值：左上，padding 左 15/120 */}
      <div className="flex min-h-0 items-end justify-start pl-[12.5%] pr-1 pt-1">
        <span
          className={clsx(
            'font-black leading-none tracking-tight',
            ink,
            'text-[1.55em]'
          )}
        >
          {getRankDisplay(card.rank)}
        </span>
      </div>
      {/* 花色：中栏水平居中、贴栏底（align end） */}
      <div className="flex min-h-0 items-end justify-center pb-0.5">
        <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
          {suitSymbol[card.suit]}
        </span>
      </div>
      <div className="min-h-0" aria-hidden />
    </div>
  </div>
);

export const CardFaceV2: FC<{ card: CardType; superStatic?: boolean; showSuperBonus?: boolean }> = ({
  card,
  superStatic = false,
  showSuperBonus = false,
}) => {
  const isBlackSuit = card.suit === 'spades' || card.suit === 'clubs';
  const ink = isBlackSuit ? 'text-[#0F172A]' : 'text-[#BE123C]';
  const cross = card.effects.find((e) => e.type === 'cross_value' && e.ranks?.length);
  const doubleSuit = card.effects.find((e) => e.type === 'double_suit' && e.suits?.length);
  const hasHigh = card.effects.some((e) => e.type === 'high_score');
  const hasMult = card.effects.some((e) => e.type === 'multiplier');
  const isSuper = card.quality === 'super';
  const whiteBorder =
    card.quality === 'white'
      ? isBlackSuit
        ? 'border border-[#CBD5E1]'
        : 'border border-[#FBCFE8]'
      : '';

  const plainWhite =
    card.quality === 'white' &&
    !cross &&
    !doubleSuit?.suits?.length &&
    !hasHigh &&
    !hasMult &&
    !card.isDiamondCard;

  if (isSuper) {
    /** 牌池 superStatic：仅渐变底 + 静态外光；主界面保留锥彩旋转 + 外光色循环 */
    return (
      <div
        className={clsx(
          'relative h-full w-full overflow-hidden rounded-2xl border-2 border-[#C084FC] font-sans',
          'bg-[linear-gradient(180deg,#FFFFFF_0%,#A5D8F7_42%,#F5C7F0_100%)]',
          superStatic ? 'super-card-face-static-glow' : 'animate-super-card-border-glow'
        )}
      >
        {!superStatic && (
          <div
            className="pointer-events-none absolute inset-0 z-0 rounded-2xl animate-super-conic-hint"
            aria-hidden
          />
        )}
        <div className="relative z-10 grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
          <div className="flex min-h-0 items-end justify-start pl-[12.5%] pr-1 pt-1">
            <span
              className={clsx(
                'font-black leading-none tracking-tight',
                ink,
                'text-[1.55em]'
              )}
            >
              {getRankDisplay(card.rank)}
            </span>
          </div>
          <div className="flex min-h-0 items-end justify-center pb-0.5">
            <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
              {suitSymbol[card.suit]}
            </span>
          </div>
          <div className="flex min-h-0 flex-nowrap items-center justify-center gap-[0.2em] whitespace-nowrap px-0.5 pb-0.5">
            {showSuperBonus && (
              <span className="shrink-0 font-black text-[#15803D] drop-shadow-sm text-[0.95em]">
                +15
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (plainWhite) {
    return <WhitePlainFace card={card} ink={ink} borderClass={whiteBorder} />;
  }

  /** JQK 跨牌：布局仍用 7:6:5；外壳与品质一致（紫/绿/蓝等用 shellForQuality），不再固定琥珀金底以免紫品质看起来像金卡 */
  if (cross?.ranks && isJqkCrossRanks(cross.ranks)) {
    return (
      <div
        className={clsx(
          'relative flex h-full w-full flex-col overflow-hidden rounded-[14px] border-2 font-sans',
          shellForQuality(card),
          card.quality === 'white' && whiteBorder
        )}
      >
        {(card.quality === 'purple' || card.quality === 'gold') && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]">
            <div
              className={clsx(
                'absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-shimmer-diagonal',
                card.quality === 'gold' && 'opacity-90'
              )}
            />
          </div>
        )}
        <div className="relative z-10 grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
          <div className="flex min-h-0 items-end justify-center px-1 pt-0.5">
            <span
              className={clsx(
                'font-black leading-none tracking-[-0.04em]',
                ink,
                'text-[1.55em]'
              )}
            >
              JQK
            </span>
          </div>
          <div className="flex min-h-0 items-end justify-center pb-0.5">
            <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
              {suitSymbol[card.suit]}
            </span>
          </div>
          <div className="flex min-h-0 flex-nowrap items-center justify-center gap-[0.2em] whitespace-nowrap px-0.5 pb-0.5">
            {hasMult &&
              card.effects
                .filter((e) => e.type === 'multiplier')
                .map((e, idx) => (
                  <span
                    key={`jqk-m-${idx}`}
                    className="shrink-0 font-black text-[#9333EA] drop-shadow-sm text-[0.95em]"
                  >
                    ×{e.value ?? 0}
                  </span>
                ))}
            {hasHigh &&
              card.effects
                .filter((e) => e.type === 'high_score')
                .map((e, idx) => (
                  <span key={`jqk-h-${idx}`} className="shrink-0 font-black text-[#16A34A] text-[0.95em]">
                    +{e.value ?? 0}
                  </span>
                ))}
            {card.isDiamondCard && (
              <span className="inline-flex items-center gap-0.5 font-black text-[#A16207] text-[0.95em]">
                <Gem className="h-[1em] w-[1em] shrink-0" strokeWidth={2.5} />
                +{card.diamondBonus ?? 20}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative h-full w-full overflow-hidden rounded-[14px] border-2 flex flex-col font-sans',
        shellForQuality(card),
        card.quality === 'white' && whiteBorder
      )}
    >
      {(card.quality === 'purple' || card.quality === 'gold') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]">
          <div
            className={clsx(
              'absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-shimmer-diagonal',
              card.quality === 'gold' && 'opacity-90'
            )}
          />
        </div>
      )}

      {/* 与白牌/超级牌相同 7:6:5 栅格；勿用 flex-1+items-center 把花色顶到剩余区正中，否则会偏上、与 cinXZ 不一致 */}
      <div className="relative z-10 grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
        <div
          className={clsx(
            'flex min-h-0 items-end',
            cross && cross.ranks ? 'justify-center px-1 pt-1' : 'justify-start pl-[12.5%] pr-1 pt-1'
          )}
        >
          <span
            className={clsx(
              'font-black leading-none',
              ink,
              cross && cross.ranks && 'whitespace-nowrap',
              isEightThroughTenCross(cross?.ranks)
                ? 'text-[1.40em] tracking-tighter'
                : 'text-[1.55em] tracking-tight'
            )}
          >
            {cross && cross.ranks ? formatCrossValueRanks(cross.ranks) : getRankDisplay(card.rank)}
          </span>
        </div>

        <div className="flex min-h-0 items-end justify-center gap-[0.35em] pb-0.5">
          {doubleSuit?.suits ? (
            doubleSuit.suits.map((s) => (
              <span
                key={s}
                className={clsx(
                  'font-black leading-none',
                  SUIT_GLYPH_CLASS,
                  s === 'spades' || s === 'clubs' ? 'text-[#0F172A]' : 'text-[#BE123C]'
                )}
              >
                {suitSymbol[s]}
              </span>
            ))
          ) : (
            <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
              {suitSymbol[card.suit]}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-nowrap items-center justify-center gap-[0.2em] whitespace-nowrap px-0.5 pb-0.5">
          {hasMult &&
            card.effects
              .filter((e) => e.type === 'multiplier')
              .map((e, idx) => (
                <span
                  key={`m-${idx}`}
                  className="shrink-0 font-black text-[#9333EA] drop-shadow-sm text-[0.95em]"
                >
                  ×{e.value ?? 0}
                </span>
              ))}
          {hasHigh &&
            card.effects
              .filter((e) => e.type === 'high_score')
              .map((e, idx) => (
                <span
                  key={`h-${idx}`}
                  className="shrink-0 font-black text-[#16A34A] drop-shadow-sm text-[0.95em]"
                >
                  +{e.value ?? 0}
                </span>
              ))}
          {card.isDiamondCard && (
            <span className="inline-flex items-center gap-0.5 font-black text-[#A16207] text-[0.95em]">
              <Gem className="h-[1em] w-[1em] shrink-0" strokeWidth={2.5} />
              +{card.diamondBonus ?? 20}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
