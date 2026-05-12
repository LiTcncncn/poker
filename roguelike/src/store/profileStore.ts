import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProfileState, RunClearRecord, FrameId, FRAME_DEFS } from '../types/profile';
import { RG_STORAGE_SLUG } from '../config/storageNamespace';
import { getUnlockedOrdersAfterNormalRun } from '../config/skillUnlockOrders';

// ─── 存储版本 ──────────────────────────────────────────────────
const PROFILE_SCHEMA_VERSION = 1 as const;
const PROFILE_PERSIST_KEY = `poker-roguelike-${RG_STORAGE_SLUG}-profile-v${PROFILE_SCHEMA_VERSION}`;

// ─── 初始 Profile ──────────────────────────────────────────────
const INITIAL_PROFILE: ProfileState = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  highestNormalRunCleared: 0,
  normalClears: {},
  hardClears: {},
  normalEndlessBest: {},
  hardEndlessBest: {},
  activeFrame: 'default',
};

// ─── Store 接口 ────────────────────────────────────────────────
interface ProfileStore {
  profile: ProfileState;

  /** 记录普通局通关 */
  recordNormalClear: (runNo: number) => void;
  /** 记录困难局通关 */
  recordHardClear: (runNo: number) => void;
  /** 更新普通局无尽最高关数 */
  updateNormalEndlessBest: (runNo: number, count: number) => void;
  /** 更新困难局无尽最高关数 */
  updateHardEndlessBest: (runNo: number, count: number) => void;

  /** 当前可用技能解锁顺序（根据最高通关局数计算） */
  getUnlockedOrders: () => number[];
  /** 某普通局是否已通关 */
  isNormalCleared: (runNo: number) => boolean;
  /** 某困难局是否已通关 */
  isHardCleared: (runNo: number) => boolean;
  /** 某普通局是否可挑战（前一局已通关，或就是第 1 局） */
  isNormalChallengeableRun: (runNo: number) => boolean;
  /** 某困难局是否已解锁（对应普通局已通关） */
  isHardUnlocked: (runNo: number) => boolean;

  /** 已解锁的边框列表（根据最高通关局计算） */
  getUnlockedFrames: () => FrameId[];
  /** 切换当前边框 */
  setActiveFrame: (frame: FrameId) => void;

  /** 重置 Profile（调试用） */
  resetProfile: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: INITIAL_PROFILE,

      recordNormalClear: (runNo) => {
        set((state) => {
          const prev = state.profile.normalClears[runNo];
          if (prev) return state; // 已有记录，不覆盖（保留首次通关时间）
          const newRecord: RunClearRecord = {
            clearedAt: Date.now(),
            bestEndlessCount: 0,
          };
          const highest = Math.max(state.profile.highestNormalRunCleared, runNo);
          const newlyUnlockedFrames = FRAME_DEFS.filter((f) => f.unlockRunNo === runNo);
          const newlyUnlockedFrame = newlyUnlockedFrames[newlyUnlockedFrames.length - 1];
          return {
            profile: {
              ...state.profile,
              highestNormalRunCleared: highest,
              normalClears: { ...state.profile.normalClears, [runNo]: newRecord },
              activeFrame: newlyUnlockedFrame?.id ?? state.profile.activeFrame,
            },
          };
        });
      },

      recordHardClear: (runNo) => {
        set((state) => {
          const prev = state.profile.hardClears[runNo];
          if (prev) return state;
          const newRecord: RunClearRecord = {
            clearedAt: Date.now(),
            bestEndlessCount: 0,
          };
          return {
            profile: {
              ...state.profile,
              hardClears: { ...state.profile.hardClears, [runNo]: newRecord },
            },
          };
        });
      },

      updateNormalEndlessBest: (runNo, count) => {
        set((state) => {
          const prev = state.profile.normalEndlessBest[runNo] ?? 0;
          if (count <= prev) return state;
          // 同步更新 normalClears 里的 bestEndlessCount
          const prevClear = state.profile.normalClears[runNo];
          const updatedClear = prevClear
            ? { ...prevClear, bestEndlessCount: Math.max(prevClear.bestEndlessCount, count) }
            : null;
          return {
            profile: {
              ...state.profile,
              normalEndlessBest: { ...state.profile.normalEndlessBest, [runNo]: count },
              ...(updatedClear
                ? { normalClears: { ...state.profile.normalClears, [runNo]: updatedClear } }
                : {}),
            },
          };
        });
      },

      updateHardEndlessBest: (runNo, count) => {
        set((state) => {
          const prev = state.profile.hardEndlessBest[runNo] ?? 0;
          if (count <= prev) return state;
          const prevClear = state.profile.hardClears[runNo];
          const updatedClear = prevClear
            ? { ...prevClear, bestEndlessCount: Math.max(prevClear.bestEndlessCount, count) }
            : null;
          return {
            profile: {
              ...state.profile,
              hardEndlessBest: { ...state.profile.hardEndlessBest, [runNo]: count },
              ...(updatedClear
                ? { hardClears: { ...state.profile.hardClears, [runNo]: updatedClear } }
                : {}),
            },
          };
        });
      },

      getUnlockedOrders: () => {
        const { profile } = get();
        return getUnlockedOrdersAfterNormalRun(profile.highestNormalRunCleared);
      },

      isNormalCleared: (runNo) => {
        const { profile } = get();
        return !!profile.normalClears[runNo];
      },

      isHardCleared: (runNo) => {
        const { profile } = get();
        return !!profile.hardClears[runNo];
      },

      isNormalChallengeableRun: (runNo) => {
        if (runNo === 1) return true;
        const { profile } = get();
        return !!profile.normalClears[runNo - 1];
      },

      isHardUnlocked: (runNo) => {
        const { profile } = get();
        return !!profile.normalClears[runNo];
      },

      getUnlockedFrames: () => {
        const h = get().profile.highestNormalRunCleared;
        return FRAME_DEFS
          .filter(f => h >= f.unlockRunNo)
          .map(f => f.id);
      },

      setActiveFrame: (frame) => {
        set(state => ({
          profile: { ...state.profile, activeFrame: frame },
        }));
      },

      resetProfile: () => {
        set({ profile: INITIAL_PROFILE });
      },
    }),
    {
      name: PROFILE_PERSIST_KEY,
      version: PROFILE_SCHEMA_VERSION,
    }
  )
);
