/**
 * 与原项目 CardFaceV2 完全一致的矢量牌面。
 * 仅调整了 import 路径，其余逻辑与原项目保持同步。
 */
import type { FC } from 'react';
import clsx from 'clsx';
import type { Card as CardType, Rank } from '../types/poker';
import { getRankDisplay } from '../utils/pokerLogic';

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
    if (sorted[i] !== sorted[i - 1] + 1) { consecutive = false; break; }
  }
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

function isEightThroughTenCross(ranks: Rank[] | undefined): boolean {
  if (!ranks || ranks.length !== 3) return false;
  const s = new Set(ranks);
  return s.has(8) && s.has(9) && s.has(10);
}

const suitSymbol: Record<string, string> = {
  spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦',
};

const SUIT_GLYPH_CLASS = 'text-[1.42em]';

function shellForQuality(card: CardType): string {
  switch (card.quality) {
    case 'green':  return 'bg-[#BBF7D0] border-[#22C55E]';
    case 'blue':   return 'bg-[#93C5FD] border-[#3B82F6]';
    case 'purple': return 'bg-[#F5D0FE] border-[#C026D3]';
    case 'gold':   return 'bg-[linear-gradient(180deg,#FFF7CC_0%,#FDE68A_45%,#F59E0B_100%)] border-[#D97706]';
    case 'orange': return 'bg-orange-200 border-orange-500';
    default:       return 'bg-[#FDFAF6] border-slate-300';
  }
}

const WhitePlainFace: FC<{ card: CardType; ink: string; borderClass: string }> = ({
  card, ink, borderClass,
}) => (
  <div className={clsx(
    'relative h-full w-full overflow-hidden rounded-[14px] border-[1px] bg-[#FDFAF6] font-sans flex flex-col',
    borderClass
  )}>
    <div className="grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
      <div className="flex min-h-0 items-end justify-start pl-[12.5%] pr-1 pt-1">
        <span className={clsx('font-black leading-none tracking-tight', ink, 'text-[1.55em]')}>
          {getRankDisplay(card.rank)}
        </span>
      </div>
      <div className="flex min-h-0 items-end justify-center pb-0.5">
        <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
          {suitSymbol[card.suit]}
        </span>
      </div>
      <div className="min-h-0" aria-hidden />
    </div>
  </div>
);

