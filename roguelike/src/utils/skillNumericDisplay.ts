/**
 * 牌面数值标识色：+$ 蓝、+N 倍 红、×N 橙（与策划约定一致）
 */
export type SkillNumericKind = 'score' | 'mult_add' | 'times';

export interface SkillNumericSegment {
  kind: SkillNumericKind;
  text: string;
}

/** Tailwind 类名：在浅色品质底上保持对比度 */
export const SKILL_FACE_NUMERIC_CLASS: Record<SkillNumericKind, string> = {
  score: 'text-blue-700',
  mult_add: 'text-red-600',
  times: 'text-orange-600',
};
