import React from 'react';
import { useRLStore } from '../store/roguelikeStore';
import { getSkillsByIds } from '../engine/skillEngine';
import SkillPanel from './SkillPanel';
import { getUnlockedOrdersAfterNormalRun, SKILL_UNLOCK_ORDER_MAP } from '../config/skillUnlockOrders';

interface Props {
  open: boolean;
  onContinueEndless: () => void;
  onReturnToMenu: () => void;
}

/**
 * 主线胜利后弹出的选择弹层：
 * - 继续无尽：进入当前局规则下的无尽挑战
 * - 结算返回：退出当前局，回到主界面
 */
export function EndlessChoiceModal({ open, onContinueEndless, onReturnToMenu }: Props) {
  const { run } = useRLStore();
  if (!open) return null;

  const runNo = run?.runNo ?? 0;
  const difficulty = run?.difficulty ?? 'normal';
  const isHard = difficulty === 'hard';

  const stageCount = run?.runStageCount ?? 20;
  const newlyUnlockedOrders =
    run && difficulty === 'normal'
      ? getUnlockedOrdersAfterNormalRun(runNo).filter(
          order => !getUnlockedOrdersAfterNormalRun(Math.max(0, runNo - 1)).includes(order),
        )
      : [];
  const newlyUnlockedSkillIds = Array.from(new Set(
    newlyUnlockedOrders.flatMap(order => SKILL_UNLOCK_ORDER_MAP[order] ?? []),
  ));
  const unlockedSkills = getSkillsByIds(newlyUnlockedSkillIds);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className={`flex max-h-[92dvh] w-full max-w-[390px] flex-col gap-5 overflow-y-auto rounded-t-3xl px-6 pb-10 pt-6 shadow-2xl [-webkit-overflow-scrolling:touch] ${
        isHard ? 'bg-[#1a0808] border-t border-red-900/60' : 'bg-[#0d2040] border-t border-yellow-500/20'
      }`}>
        {/* 胜利提示 */}
        <div className="text-center">
          <div className={`text-3xl font-black mb-1 ${isHard ? 'text-red-300' : 'text-yellow-400'}`}>
            {isHard ? '困难通关！' : '通关！'}
          </div>
          {runNo > 0 && (
            <div className="text-gray-300 text-sm">
              第 {runNo} 局 · {difficulty === 'hard' ? '困难' : '普通'} · {stageCount} 关全通关
            </div>
          )}
        </div>

        {/* 奖励说明 */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-300 text-center">
          ✦ 通关奖励已记录，技能解锁已更新
        </div>

        {/* 解锁技能牌展示：只展示新增解锁技能本体，不带本局边框 */}
        {run && unlockedSkills.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="text-xs font-bold text-gray-300">解锁的技能牌</div>
            <div className="flex h-48 w-full min-w-0 items-center overflow-visible">
              <SkillPanel
                skills={unlockedSkills}
                acquiredSkillIds={newlyUnlockedSkillIds}
                skillEnhancements={{}}
              />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onContinueEndless}
            className={`w-full font-black text-base py-3.5 rounded-2xl transition-all shadow-lg ${
              isHard
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-rl-gold hover:bg-yellow-300 text-black'
            }`}
          >
            继续无尽挑战
          </button>
          <button
            onClick={onReturnToMenu}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-bold text-sm py-3 rounded-2xl transition-colors"
          >
            结算返回主界面
          </button>
        </div>
      </div>
    </div>
  );
}