export const CardFaceV2: FC<{
  card: CardType;
  superStatic?: boolean;
  showSuperBonus?: boolean;
}> = ({ card, superStatic = false, showSuperBonus = false }) => {
  const isBlackSuit = card.suit === 'spades' || card.suit === 'clubs';
  const ink = isBlackSuit ? 'text-[#0F172A]' : 'text-[#BE123C]';
  const cross = card.effects.find((e) => e.type === 'cross_value' && e.ranks?.length);
  const doubleSuit = card.effects.find((e) => e.type === 'double_suit' && e.suits?.length);
  const hasHigh = card.effects.some((e) => e.type === 'high_score');
  const hasMult = card.effects.some((e) => e.type === 'multiplier');
  const hasIndepMult = card.effects.some((e) => e.type === 'independent_multiply');
  const isSuper = card.quality === 'super';
  const whiteBorder =
    card.quality === 'white'
      ? isBlackSuit ? 'border border-[#CBD5E1]' : 'border border-[#FBCFE8]'
      : '';

  const plainWhite =
    card.quality === 'white' &&
    !cross && !doubleSuit?.suits?.length && !hasHigh && !hasMult && !card.isDiamondCard;

  if (isSuper) {
    return (
      <div className={clsx(
        'relative h-full w-full overflow-hidden rounded-2xl border-2 border-[#C084FC] font-sans',
        'bg-[linear-gradient(180deg,#FFFFFF_0%,#A5D8F7_42%,#F5C7F0_100%)]',
        superStatic ? 'super-card-face-static-glow' : 'animate-super-card-border-glow'
      )}>
        {!superStatic && (
          <div className="pointer-events-none absolute inset-0 z-0 rounded-2xl animate-super-conic-hint" aria-hidden />
        )}
        <div className="relative z-10 grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
          <div className="flex min-h-0 items-end justify-start pl-[12.5%] pr-1 pt-1">
            <span className={clsx('font-black leading-none tracking-tight', ink, 'text-[1.55em]')}>
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
              <span className="shrink-0 font-black text-[#15803D] drop-shadow-sm text-[0.95em]">+15</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (plainWhite) {
    return <WhitePlainFace card={card} ink={ink} borderClass={whiteBorder} />;
  }

  if (cross?.ranks && isJqkCrossRanks(cross.ranks)) {
    return (
      <div className={clsx(
        'relative flex h-full w-full flex-col overflow-hidden rounded-[14px] border-2 font-sans',
        shellForQuality(card),
        card.quality === 'white' && whiteBorder
      )}>
        {(card.quality === 'purple' || card.quality === 'gold') && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]">
            <div className={clsx(
              'absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-shimmer-diagonal',
              card.quality === 'gold' && 'opacity-90'
            )} />
          </div>
        )}
        <div className="relative z-10 grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
          <div className="flex min-h-0 items-end justify-center px-1 pt-0.5">
            <span className={clsx('font-black leading-none tracking-[-0.04em]', ink, 'text-[1.55em]')}>
              JQK
            </span>
          </div>
          <div className="flex min-h-0 items-end justify-center pb-0.5">
            <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
              {suitSymbol[card.suit]}
            </span>
          </div>
          <div className="flex min-h-0 flex-nowrap items-center justify-center gap-[0.2em] whitespace-nowrap px-0.5 pb-0.5">
            {hasMult && card.effects.filter(e => e.type === 'multiplier').map((e, i) => (
              <span key={i} className="shrink-0 font-black text-[#9333EA] drop-shadow-sm text-[0.95em]">×{e.value ?? 0}</span>
            ))}
            {hasIndepMult && card.effects.filter(e => e.type === 'independent_multiply').map((e, i) => (
              <span key={i} className="shrink-0 font-black text-[#9333EA] drop-shadow-sm text-[0.95em]">×{e.value ?? 0}</span>
            ))}
            {hasHigh && card.effects.filter(e => e.type === 'high_score').map((e, i) => (
              <span key={i} className="shrink-0 font-black text-[#16A34A] text-[0.95em]">+{e.value ?? 0}</span>
            ))}
            {card.isDiamondCard && (
              <span className="shrink-0 font-black text-[#A16207] text-[0.95em]">
                +💎{card.diamondBonus ?? 20}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'relative h-full w-full overflow-hidden rounded-[14px] border-2 flex flex-col font-sans',
      shellForQuality(card),
      card.quality === 'white' && whiteBorder
    )}>
      {(card.quality === 'purple' || card.quality === 'gold') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]">
          <div className={clsx(
            'absolute -top-1/2 -left-1/2 h-[200%] w-[200%] animate-shimmer-diagonal',
            card.quality === 'gold' && 'opacity-90'
          )} />
        </div>
      )}
      <div className="relative z-10 grid h-full min-h-0 grid-rows-[7fr_6fr_5fr]">
        <div className={clsx(
          'flex min-h-0 items-end',
          cross && cross.ranks ? 'justify-center px-1 pt-1' : 'justify-start pl-[12.5%] pr-1 pt-1'
        )}>
          <span className={clsx(
            'font-black leading-none',
            ink,
            cross && cross.ranks && 'whitespace-nowrap',
            isEightThroughTenCross(cross?.ranks)
              ? 'text-[1.40em] tracking-tighter'
              : 'text-[1.55em] tracking-tight'
          )}>
            {cross && cross.ranks ? formatCrossValueRanks(cross.ranks) : getRankDisplay(card.rank)}
          </span>
        </div>
        <div className="flex min-h-0 items-end justify-center gap-[0.35em] pb-0.5">
          {doubleSuit?.suits ? (
            doubleSuit.suits.map(s => (
              <span key={s} className={clsx(
                'font-black leading-none', SUIT_GLYPH_CLASS,
                s === 'spades' || s === 'clubs' ? 'text-[#0F172A]' : 'text-[#BE123C]'
              )}>{suitSymbol[s]}</span>
            ))
          ) : (
            <span className={clsx('font-black leading-none', ink, SUIT_GLYPH_CLASS)}>
              {suitSymbol[card.suit]}
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-nowrap items-center justify-center gap-[0.2em] whitespace-nowrap px-0.5 pb-0.5">
          {hasMult && card.effects.filter(e => e.type === 'multiplier').map((e, i) => (
            <span key={i} className="shrink-0 font-black text-[#9333EA] drop-shadow-sm text-[0.95em]">×{e.value ?? 0}</span>
          ))}
          {hasIndepMult && card.effects.filter(e => e.type === 'independent_multiply').map((e, i) => (
            <span key={i} className="shrink-0 font-black text-[#9333EA] drop-shadow-sm text-[0.95em]">×{e.value ?? 0}</span>
          ))}
          {hasHigh && card.effects.filter(e => e.type === 'high_score').map((e, i) => (
            <span key={i} className="shrink-0 font-black text-[#16A34A] drop-shadow-sm text-[0.95em]">+{e.value ?? 0}</span>
          ))}
          {card.isDiamondCard && (
            <span className="shrink-0 font-black text-[#A16207] text-[0.95em]">
              +💎{card.diamondBonus ?? 20}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
