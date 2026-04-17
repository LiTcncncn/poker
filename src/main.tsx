import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initializeUnlockSystem } from './utils/superCardUnlockManager'
import { validateAllGameModes } from './utils/gameModeLoader'
import { useGameStore } from './store/gameStore'

// 验证玩法配置
const validation = validateAllGameModes();
if (!validation.valid) {
  console.error('⚠️ 玩法配置验证失败:', validation.errors);
} else {
  console.log('✅ 玩法配置验证通过');
}

// 初始化超级牌解锁系统
const initResult = initializeUnlockSystem();
console.log('✅ 超级牌解锁系统已初始化');

// 设置当前玩法
if (initResult.needsGameModeSet) {
  useGameStore.getState().setGameMode(initResult.needsGameModeSet);
  console.log('✅ 已自动设置当前玩法:', initResult.needsGameModeSet);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

