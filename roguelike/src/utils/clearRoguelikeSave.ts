import { roguelikeLocalStorageKeysForHardReset } from '../config/storageNamespace';
import { useProfileStore } from '../store/profileStore';
import { useRLStore } from '../store/roguelikeStore';
import { useTutorialStore } from '../store/tutorialStore';

const PROFILE_PERSIST_PREFIX = 'poker-roguelike-';

/** 清空本构建下所有 Roguelike 本地存档（测试新手引导用） */
export function clearRoguelikeSave(): void {
  for (const key of roguelikeLocalStorageKeysForHardReset()) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  // 兜底：删除同 slug 下其它 profile 键
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PROFILE_PERSIST_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }

  useRLStore.persist.clearStorage();
  useProfileStore.persist.clearStorage();

  useProfileStore.getState().resetProfile();
  useRLStore.setState({ run: null, handState: null, reward: null, gameToast: null });
  useTutorialStore.getState().resetHomeTutorial();
}
