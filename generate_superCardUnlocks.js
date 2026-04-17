import fs from 'fs';

// 读取gameModes.json
const gameModes = JSON.parse(fs.readFileSync('src/config/gameModes.json', 'utf8'));

// 创建映射：superCardId -> gameMode
const gameModeMap = {};
gameModes.forEach(mode => {
  if (mode.isSuperCardUnlock) {
    gameModeMap[mode.superCardId] = {
      gameModeId: mode.id,
      task: mode.task
    };
  }
});

// 解锁顺序（从♠️2开始）
const unlockOrder = [
  'spades_2', 'spades_3', 'spades_4', 'spades_5', 'spades_6', 'spades_7', 'spades_8', 'spades_9', 'spades_10', 'spades_J', 'spades_Q', 'spades_K', 'spades_A',
  'hearts_2', 'hearts_3', 'hearts_4', 'hearts_5', 'hearts_6', 'hearts_7', 'hearts_8', 'hearts_9', 'hearts_10', 'hearts_J', 'hearts_Q', 'hearts_K', 'hearts_A',
  'clubs_2', 'clubs_3', 'clubs_4', 'clubs_5', 'clubs_6', 'clubs_7', 'clubs_8', 'clubs_9', 'clubs_10', 'clubs_J', 'clubs_Q', 'clubs_K', 'clubs_A',
  'diamonds_2', 'diamonds_3', 'diamonds_4', 'diamonds_5', 'diamonds_6', 'diamonds_7', 'diamonds_8', 'diamonds_9', 'diamonds_10', 'diamonds_J', 'diamonds_Q', 'diamonds_K', 'diamonds_A'
];

// 计算价格：♠️2-A 步长+100，♥️2-A 步长+200，♣️2-A 步长+300，♦️2-A 步长+500
const stepDeltaBySuit = [100, 200, 300, 500];
let price = 300;
let increment = 200;
const prices = [price];
for (let i = 1; i < 52; i++) {
  const suitIndex = Math.floor(i / 13);
  price += increment;
  increment += stepDeltaBySuit[suitIndex];
  prices.push(price);
}

// 读取现有配置以保留 task（仅更新 cost）
let existingUnlocks = [];
try {
  existingUnlocks = JSON.parse(fs.readFileSync('src/config/superCardUnlocks.json', 'utf8'));
} catch (e) {
  // 文件不存在或无效时忽略
}

// 生成superCardUnlocks配置
const superCardUnlocks = unlockOrder.map((superCardId, index) => {
  const gameMode = gameModeMap[superCardId];
  if (!gameMode) {
    console.error('未找到超级牌配置:', superCardId);
    return null;
  }
  const existing = existingUnlocks[index] && existingUnlocks[index].superCardId === superCardId
    ? existingUnlocks[index]
    : null;
  const unlockOrderNum = index + 1;
  const cost = prices[index];
  const nextSuperCardId = index < unlockOrder.length - 1 ? unlockOrder[index + 1] : undefined;
  const task = existing && existing.unlockConditions && existing.unlockConditions.task
    ? existing.unlockConditions.task
    : gameMode.task;
  return {
    superCardId: superCardId,
    gameModeId: gameMode.gameModeId,
    unlockOrder: unlockOrderNum,
    unlockConditions: {
      task: task,
      cost: cost
    },
    ...(nextSuperCardId ? { nextSuperCardId: nextSuperCardId } : {})
  };
}).filter(item => item !== null);

// 输出到文件
fs.writeFileSync('src/config/superCardUnlocks.json', JSON.stringify(superCardUnlocks, null, 2), 'utf8');

console.log('✅ 已生成新的superCardUnlocks.json');
console.log('前5张价格：');
superCardUnlocks.slice(0, 5).forEach((item, i) => {
  console.log(`第${i+1}张 (${item.superCardId}): $${item.unlockConditions.cost.toLocaleString()}`);
});
console.log('\n最后5张价格：');
superCardUnlocks.slice(-5).forEach((item, i) => {
  console.log(`第${superCardUnlocks.length - 4 + i}张 (${item.superCardId}): $${item.unlockConditions.cost.toLocaleString()}`);
});
