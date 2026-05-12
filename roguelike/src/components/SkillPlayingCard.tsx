import React, { Fragment, useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import type { SkillDef, SkillEnhancement, SkillQuality } from '../types/skill';
import { enhancementBadgeParts, ENHANCEMENT_VALUE_INNER } from '../utils/skillEnhancementDisplay';
import { getSkillCumulativeFinalSegments, getSkillFaceBaseNumericSegments } from '../utils/skillCardFaceStats';
import type { SkillNumericSegment } from '../utils/skillNumericDisplay';
import { SKILL_FACE_NUMERIC_CLASS } from '../utils/skillNumericDisplay';

/** 基础数值单行：逗号分色、不换行，随牌宽缩小字号 */
export function SkillFaceNumericOneLineRow({
  segments,
  variant = 'card',
}: {
  segments: SkillNumericSegment[];
  /** detail：详情弹层约 3× 牌宽，字号上限更高 */
  variant?: 'card' | 'detail';
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const depKey = segments.map((s) => `${s.kind}:${s.text}`).join('|');
  const maxPx = variant === 'detail' ? 22 : 13;
  const minPx = variant === 'detail' ? 11 : 6.5;
  const initialPx = variant === 'detail' ? 22 : 13;

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const fit = () => {
      const cw = outer.clientWidth;
      if (cw <= 0) return;
      let fs = maxPx;
      inner.style.fontSize = `${fs}px`;
      while (inner.scrollWidth > cw && fs > minPx) {
        fs -= 0.5;
        inner.style.fontSize = `${fs}px`;
      }
    };

    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    fit();
    return () => ro.disconnect();
  }, [depKey, maxPx, minPx]);

  return (
    <div ref={outerRef} className="w-full min-w-0 max-w-full">
      <span
        ref={innerRef}
        className="inline-flex items-baseline whitespace-nowrap font-black tabular-nums leading-none"
        style={{ fontSize: `${initialPx}px` }}
      >
        {segments.map((s, i) => (
          <Fragment key={`${s.kind}:${s.text}:${i}`}>
            {i > 0 ? <span className="text-current/45">,</span> : null}
            <span className={SKILL_FACE_NUMERIC_CLASS[s.kind]}>{s.text}</span>
          </Fragment>
        ))}
      </span>
    </div>
  );
}

