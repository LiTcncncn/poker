import React, { useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useRLStore } from '../store/roguelikeStore';
import { MAINLINE_RUNS, buildRunConfig, buildFreeplayConfig } from '../config/mainlineRuns';
import { FRAME_DEFS, FrameId } from '../types/profile';
import { RushLeaderboardModal } from './RushLeaderboardModal';

// ─── 边框 dot 颜色（选择器小圆点） ────────────────────────────────
const FRAME_DOT_CLASS: Record<string, string> = {
  default: 'bg-gray-600 border-gray-500',
  silver:  'bg-gradient-to-br from-gray-200 to-gray-400 border-gray-300',
  gold:    'bg-gradient-to-br from-yellow-300 to-yellow-500 border-yellow-400',
  rainbow: 'bg-gradient-to-br from-pink-400 via-yellow-300 to-cyan-400 border-white/40',
  black:   'bg-gray-900 border-gray-600',
};

// ─── 限制条件 Chip ─────────────────────────────────────────────
function RuleChip({ label, variant = 'debuff' }: { label: string; variant?: 'debuff' | 'buff' | 'special' }) {
  const colorMap = {
    debuff: 'bg-red-900/60 text-red-200 border border-red-700/50',
    buff: 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/50',
    special: 'bg-purple-900/60 text-purple-200 border border-purple-700/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[variant]}`}>
      {label}
    </span>
  );
}

// ─── 通关状态印记 ──────────────────────────────────────────────
function ClearBadge({ cleared, label }: { cleared: boolean; label: string }) {
  if (!cleared) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
      ✓ {label}
    </span>
  );
}

