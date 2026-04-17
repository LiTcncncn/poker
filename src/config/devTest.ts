/**
 * 仅本地 `npm run dev`：生产 `npm run build` 中 import.meta.env.DEV 为 false，下列常量不生效。
 */
export const IS_DEV_TEST_BUILD = import.meta.env.DEV;

export const DEV_TEST_DIAMONDS_MIN = 10_000;
/** 每点体力恢复间隔（毫秒） */
export const DEV_TEST_RECOVER_INTERVAL_MS = 1_000;