/** 底部边数值（如 +$30、+10 倍、×1.5）：单行，随牌宽缩小字号 */
export function SkillEdgeValueOneLine({
  value,
  enhancement,
  variant = 'card',
}: {
  value: string;
  enhancement: Exclude<SkillEnhancement, 'normal'>;
  variant?: 'card' | 'detail';
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const maxPx = variant === 'detail' ? 22 : 12;
  const minPx = variant === 'detail' ? 10 : 5.5;
  const initialPx = variant === 'detail' ? 22 : 12;

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const fit = () => {
      const cw = outer.clientWidth;
      if (cw <= 0) return;
      let fs = maxPx;
      inner.style.fontSize = `${fs}px`;
      while (inner.scrollWidth > cw && fs > minPx) {
        fs -= 0.5;
        inner.style.fontSize = `${fs}px`;
      }
    };

    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    fit();
    return () => ro.disconnect();
  }, [value, enhancement, maxPx, minPx]);

  return (
    <div ref={outerRef} className="flex w-full min-w-0 max-w-full justify-center px-1 leading-none">
      <span
        ref={innerRef}
        className={clsx(ENHANCEMENT_VALUE_INNER[enhancement], 'leading-none')}
        style={{ fontSize: `${initialPx}px`, lineHeight: 1 }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * 牌底贴齐 EdgeChrome 内圆角底边：背景与周缘银/金/彩边共用同一套渐变与平移动画；
 * 顶沿 `inset` 高光与牌面内描边视觉衔接。
 */
export function SkillEdgeValueBottomStrip({
  enhancement,
  faceScale = 1,
  children,
}: {
  enhancement: Exclude<SkillEnhancement, 'normal'>;
  faceScale?: 1 | 3;
  children: React.ReactNode;
}) {
  const rb = faceScale === 3 ? 'rounded-b-[27px]' : 'rounded-b-[9px]';
  /**
   * 条高紧贴单行字盒：不改变 `SkillEdgeValueOneLine` 的字号上下限（牌 12px～5.5px / 详情 22px～10px），
   * 仅压条壳 `min-height` 与内边距；略小于 max 字高以靠 flex 垂直居中吃净上下留白。
   */
  const minH = faceScale === 3 ? 'min-h-[23px]' : 'min-h-[15px]';

  return (
    <div
      className={clsx(
        'relative isolate w-full shrink-0 overflow-hidden',
        rb,
        minH,
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
      )}
    >
      {enhancement === 'flash' ? (
        <div className={clsx('skill-edge-value-bg-silver pointer-events-none absolute inset-0', rb)} aria-hidden />
      ) : null}
      {enhancement === 'gold' ? (
        <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', rb)} aria-hidden>
          <div className={clsx('absolute inset-0 overflow-hidden', rb)}>
            <div className="absolute left-0 top-0 h-full min-h-full w-[200%] max-w-none skill-edge-pan-gold" />
          </div>
        </div>
      ) : null}
      {enhancement === 'laser' ? (
        <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', rb)} aria-hidden>
          <div className={clsx('absolute inset-0 overflow-hidden', rb)}>
            <div className="absolute left-0 top-0 h-full min-h-full w-[200%] max-w-none skill-edge-pan-prismatic" />
          </div>
        </div>
      ) : null}
      {enhancement === 'black' ? (
        <div className={clsx('pointer-events-none absolute inset-0 overflow-hidden', rb)} aria-hidden>
          <div className={clsx('absolute inset-0 skill-edge-value-bg-black', rb)} />
          <div className={clsx('absolute inset-0 skill-edge-black-spots skill-edge-black-spots--value', rb)} />
        </div>
      ) : null}
      <div className="relative z-10 flex h-full w-full min-h-0 items-center justify-center px-1.5 py-0 leading-none">
        {children}
      </div>
    </div>
  );
}

/** 与 CardFaceV2 shellForQuality 绿蓝紫一致 */
const QUALITY_FACE: Record<
  SkillQuality,
  { bg: string; border: string; ink: string; /** 无边牌：与流光同款 mask 环宽，纯色无动效 */ normalRingBg: string }
> = {
  green: {
    bg: 'bg-[#BBF7D0]',
    border: 'border-[#22C55E]',
    ink: 'text-emerald-950',
    normalRingBg: 'bg-emerald-600/[0.38]',
  },
  blue: {
    bg: 'bg-[#93C5FD]',
    border: 'border-[#3B82F6]',
    ink: 'text-blue-950',
    normalRingBg: 'bg-blue-600/[0.36]',
  },
  purple: {
    /** 略深于旧 #F5D0FE，便于牌面 overlay 流光压出明暗 */
    bg: 'bg-[#E9D5FF]',
    border: 'border-[#C026D3]',
    ink: 'text-purple-950',
    normalRingBg: 'bg-fuchsia-700/[0.42]',
  },
};

/** 无边牌：与 EnhancementRing 同 mask，品质色静态填充 5px 环带 */
function NormalQualityRing({ quality, outerRound, maskClass }: { quality: SkillQuality; outerRound: string; maskClass: string }) {
  const cls = QUALITY_FACE[quality].normalRingBg;
  return (
    <div
      className={clsx('skill-edge-mask-ring absolute inset-0', maskClass, outerRound, cls)}
      aria-hidden
    />
  );
}

/** 流光仅出现在距外缘 5px 的内环（mask），与无边牌共用同一外框与 inset-[5px] 正文区 */
function EnhancementRing({
  variant,
  outerRound,
  maskClass,
}: {
  variant: 'silver' | 'gold' | 'prismatic' | 'black';
  outerRound: string;
  maskClass: string;
}) {
  if (variant === 'silver') {
    return (
      <div
        className={clsx(
          'skill-edge-mask-ring absolute inset-0 skill-edge-ring-silver',
          maskClass,
          outerRound,
        )}
        aria-hidden
      />
    );
  }
  if (variant === 'black') {
    return (
      <div
        className={clsx(
          'skill-edge-mask-ring absolute inset-0 overflow-hidden',
          maskClass,
          outerRound,
        )}
        aria-hidden
      >
        <div className={clsx('absolute inset-0 skill-edge-ring-black', outerRound)} />
        <div className={clsx('absolute inset-0 skill-edge-black-spots', outerRound)} />
      </div>
    );
  }
  const panClass = variant === 'gold' ? 'skill-edge-pan-gold' : 'skill-edge-pan-prismatic';
  return (
    <div className={clsx('skill-edge-mask-ring absolute inset-0 overflow-hidden', maskClass, outerRound)} aria-hidden>
      <div className={clsx('absolute inset-0 overflow-hidden', outerRound)}>
        <div className={clsx('absolute left-0 top-0 h-full min-h-full w-[200%] max-w-none', panClass)} />
      </div>
    </div>
  );
}

function EdgeChrome({
  enhancement,
  quality,
  children,
  faceScale = 1,
}: {
  enhancement: SkillEnhancement;
  quality: SkillQuality;
  children: React.ReactNode;
  /** 详情弹层 ≈3×：圆角、mask 环宽、内嵌与 HUD 小牌一致按比例放大 */
  faceScale?: 1 | 3;
}) {
  const q = QUALITY_FACE[quality];
  const isNormal = enhancement === 'normal';
  const outerRound = faceScale === 3 ? 'rounded-[42px]' : 'rounded-[14px]';
  const innerRound = faceScale === 3 ? 'rounded-[27px]' : 'rounded-[9px]';
  const inset = faceScale === 3 ? 'inset-[15px]' : 'inset-[5px]';
  const maskClass = faceScale === 3 ? 'skill-edge-mask-ring--x3' : '';

  return (
    <div className={clsx('relative h-full w-full overflow-hidden', outerRound, isNormal && q.bg)}>
      {isNormal ? (
        <NormalQualityRing quality={quality} outerRound={outerRound} maskClass={maskClass} />
      ) : (
        <>
          {enhancement === 'flash' && (
            <EnhancementRing variant="silver" outerRound={outerRound} maskClass={maskClass} />
          )}
          {enhancement === 'gold' && (
            <EnhancementRing variant="gold" outerRound={outerRound} maskClass={maskClass} />
          )}
          {enhancement === 'laser' && (
            <EnhancementRing variant="prismatic" outerRound={outerRound} maskClass={maskClass} />
          )}
          {enhancement === 'black' && (
            <EnhancementRing variant="black" outerRound={outerRound} maskClass={maskClass} />
          )}
        </>
      )}
      <div
        className={clsx(
          'absolute z-10 min-h-0 min-w-0 overflow-hidden',
          inset,
          innerRound,
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** 详情弹层等：与小牌相同的流光边 + 品质底色容器（内容由父级传入） */
export function SkillPlayingCardDetailShell({
  quality,
  enhancement,
  children,
  className,
  faceScale = 1,
}: {
  quality: SkillQuality;
  enhancement: SkillEnhancement;
  children: React.ReactNode;
  className?: string;
  faceScale?: 1 | 3;
}) {
  const q = QUALITY_FACE[quality];
  const isPurple = quality === 'purple';

  return (
    <div className={clsx('flex min-h-0 flex-col overflow-hidden', className)}>
      <EdgeChrome enhancement={enhancement} quality={quality} faceScale={faceScale}>
        {isPurple ? (
          <div className={clsx('relative flex h-full min-h-0 flex-col overflow-hidden', q.bg, q.ink)}>
            <div className="skill-purple-face-shimmer-layer z-[1]" aria-hidden />
            <div className="relative z-[2] flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
          </div>
        ) : (
          <div className={clsx('flex h-full min-h-0 flex-col overflow-hidden', q.bg, q.ink)}>{children}</div>
        )}
      </EdgeChrome>
    </div>
  );
}

export interface SkillPlayingCardProps {
  skill: Pick<SkillDef, 'name' | 'quality' | 'description' | 'effects' | 'id'>;
  enhancement: SkillEnhancement;
  /** 测试/插画：牌面背景图（仅内容区，不影响外环/边框）；不传则不渲染 */
  faceImageUrl?: string;
  /** 图片适配方式 */
  faceImageFit?: 'cover' | 'contain';
  /** 图片不透明度（0~1） */
  faceImageOpacity?: number;
  /** 填图后隐藏牌面文字（技能名/数值/底边条等） */
  hideFaceText?: boolean;
  /** 仅测试用：禁用紫色品质牌面的锥彩 shimmer 层 */
  disablePurpleShimmer?: boolean;
  /** `skillAccumulation[skill.id]`：累积类技能的当前池 */
  accumulated?: number;
  /** 本局超级牌张数；有「超级牌乘倍」且传入时才显示如 ×1.6 */
  superCardCount?: number;
  /** 局内 💎；钻石估值/倍率牌面动态显示 */
  runDiamonds?: number;
  /** 剩手加倍牌面：本关总手数 / 已打完手数（计分时刻） */
  stageTotalHands?: number;
  stageUsedHands?: number;
  /** 随机加倍：翻牌后本手锁定倍数，用于牌面显示 +N 倍 */
  pendingRandomHandMult?: number;
  /** 已装备技能 id；「技能数加倍」牌面显示与结算一致的 +N 倍 */
  acquiredSkillIds?: string[];
  /** 与默认扑克 Card 一致的比例容器；由父级设宽度即可 */
  className?: string;
  onClick?: () => void;
}

/**
 * 扑克同轮廓技能牌（2:3、rounded-[14px]）。用于预览页及后续商店/ HUD。
 * 牌面：大字技能名 + 即时基础数值单行（ace_combo 为 `$30,4 倍` 缩短文案）+ 累积池/超级牌最终行；底边全宽流光条为附加边数值（与周缘同套金银彩动效）。
 */
export function SkillPlayingCard({
  skill,
  enhancement,
  faceImageUrl,
  faceImageFit = 'cover',
  faceImageOpacity = 1,
  hideFaceText = false,
  disablePurpleShimmer = false,
  accumulated,
  superCardCount,
  runDiamonds,
  stageTotalHands,
  stageUsedHands,
  pendingRandomHandMult,
  acquiredSkillIds,
  className,
  onClick,
}: SkillPlayingCardProps) {
  const q = QUALITY_FACE[skill.quality];
  const edgeParts = enhancementBadgeParts(enhancement);
  const interactive = Boolean(onClick);
  const cumulativeSegments = getSkillCumulativeFinalSegments(skill, { accumulated, superCardCount });
  const baseNumericSegments = getSkillFaceBaseNumericSegments(skill, {
    runDiamonds,
    stageTotalHands,
    stageUsedHands,
    pendingRandomHandMult,
    acquiredSkillIds,
  });

  const isFlashEdge = enhancement === 'flash';
  const hasEdgeValue = Boolean(edgeParts && enhancement !== 'normal');
  const hideText = hideFaceText && Boolean(faceImageUrl);

  const isPurple = skill.quality === 'purple';
  const showPurpleShimmer = isPurple && !disablePurpleShimmer;

  const face = (
    <div
      className={clsx(
        'relative flex h-full min-h-0 flex-col overflow-hidden text-center',
        hideText ? 'p-0' : hasEdgeValue ? 'pt-[max(0.75rem,10%)] pb-0' : 'pt-[max(0.9375rem,13%)] pb-[8%]',
        q.bg,
        q.ink,
      )}
    >
      {faceImageUrl ? (
        <div className="absolute inset-0 z-0" aria-hidden>
          <img
            src={faceImageUrl}
            alt=""
            className={clsx(
              'absolute inset-0 h-full w-full',
              faceImageFit === 'contain' ? 'object-contain' : 'object-cover',
            )}
            style={{ opacity: Math.max(0, Math.min(1, faceImageOpacity)) }}
            draggable={false}
          />
          {/* 轻量暗化：提升标题/数值可读性（不改变品质底色逻辑）；需要更强控制可在测试页加参数 */}
          <div className="absolute inset-0 bg-black/10" />
        </div>
      ) : null}
      {showPurpleShimmer ? <div className="skill-purple-face-shimmer-layer z-[1]" aria-hidden /> : null}
      {hideText ? null : (
        <>
          {/* 银边（flash）：技能名区不截断，允许多行，过长时在区内纵向滚动 */}
          <div
            className={clsx(
              'relative z-[2] flex min-h-0 flex-1 flex-col items-center justify-start gap-1 px-[6%]',
              isFlashEdge && 'overflow-y-auto overflow-x-hidden [scrollbar-width:thin]',
            )}
          >
            <h3
              className={clsx(
                'w-full text-[clamp(0.875rem,11cqw,1.125rem)] font-black leading-[1.15] tracking-tight break-words',
                isFlashEdge ? 'line-clamp-none' : 'line-clamp-4',
              )}
            >
              {skill.name}
            </h3>
            {baseNumericSegments.length > 0 ? (
              <div className="-mt-0.5 w-full min-w-0 max-w-full">
                <SkillFaceNumericOneLineRow segments={baseNumericSegments} />
              </div>
            ) : null}
            {cumulativeSegments.length > 0 ? (
              <div className="flex max-w-full flex-col gap-0.5">
                {cumulativeSegments.map((seg, i) => (
                  <span
                    key={`${i}:${seg.kind}:${seg.text}`}
                    className={clsx(
                      SKILL_FACE_NUMERIC_CLASS[seg.kind],
                      'text-[clamp(0.75rem,6cqw,0.875rem)] font-black tabular-nums leading-none',
                    )}
                  >
                    {seg.text}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {hasEdgeValue && edgeParts && enhancement !== 'normal' ? (
            <div className="relative z-[2] shrink-0">
              <SkillEdgeValueBottomStrip enhancement={enhancement} faceScale={1}>
                <SkillEdgeValueOneLine value={edgeParts.value} enhancement={enhancement} />
              </SkillEdgeValueBottomStrip>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  const inner = (
    <EdgeChrome enhancement={enhancement} quality={skill.quality}>
      {face}
    </EdgeChrome>
  );

  return (
    <div
      className={clsx(
        /* 宽度由父级决定（关内槽位 / 预览列），避免 vw 随桌面视口突变 */
        'group relative aspect-[2/3] w-full min-w-0 max-w-[5.75rem] select-none',
        '[container-type:inline-size]',
        interactive && 'cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-[0.98]',
        className
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="absolute inset-0 overflow-hidden rounded-[14px] pb-px shadow-[0_4px_12px_rgba(15,23,40,0.22)]">
        {inner}
      </div>
    </div>
  );
}