// ─── 奖励弹窗 ──────────────────────────────────────────────────
function RewardModal({ open, onClose, rewardText, isHard }: {
  open: boolean;
  onClose: () => void;
  rewardText: string;
  isHard: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[390px] rounded-t-3xl pt-5 pb-10 px-6 flex flex-col gap-4 shadow-2xl ${
          isHard ? 'bg-[#1a0808] border-t border-red-900/60' : 'bg-[#0d2040] border-t border-yellow-500/20'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${isHard ? 'text-red-300' : 'text-yellow-400'}`}>
            普通胜利奖励
          </span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-xl leading-none px-1"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <p className="text-gray-200 text-sm leading-relaxed">{rewardText}</p>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────
export function RunEntry() {
  const { profile, isNormalCleared, isHardCleared, isNormalChallengeableRun, isHardUnlocked, getUnlockedFrames, setActiveFrame } = useProfileStore();

  // 默认显示最后一个可挑战普通局（而非固定第 1 局）
  const [currentRunNo, setCurrentRunNo] = useState(() => Math.max(1, profile.highestNormalRunCleared + 1));
  const [difficulty, setDifficulty] = useState<'normal' | 'hard'>('normal');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const { startNewRun } = useRLStore();

  const unlockedFrames = getUnlockedFrames();
  const showFramePicker = unlockedFrames.length > 1; // 有解锁才显示

  const runDef = MAINLINE_RUNS.find(r => r.runNo === currentRunNo);
  const isNormalClear = isNormalCleared(currentRunNo);
  const isHardClear = isHardCleared(currentRunNo);
  const canChallenge = difficulty === 'normal'
    ? isNormalChallengeableRun(currentRunNo)
    : isHardUnlocked(currentRunNo);

  const config = runDef ? buildRunConfig(currentRunNo, difficulty, profile.highestNormalRunCleared) : null;
  const displayTags = difficulty === 'normal' ? (runDef?.displayTags ?? []) : (runDef?.hardDisplayTags ?? []);

  const highestUnlocked = Math.max(1, profile.highestNormalRunCleared + 1);
  // 显示真实局名的上限：可挑战局 + 1（额外展示下一局名）
  const titleVisibleUpTo = Math.min(50, highestUnlocked + 1);
  // 最多再往后翻 1 个"？？？"局，之后隐藏 > 按钮
  const maxNavigable = Math.min(50, titleVisibleUpTo + 1);
  const isMystery = currentRunNo > titleVisibleUpTo;
  const displayTitle = isMystery ? '？？？' : (runDef?.title ?? `第 ${currentRunNo} 局`);

  const goPrev = () => setCurrentRunNo(n => Math.max(1, n - 1));
  const goNext = () => setCurrentRunNo(n => Math.min(maxNavigable, n + 1));

  const handleChallenge = () => {
    if (!config || !canChallenge) return;
    startNewRun(config);
  };

  const handleFreeplay = () => {
    startNewRun(buildFreeplayConfig());
  };

  // 困难模式配色方案
  const isHard = difficulty === 'hard';

  return (
    <div className={`flex flex-col min-h-screen ${isHard ? 'bg-[#1a0a0a]' : 'bg-transparent'}`}>

      <div className="flex flex-col flex-1 items-center px-5 pt-4 pb-8 gap-6">

        {/* ── 普通/困难紧凑切换器 ────────────────────────────── */}
        <div className="flex rounded-full bg-white/8 border border-white/10 p-0.5 gap-0.5">
          <button
            onClick={() => setDifficulty('normal')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              difficulty === 'normal'
                ? 'bg-yellow-400 text-black shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            普通
          </button>
          <button
            onClick={() => setDifficulty('hard')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              difficulty === 'hard'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            困难
          </button>
        </div>

        {/* ── 固定高度中央区（锁定垂直位置，内容多少高度不变） ── */}
        <div className="flex flex-col items-center justify-center gap-5 w-full" style={{ height: '260px', flexShrink: 0, paddingTop: '120px' }}>

          {/* 游戏标题 */}
          <h1 className={`text-center font-black leading-snug text-2xl ${isHard ? 'text-red-400' : 'text-yellow-400'}`}>
            难上加难的野人牌
          </h1>

          {/* 局号 + 左右箭头 */}
          <div className="flex items-center gap-3 w-full justify-center">
            <button
              onClick={goPrev}
              disabled={currentRunNo <= 1}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-2xl text-gray-300 flex-shrink-0"
              aria-label="上一局"
            >
              ‹
            </button>

            <div className="flex flex-col items-center gap-2 flex-1 text-center">
              <div className="relative flex items-center justify-center select-none" style={{ lineHeight: 1 }}>
                <span aria-hidden className="absolute font-black text-6xl pointer-events-none"
                  style={{ color: '#69C9D0', transform: 'translate(-3px, -2px)', mixBlendMode: 'screen', opacity: 0.5 }}>
                  {displayTitle}
                </span>
                <span aria-hidden className="absolute font-black text-6xl pointer-events-none"
                  style={{ color: '#EE1D52', transform: 'translate(5px, 3px)', mixBlendMode: 'screen' }}>
                  {displayTitle}
                </span>
                <span className="relative font-black text-6xl" style={{ color: isHard ? '#fca5a5' : '#ffffff' }}>
                  {displayTitle}
                </span>
              </div>
              {/* 固定高度副行：仅显示解锁提示，已通关不展示徽章 */}
              <div className="h-5 flex items-center justify-center">
                {currentRunNo > highestUnlocked && (
                  <span className="text-xs text-gray-500">通关第 {currentRunNo - 1} 局普通后解锁</span>
                )}
              </div>
            </div>

            {currentRunNo < maxNavigable && (
              <button
                onClick={goNext}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-2xl text-gray-300 flex-shrink-0"
                aria-label="下一局"
              >
                ›
              </button>
            )}
            {currentRunNo >= maxNavigable && <div className="w-10 flex-shrink-0" />}
          </div>

          {/* chips 固定占位区，无内容时空白等高 */}
          <div className="h-6 flex flex-wrap gap-1.5 justify-center w-full items-center">
            {canChallenge && displayTags.map((tag, i) => {
              const isBuff = tag.includes('+') && !tag.includes('目标');
              const isSpecial = tag.includes('♥') || tag.includes('♠') || tag.includes('♦') || tag.includes('♣') || tag.includes('牌堆') || tag.includes('关');
              return <RuleChip key={i} label={tag} variant={isSpecial ? 'special' : isBuff ? 'buff' : 'debuff'} />;
            })}
          </div>

        </div>

        <div className="flex-1" />

        {/* ── 边框选择器 ────────────────────────────────────── */}
        {showFramePicker && (
          <div className="flex items-center gap-2">
            {FRAME_DEFS.filter(f => unlockedFrames.includes(f.id)).map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFrame(f.id as FrameId)}
                title={f.label}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  profile.activeFrame === f.id
                    ? 'scale-110 ring-2 ring-white/40 ring-offset-1 ring-offset-transparent'
                    : 'opacity-60 hover:opacity-100'
                } ${FRAME_DOT_CLASS[f.id]}`}
              />
            ))}
            <span className="text-xs text-gray-500 ml-1">
              {FRAME_DEFS.find(f => f.id === profile.activeFrame)?.label ?? ''}边框
            </span>
          </div>
        )}

        {/* ── 主按钮区 ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3 w-full">
          {canChallenge ? (
            <>
              <button
                onClick={handleChallenge}
                className={`w-full font-black text-lg py-3.5 rounded-2xl transition-all shadow-lg ${
                  isHard
                    ? 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/40'
                    : 'bg-rl-gold hover:bg-yellow-300 text-black shadow-yellow-900/30'
                }`}
              >
                {(isHard ? isHardClear : isNormalClear) ? '再次挑战' : (isHard ? '困难挑战' : '挑战')}
              </button>

              <button
                onClick={handleFreeplay}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-bold text-sm py-3 rounded-2xl transition-colors"
              >
                无限挑战（全技能自由模式）
              </button>

              <button
                onClick={() => setLeaderboardOpen(true)}
                className="w-full text-gray-500 hover:text-gray-300 text-xs py-2 transition-colors"
              >
                冲关排行
              </button>
            </>
          ) : (
            <div className="w-full text-center py-3.5 text-gray-500 text-sm font-medium">
              {difficulty === 'hard'
                ? `先通关第 ${currentRunNo} 局普通才能挑战困难`
                : `先通关第 ${currentRunNo - 1} 局才能解锁`}
            </div>
          )}
        </div>
      </div>

      <RushLeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />

      <RewardModal
        open={rewardModalOpen}
        onClose={() => setRewardModalOpen(false)}
        rewardText={runDef?.rewardText ?? ''}
        isHard={isHard}
      />
    </div>
  );
}
