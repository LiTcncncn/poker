/**
 * 本地存储命名空间：与 Vite `base` 路径末段一致（如 `/dist/rg1/` → `rg1`），
 * 与旧版部署 `/dist/rg/`（`rg`）的排行榜、Zustand 存档 **互不读写**。
 */

function storagePathSlug(): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/^\/+|\/+$/g, '');
  const parts = base.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && /^[a-zA-Z0-9_-]+$/.test(last)) return last;
  return 'rg1';
}

export const RG_STORAGE_SLUG = storagePathSlug();

/** 与 `roguelikeStore` persist `version` / migrate 同步递增 */
export const ROGUELIKE_PERSIST_SCHEMA_VERSION = 20 as const;

/** zustand persist 的 `name`（localStorage 键名） */
export const ROGUELIKE_ZUSTAND_PERSIST_NAME = `poker-roguelike-${RG_STORAGE_SLUG}-storage-v${ROGUELIKE_PERSIST_SCHEMA_VERSION}`;

export const RUSH_LEADERBOARD_STORAGE_KEY = `poker-roguelike-${RG_STORAGE_SLUG}-rush-leaderboard-v1`;

/** 错误边界「重置」时仅清理本构建命名空间下的可能键（含历史 v1～当前） */
export function roguelikeLocalStorageKeysForHardReset(): string[] {
  const s = RG_STORAGE_SLUG;
  const keys = new Set<string>([
    RUSH_LEADERBOARD_STORAGE_KEY,
    ROGUELIKE_ZUSTAND_PERSIST_NAME,
    `poker-roguelike-${s}-storage`,
  ]);
  for (let v = 1; v <= ROGUELIKE_PERSIST_SCHEMA_VERSION; v++) {
    keys.add(`poker-roguelike-${s}-storage-v${v}`);
  }
  return [...keys];
}
