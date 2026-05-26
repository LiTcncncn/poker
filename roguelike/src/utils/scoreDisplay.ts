/**
 * 局内计分数字展示：统一蓝色，不使用 $ / 分 / 图标。
 * 技能牌浅色底仍用 skillNumericDisplay 的 text-blue-700。
 */

/** 深色背景上的计分数字 */
export const SCORE_TEXT_CLASS = 'text-sky-400';

/** 强调计分（结算大字、目标等） */
export const SCORE_TEXT_CLASS_STRONG = 'text-sky-300 font-black tabular-nums';

export function formatSignedScore(n: number, locale = true): string {
  const s = locale ? Math.abs(n).toLocaleString() : String(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return locale ? (0).toLocaleString() : '0';
}

export function formatScorePlain(n: number): string {
  return n.toLocaleString();
}
