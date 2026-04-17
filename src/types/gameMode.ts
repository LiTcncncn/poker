/**
 * 玩法组合系统类型定义
 */

// 额外规则类型
export type ExtraRuleType = 
  | 'n_card_straight'      // n张成顺
  | 'n_card_flush'         // n张成花
  | 'color_flush'          // 花色限制同花
  | 'allow_straight_flush' // 允许同花顺
  | 'odd_straight'         // 单数成顺
  | 'even_straight'        // 双数成顺
  | 'multiplier_bonus';    // 特定牌型赔率加成

// 任务类型
export type TaskType = 
  | 'high_card'          // 高牌
  | 'one_pair'           // 一对
  | 'two_pairs'          // 两对
  | 'three_of_a_kind'    // 三条
  | 'straight'           // 顺子
  | 'odd_straight'       // 单数顺子
  | 'even_straight'      // 双数顺子
  | 'flush'              // 同花
  | 'full_house'         // 葫芦
  | 'four_of_a_kind'     // 四条
  | 'five_of_a_kind'     // 5条
  | 'straight_flush'     // 同花顺
  | 'royal_flush';       // 皇家同花顺

// 额外规则接口
export interface ExtraRule {
  type: ExtraRuleType;
  value?: number;                    // n的值（如3、4），或赔率加成倍数
  color?: 'red' | 'black';          // 花色限制
  handType?: TaskType;              // 赔率加成的牌型
}

// 任务配置接口
export interface TaskConfig {
  type: TaskType;                   // 任务类型
  target: number;                   // 目标次数
}

// 玩法配置接口
export interface GameModeConfig {
  id: string;                       // 玩法唯一标识
  name: string;                     // 玩法名称
  cardCount: 3 | 4 | 5 | 6;        // 张数（由策划配置）
  cardPool: 'basic' | 'all';       // 牌池类型：basic=基础牌池（白色+超级牌），all=全部牌池
  jokerProbability: 0 | 0.04 | 0.08; // Joker概率：0=无，0.04=默认4%，0.08=joker++（8%）
  extraRules: ExtraRule[];          // 额外规则列表（由策划配置）
  enabled: boolean;                 // 是否启用
  unlockCondition?: string;         // 解锁条件（由策划配置，待补充具体实现）
  isSuperCardUnlock?: boolean;      // 是否为超级牌解锁玩法
  superCardId?: string;             // 如果是超级牌解锁玩法，对应的超级牌ID
  // 注意：任务配置已移至 superCardUnlocks.json，通过 gameModeId 关联
}

// 超级牌解锁配置接口
export interface SuperCardUnlockConfig {
  superCardId: string;              // 超级牌ID（如 'spades_2'），按顺序从♠️2到♦️A
  gameModeId: string;               // 对应的玩法ID
  unlockOrder: number;              // 解锁顺序（1-52，对应♠️2到♦️A）
  unlockConditions: {
    task: TaskConfig;               // 任务要求（任务难度由策划人员配置）
    cost: number;                   // 解锁所需的$数量（一次性支付）
    // 规则要求由玩法配置中的 extraRules 定义
  };
  nextSuperCardId?: string;         // 下一个要解锁的超级牌ID（按顺序）
}

// 解锁进度接口
export interface UnlockProgress {
  superCardId: string;              // 超级牌ID
  gameModeId: string;               // 对应的玩法ID
  taskProgress: {
    current: number;                // 当前任务进度
    target: number;                 // 目标任务次数
    completed: boolean;             // 任务是否完成
  };
  costPaid: boolean;                // $是否已支付
  unlocked: boolean;                // 是否已解锁
}

// 当前玩法状态接口
export interface CurrentGameMode {
  config: GameModeConfig;           // 当前玩法配置
  taskProgress: number;             // 当前任务进度
}
