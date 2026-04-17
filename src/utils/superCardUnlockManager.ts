/**
 * 超级牌解锁管理器
 * 负责超级牌解锁的顺序控制、进度追踪等
 */

import { UnlockProgress, SuperCardUnlockConfig } from '../types/gameMode';
import { 
  getSuperCardUnlockById,
  getSuperCardUnlockByOrder,
  getCurrentUnlockTarget,
  initializeUnlockProgress
} from './gameModeLoader';

const UNLOCK_PROGRESS_KEY = 'supercard_unlock_progress';
const UNLOCKED_CARDS_KEY = 'unlocked_super_cards';
const UNLOCK_SCHEMA_VERSION_KEY = 'supercard_unlock_schema_version';
// 当解锁顺序/存档结构发生变化时，提升这个版本号以自动清理旧数据
const UNLOCK_SCHEMA_VERSION = 'order_2_to_A_v1';

// 获取所有解锁进度
export function getAllUnlockProgress(): UnlockProgress[] {
  const saved = localStorage.getItem(UNLOCK_PROGRESS_KEY);
  if (!saved) return [];
  
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse unlock progress:', error);
    return [];
  }
}

// 保存解锁进度
export function saveUnlockProgress(progress: UnlockProgress[]): void {
  localStorage.setItem(UNLOCK_PROGRESS_KEY, JSON.stringify(progress));
}

// 获取已解锁的超级牌列表
export function getUnlockedCards(): string[] {
  const saved = localStorage.getItem(UNLOCKED_CARDS_KEY);
  if (!saved) return [];
  
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Failed to parse unlocked cards:', error);
    return [];
  }
}

// 保存已解锁的超级牌列表
export function saveUnlockedCards(cards: string[]): void {
  localStorage.setItem(UNLOCKED_CARDS_KEY, JSON.stringify(cards));
}

// 获取当前应该解锁的超级牌
export function getCurrentUnlockTargetCard(): SuperCardUnlockConfig | undefined {
  const unlockedCards = getUnlockedCards();
  return getCurrentUnlockTarget(unlockedCards);
}

// 获取指定超级牌的解锁进度
export function getUnlockProgressById(superCardId: string): UnlockProgress | undefined {
  const allProgress = getAllUnlockProgress();
  return allProgress.find(p => p.superCardId === superCardId);
}

// 更新任务进度
export function updateTaskProgress(superCardId: string, increment: number = 1): UnlockProgress | null {
  const allProgress = getAllUnlockProgress();
  let progress = allProgress.find(p => p.superCardId === superCardId);
  
  if (!progress) {
    // 如果不存在，初始化进度
    const unlock = getSuperCardUnlockById(superCardId);
    if (!unlock) return null;
    
    progress = initializeUnlockProgress(superCardId, unlock.gameModeId);
    allProgress.push(progress);
  }
  
  // 更新进度
  progress.taskProgress.current += increment;
  
  // 检查是否完成
  if (progress.taskProgress.current >= progress.taskProgress.target) {
    progress.taskProgress.completed = true;
  }
  
  // 保存
  saveUnlockProgress(allProgress);
  
  return progress;
}

// 支付解锁费用
export function payCost(superCardId: string): UnlockProgress | null {
  const allProgress = getAllUnlockProgress();
  const progress = allProgress.find(p => p.superCardId === superCardId);
  
  if (!progress) return null;
  
  // 标记为已支付
  progress.costPaid = true;
  
  // 保存
  saveUnlockProgress(allProgress);
  
  return progress;
}

// 检查是否可以解锁（任务完成 + 费用支付）
export function canUnlock(superCardId: string): boolean {
  const progress = getUnlockProgressById(superCardId);
  
  if (!progress) return false;
  
  return progress.taskProgress.completed && progress.costPaid && !progress.unlocked;
}

