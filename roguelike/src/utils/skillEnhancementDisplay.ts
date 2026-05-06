import type { SkillEnhancement } from '../types/skill';

/** 玩家向名称（与 Roguelike2.0技能牌面与交互设计.md 一致） */
export const ENHANCEMENT_DISPLAY: Record<SkillEnhancement, string> = {
  normal: '',
  flash: '银边',
  gold: '金边',
  laser: '彩边',
  black: '黑边',
};

export function enhancementBonusLine(e: SkillEnhancement): string | null {
  const p = enhancementBadgeParts(e);
  if (!p) return null;
  return `${p.label} ${p.value}`;
}

/** 拆分名称与数值（文案拼接即 enhancementBonusLine） */
export function enhancementBadgeParts(e: SkillEnhancement): { label: string; value: string } | null {
  if (e === 'normal') return null;
  if (e === 'flash') return { label: '银边', value: '+$40' };
  if (e === 'gold') return { label: '金边', value: '+10 倍' };
  if (e === 'laser') return { label: '彩边', value: '×1.5' };
  return { label: '黑边', value: '技能+1' };
}

/**
 * 底部流光条上的数值字：无底色素块，靠字重与阴影压在渐变上（与周缘金银彩边同套渐变）。
 */
export const ENHANCEMENT_VALUE_INNER: Record<
  Exclude<SkillEnhancement, 'normal'>,
  string
> = {
  flash:
    'inline-flex min-w-0 max-w-full shrink items-center justify-center whitespace-nowrap font-black tabular-nums leading-none text-slate-900 [text-shadow:0_1px_0_rgba(255,255,255,0.65),0_0_10px_rgba(255,255,255,0.35)]',
  gold:
    'inline-flex min-w-0 max-w-full shrink items-center justify-center whitespace-nowrap font-black tabular-nums leading-none text-amber-950 [text-shadow:0_1px_0_rgba(255,250,235,0.55),0_0_8px_rgba(254,243,199,0.45)]',
  laser:
    'inline-flex min-w-0 max-w-full shrink items-center justify-center whitespace-nowrap font-black tabular-nums leading-none text-violet-950 [text-shadow:0_1px_0_rgba(255,255,255,0.4),0_0_10px_rgba(196,181,253,0.5)]',
  black:
    'inline-flex min-w-0 max-w-full shrink items-center justify-center whitespace-nowrap font-black tabular-nums leading-none text-slate-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.75),0_0_8px_rgba(255,255,255,0.2)]',
};
