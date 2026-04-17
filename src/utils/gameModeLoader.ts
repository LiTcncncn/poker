/**
 * 玩法配置加载器和验证器
 */

import { GameModeConfig, SuperCardUnlockConfig, UnlockProgress } from '../types/gameMode';
import gameModes from '../config/gameModes.json';
import superCardUnlocks from '../config/superCardUnlocks.json';

/** 玩法标题 UI：去掉花色后的 U+FE0F，用文本字形呈现，避免 Emoji 自带红/黑色，与标题字色一致 */
export function normalizeGameModeDisplayTitle(name: string): string {
  return name
    .replace(/\u2660\ufe0f/g, '\u2660')
    .replace(/\u2665\ufe0f/g, '\u2665')
    .replace(/\u2663\ufe0f/g, '\u2663')
    .replace(/\u2666\ufe0f/g, '\u2666');
}

// 加载所有玩法配置
export function loadGameModes(): GameModeConfig[] {
  return gameModes as GameModeConfig[];
}

// 加载所有超级牌解锁配置
export function loadSuperCardUnlocks(): SuperCardUnlockConfig[] {
  const unlocks = superCardUnlocks as SuperCardUnlockConfig[];
  // 确保按 unlockOrder 排序（不要原地 sort，避免污染 import 的只读数据）
  return [...unlocks].sort((a, b) => a.unlockOrder - b.unlockOrder);
}

// 根据ID获取玩法配置
export function getGameModeById(id: string): GameModeConfig | undefined {
  return loadGameModes().find(mode => mode.id === id);
}

// 根据超级牌ID获取解锁配置
export function getSuperCardUnlockById(superCardId: string): SuperCardUnlockConfig | undefined {
  return loadSuperCardUnlocks().find(unlock => unlock.superCardId === superCardId);
}

// 根据解锁顺序获取超级牌配置
export function getSuperCardUnlockByOrder(order: number): SuperCardUnlockConfig | undefined {
  return loadSuperCardUnlocks().find(unlock => unlock.unlockOrder === order);
}

// 根据玩法ID获取超级牌解锁配置
export function getSuperCardUnlockByGameModeId(gameModeId: string): SuperCardUnlockConfig | undefined {
  return loadSuperCardUnlocks().find(unlock => unlock.gameModeId === gameModeId);
}

// 获取当前应该解锁的超级牌（基于已解锁的牌）
export function getCurrentUnlockTarget(unlockedCards: string[]): SuperCardUnlockConfig | undefined {
  const unlocks = loadSuperCardUnlocks();
  
  // 找到第一个未解锁的超级牌
  for (const unlock of unlocks) {
    if (!unlockedCards.includes(unlock.superCardId)) {
      return unlock;
    }
  }
  
  // 所有超级牌都已解锁
  return undefined;
}

// 验证玩法配置的合理性
export function validateGameMode(config: GameModeConfig): string[] {
  const errors: string[] = [];
  
  // 验证张数与规则的兼容性
  if (config.cardCount === 3 || config.cardCount === 4) {
    // 3张和4张不能有同花顺规则
    const hasAllowStraightFlush = config.extraRules.some(rule => rule.type === 'allow_straight_flush');
    if (hasAllowStraightFlush) {
      errors.push(`${config.name}: 3张和4张玩法不能包含同花顺规则`);
    }
  }
  
  // 如果是超级牌解锁玩法，从 superCardUnlocks.json 获取任务信息进行验证
  if (config.isSuperCardUnlock) {
    const unlockConfig = getSuperCardUnlockByGameModeId(config.id);
    if (!unlockConfig) {
      errors.push(`${config.name}: 未找到对应的解锁配置`);
      return errors;
    }
    
    const taskType = unlockConfig.unlockConditions.task.type;
    
    // 验证任务与张数的兼容性
    if (config.cardCount === 3) {
      // 3张只能完成高牌、一对、三条、顺子、同花任务
      const invalidTasks = ['two_pairs', 'four_of_a_kind', 'five_of_a_kind', 'straight_flush', 'royal_flush', 'full_house'];
      if (invalidTasks.includes(taskType)) {
        errors.push(`${config.name}: 3张玩法不能完成${taskType}任务`);
      }
    }
    
    if (config.cardCount === 4) {
      // 4张不能完成同花顺和皇家同花顺任务
      const invalidTasks = ['straight_flush', 'royal_flush'];
      if (invalidTasks.includes(taskType)) {
        errors.push(`${config.name}: 4张玩法不能完成${taskType}任务`);
      }
    }
    
    // 验证花色限制与任务兼容性
    const hasColorFlush = config.extraRules.some(rule => rule.type === 'color_flush');
    if (hasColorFlush && taskType !== 'flush') {
      errors.push(`${config.name}: 花色限制规则只能用于同花任务`);
    }
  }
  
  return errors;
}

// 验证所有玩法配置
export function validateAllGameModes(): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];
  const modes = loadGameModes();
  
  for (const mode of modes) {
    const errors = validateGameMode(mode);
    allErrors.push(...errors);
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

// 初始化解锁进度
export function initializeUnlockProgress(superCardId: string, gameModeId: string): UnlockProgress {
  const unlock = getSuperCardUnlockById(superCardId);
  
  if (!unlock) {
    throw new Error(`未找到超级牌解锁配置: ${superCardId}`);
  }
  
  return {
    superCardId,
    gameModeId,
    taskProgress: {
      current: 0,
      target: unlock.unlockConditions.task.target,
      completed: false
    },
    costPaid: false,
    unlocked: false
  };
}

// 获取超级牌显示名称
export function getSuperCardDisplayName(superCardId: string): string {
  const parts = superCardId.split('_');
  if (parts.length !== 2) return superCardId;
  
  const [suit, rank] = parts;
  
  const suitSymbols: Record<string, string> = {
    'spades': '♠️',
    'hearts': '♥️',
    'clubs': '♣️',
    'diamonds': '♦️'
  };
  
  const rankMap: Record<string, string> = {
    'A': 'A',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    'J': 'J',
    'Q': 'Q',
    'K': 'K'
  };
  
  return `${suitSymbols[suit] || ''}${rankMap[rank] || rank}`;
}

// 获取任务类型显示名称
export function getTaskTypeDisplayName(taskType: string): string {
  const taskNames: Record<string, string> = {
    'high_card': '高牌',
    'one_pair': '一对',
    'two_pairs': '两对',
    'three_of_a_kind': '三条',
    'straight': '顺子',
    'odd_straight': '顺子', // 单数成顺玩法：只要是顺子就行，显示为"顺子"
    'even_straight': '顺子', // 双数成顺玩法：只要是顺子就行，显示为"顺子"
    'flush': '同花',
    'full_house': '葫芦',
    'four_of_a_kind': '四条',
    'five_of_a_kind': '5条',
    'straight_flush': '同花顺',
    'royal_flush': '皇家同花顺'
  };
  
  return taskNames[taskType] || taskType;
}