// 解锁超级牌
export function unlockSuperCard(superCardId: string): { success: boolean; nextGameModeId?: string } | false {
  // 检查是否可以解锁
  if (!canUnlock(superCardId)) {
    return false;
  }
  
  // 获取解锁配置
  const unlock = getSuperCardUnlockById(superCardId);
  if (!unlock) return false;
  
  // 检查解锁顺序（必须按顺序解锁）
  const unlockedCards = getUnlockedCards();
  
  // 如果不是第一张牌，检查前一张是否已解锁
  if (unlock.unlockOrder > 1) {
    const prevUnlock = getSuperCardUnlockByOrder(unlock.unlockOrder - 1);
    if (prevUnlock && !unlockedCards.includes(prevUnlock.superCardId)) {
      console.error('必须按顺序解锁超级牌');
      return false;
    }
  }
  
  // 标记为已解锁
  const allProgress = getAllUnlockProgress();
  const progress = allProgress.find(p => p.superCardId === superCardId);
  if (progress) {
    progress.unlocked = true;
    saveUnlockProgress(allProgress);
  }
  
  // 添加到已解锁列表
  unlockedCards.push(superCardId);
  saveUnlockedCards(unlockedCards);
  
  console.log('✅ 解锁成功:', superCardId);
  console.log('📋 已解锁列表:', unlockedCards);
  
  // 初始化下一个超级牌的进度
  const nextUnlock = unlock.nextSuperCardId ? getSuperCardUnlockById(unlock.nextSuperCardId) : null;
  if (nextUnlock) {
    console.log('🎯 初始化下一张超级牌:', nextUnlock.superCardId, nextUnlock.gameModeId);
    const nextProgress = initializeUnlockProgress(nextUnlock.superCardId, nextUnlock.gameModeId);
    allProgress.push(nextProgress);
    saveUnlockProgress(allProgress);
    
    // 返回下一张超级牌的玩法ID，用于自动切换
    return { success: true, nextGameModeId: nextUnlock.gameModeId };
  }
  
  console.log('🏁 所有超级牌已解锁完毕');
  return { success: true, nextGameModeId: undefined };
}

// 重置所有解锁进度（用于测试或重置游戏）
export function resetAllUnlockProgress(): void {
  localStorage.removeItem(UNLOCK_PROGRESS_KEY);
  localStorage.removeItem(UNLOCKED_CARDS_KEY);
  
  // 初始化第一张超级牌的进度
  const firstUnlock = getSuperCardUnlockByOrder(1);
  if (firstUnlock) {
    const progress = initializeUnlockProgress(firstUnlock.superCardId, firstUnlock.gameModeId);
    saveUnlockProgress([progress]);
  }
}

// 获取解锁进度百分比
export function getUnlockProgressPercentage(superCardId: string): number {
  const progress = getUnlockProgressById(superCardId);
  if (!progress) return 0;
  
  const taskPercent = (progress.taskProgress.current / progress.taskProgress.target) * 50;
  const costPercent = progress.costPaid ? 50 : 0;
  
  return Math.min(100, taskPercent + costPercent);
}

// 获取解锁进度摘要（用于UI显示）
export function getUnlockSummary(superCardId: string): {
  superCardId: string;
  unlockConfig: SuperCardUnlockConfig;
  progress: UnlockProgress;
  taskComplete: boolean;
  costPaid: boolean;
  canUnlock: boolean;
  isUnlocked: boolean;
  percentage: number;
} | null {
  const unlockConfig = getSuperCardUnlockById(superCardId);
  if (!unlockConfig) return null;
  
  let progress = getUnlockProgressById(superCardId);
  
  // 如果进度不存在，自动初始化（确保每个目标都有进度）
  if (!progress) {
    console.log('🔧 自动初始化进度:', superCardId);
    progress = initializeUnlockProgress(superCardId, unlockConfig.gameModeId);
    const allProgress = getAllUnlockProgress();
    allProgress.push(progress);
    saveUnlockProgress(allProgress);
  }
  
  const taskComplete = progress.taskProgress.completed || false;
  const costPaid = progress.costPaid || false;
  const isUnlocked = progress.unlocked || false;
  const canUnlockNow = canUnlock(superCardId);
  const percentage = getUnlockProgressPercentage(superCardId);
  
  return {
    superCardId,
    unlockConfig,
    progress,
    taskComplete,
    costPaid,
    canUnlock: canUnlockNow,
    isUnlocked,
    percentage
  };
}

