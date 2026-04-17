import React from 'react';
import clsx from 'clsx';
import { Card as CardType } from '../types/poker';
import {
  CARD_BACK_WHITE_INSET_OVERLAY_CLASS,
  getCardBackImagePath,
  getCardImagePath,
} from '../utils/cardImageMapping';
import { CardFaceV2 } from './CardFaceV2';

interface CardProps {
  card: CardType;
  isFlipped: boolean;
  isScoring?: boolean;
  isHeld?: boolean;
  showSuperBonus?: boolean;
  /** 牌池等：超级牌仅静态外观，关闭边框/锥彩动画 */
  superCardStatic?: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  showDetails?: boolean;
}

export const Card: React.FC<CardProps> = ({
  card,
  isFlipped,
  isScoring = false,
  isHeld = false,
  showSuperBonus = false,
  superCardStatic = false,
  className,
  onClick,
  style,
  showDetails = false,
}) => {
  const isSuperQuality = card.quality === 'super';
  const isJoker = card.isJoker;

  const cardCornerClass =
    isSuperQuality && !isJoker ? 'rounded-2xl' : 'rounded-[14px]';

  const baseFontSize = style?.fontSize != null ? String(style.fontSize) : '1rem';
  const useCqwTypography = style?.fontSize == null;

  const liftTranslate =
    (isHeld && isFlipped) || (isScoring && isFlipped);

  const cardBody = (
    <>
      {/* 圆角裁剪在静态层，避免 preserve-3d 旋转层使用 overflow-hidden 导致背面剔除异常、出现镜像感 */}
      <div className={clsx('relative h-full w-full overflow-hidden', cardCornerClass)}>
        <div
          className={clsx(
            'relative h-full w-full transition-transform duration-[250ms] ease-out',
            isFlipped ? 'rotate-y-0' : 'rotate-y-180'
          )}
          style={{
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
          }}
        >
          <div
            className={clsx(
              'absolute inset-0 backface-hidden rotate-y-0 flex flex-col overflow-hidden',
              'border-0 bg-transparent p-0'
            )}
          >
              {isJoker && isFlipped && (
                <div
                  className={clsx(
                    'relative h-full w-full overflow-hidden rounded-[14px] border border-[#CBD5E1] bg-[#FDF0E0] shadow-[0_4px_12px_rgba(15,23,40,0.19)]'
                  )}
                >
                  <img
                    src={getCardImagePath(card)}
                    alt="Joker"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              )}

              {!isJoker && <CardFaceV2 card={card} superStatic={superCardStatic} showSuperBonus={showSuperBonus} />}
          </div>

          <div
            className={clsx(
              'absolute inset-0 backface-hidden rotate-y-180 flex flex-col overflow-hidden bg-[#0B1220]',
              cardCornerClass
            )}
          >
            <img
              src={getCardBackImagePath()}
              alt="Card back"
              className="relative z-0 block h-full w-full object-cover object-center select-none"
              draggable={false}
            />
            <div
              className={clsx(CARD_BACK_WHITE_INSET_OVERLAY_CLASS, cardCornerClass)}
              aria-hidden
            />
          </div>

          {isHeld && isFlipped && (
            <>
              <div
                className={clsx(
                  'pointer-events-none absolute inset-0 z-[25] rotate-y-0 border-4 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.8)] backface-hidden',
                  cardCornerClass
                )}
              />
              <div className="pointer-events-none absolute inset-x-0 top-1 z-[35] flex justify-center rotate-y-0 backface-hidden">
                <span className="rounded bg-yellow-400 px-2 py-0.5 text-xs font-black text-yellow-900 shadow-lg sm:text-sm">
                  HOLD
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative cursor-pointer select-none transition-transform duration-300',
        'hover:-translate-y-2',
        liftTranslate && '-translate-y-2',
        !style &&
          (showDetails
            ? 'w-20 sm:w-32 aspect-[2/3] max-w-full'
            : 'w-[min(18vw,5rem)] max-w-20 aspect-[2/3] sm:w-24'),
        style && 'min-h-0',
        className
      )}
      style={{
        perspective: '1000px',
        WebkitPerspective: '1000px',
        ...style,
      }}
    >
      {useCqwTypography ? (
        <div className="absolute inset-0 min-h-0 min-w-0 [container-type:inline-size]">
          <div className="h-full w-full min-h-0 min-w-0" style={{ fontSize: '25.806cqw' }}>
            {cardBody}
          </div>
        </div>
      ) : (
        <div className="h-full w-full min-h-0 min-w-0" style={{ fontSize: baseFontSize }}>
          {cardBody}
        </div>
      )}
      {isScoring && isFlipped && (
        <div
          className={clsx(
            'pointer-events-none absolute inset-0 z-[30]',
            cardCornerClass,
            'scoring-card-gold-ring'
          )}
          aria-hidden
        />
      )}
    </div>
  );
};
