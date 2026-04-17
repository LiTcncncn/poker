import { Card } from '../types/poker';

/** 仅小丑牌使用位图；普通牌正面由 CardFaceV2 绘制，不依赖 poker1–52 */
export const getCardImagePath = (card: Card): string => {
  if (card.isJoker) {
    return `${import.meta.env.BASE_URL}pokers/poker53.png`;
  }
  return '';
};

/**
 * 主界面牌背花纹（自定义蓝底白花 PNG）；牌壳圆角与描边由 CSS 叠加，牌格保持 2:3。
 */
export const getCardBackImagePath = (): string => {
  return `${import.meta.env.BASE_URL}pokers/poker_back_custom.png`;
};

/**
 * 牌背白边须放在 **img 上方的遮罩层**：父节点上的 inset shadow 会被 `<img>` 整块盖住，浏览器里等于没有。
 * 与牌面同级的 `rounded-[14px]` / `rounded-2xl` 一并传入，圆角与裁切一致。
 */
export const CARD_BACK_WHITE_INSET_OVERLAY_CLASS =
  'pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_0_5px_#fff]';