// 初始化解锁系统（游戏启动时调用）
export function initializeUnlockSystem(): { needsGameModeSet?: string } {
  // 如果解锁顺序/结构变更，自动清理旧存档，避免“第一张仍显示♠️A”等旧数据污染
  const schemaVersion = localStorage.getItem(UNLOCK_SCHEMA_VERSION_KEY);
  if (schemaVersion !== UNLOCK_SCHEMA_VERSION) {
    console.log('🔄 超级牌解锁存档版本变更，清理旧数据', schemaVersion, '->', UNLOCK_SCHEMA_VERSION);
    localStorage.removeItem(UNLOCK_PROGRESS_KEY);
    localStorage.removeItem(UNLOCKED_CARDS_KEY);
    localStorage.setItem(UNLOCK_SCHEMA_VERSION_KEY, UNLOCK_SCHEMA_VERSION);
  }

  let allProgress = getAllUnlockProgress();
  const unlockedCards = getUnlockedCards();
  
  console.log('📋 初始化解锁系统');
  console.log('  现有进度数量:', allProgress.length);
  console.log('  已解锁数量:', unlockedCards.length);
  
  // 验证和修复现有进度数据
  let needsSave = false;
  
  // 过滤掉无效的进度（超级牌ID在配置中不存在）
  const validProgress = allProgress.filter(progress => {
    const unlock = getSuperCardUnlockById(progress.superCardId);
    if (!unlock) {
      console.log(`🗑️ 删除无效进度: ${progress.superCardId}`);
      return false;
    }
    return true;
  });
  
  if (validProgress.length !== allProgress.length) {
    allProgress = validProgress;
    needsSave = true;
  }
  
  // 修复现有进度的 target 值
  for (const progress of allProgress) {
    const unlock = getSuperCardUnlockById(progress.superCardId);
    if (unlock) {
      // 检查 target 是否与配置文件一致
      if (progress.taskProgress.target !== unlock.unlockConditions.task.target) {
        console.log(`🔧 修复进度数据: ${progress.superCardId} target ${progress.taskProgress.target} -> ${unlock.unlockConditions.task.target}`);
        progress.taskProgress.target = unlock.unlockConditions.task.target;
        // 重新检查是否完成
        progress.taskProgress.completed = progress.taskProgress.current >= progress.taskProgress.target;
        needsSave = true;
      }
      
      // 检查 gameModeId 是否正确
      if (progress.gameModeId !== unlock.gameModeId) {
        console.log(`🔧 修复玩法ID: ${progress.superCardId} ${progress.gameModeId} -> ${unlock.gameModeId}`);
        progress.gameModeId = unlock.gameModeId;
        needsSave = true;
      }
    }
  }
  
  if (needsSave) {
    saveUnlockProgress(allProgress);
  }
  
  // 如果没有任何进度，初始化第一张超级牌
  if (allProgress.length === 0) {
    console.log('🆕 初始化第一张超级牌');
    // 清理可能存在的旧解锁数据
    if (unlockedCards.length > 0) {
      console.log('🗑️ 清理旧的解锁数据:', unlockedCards);
      saveUnlockedCards([]);
    }
    const firstUnlock = getSuperCardUnlockByOrder(1);
    if (firstUnlock) {
      const progress = initializeUnlockProgress(firstUnlock.superCardId, firstUnlock.gameModeId);
      saveUnlockProgress([progress]);
      console.log('  目标:', firstUnlock.superCardId, firstUnlock.gameModeId);
      
      // 返回需要设置的玩法ID
      return { needsGameModeSet: firstUnlock.gameModeId };
    }
  } else {
    // 如果有进度，返回当前目标玩法ID
    const currentTarget = getCurrentUnlockTarget(unlockedCards);
    if (currentTarget) {
      console.log('  当前目标:', currentTarget.superCardId, currentTarget.gameModeId);
      return { needsGameModeSet: currentTarget.gameModeId };
    }
  }
  
  return {};
}
