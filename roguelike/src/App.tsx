import React, { Component, ReactNode, useEffect, useMemo } from 'react';
import { useRLStore } from './store/roguelikeStore';
import { useProfileStore } from './store/profileStore';
import { FrameId } from './types/profile';
import { RunEntry } from './components/RunEntry';
import { StageView } from './components/StageView';
import { SkillCardShowcase } from './components/SkillCardShowcase';
import { SkillFaceTestBoard } from './components/SkillFaceTestBoard';
import { EndlessChoiceModal } from './components/EndlessChoiceModal';
import { roguelikeLocalStorageKeysForHardReset } from './config/storageNamespace';

// ── 错误边界：防止任何运行时错误导致白屏 ──────────────────────────
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleReset = () => {
    // 清除 localStorage 存档后刷新
    try {
      roguelikeLocalStorageKeysForHardReset().forEach((k) => localStorage.removeItem(k));
    } catch (_) { /* ignore */ }
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-white text-xl font-black">游戏出现错误</h1>
          <p className="text-gray-400 text-sm max-w-xs break-all">
            {String(this.state.error)}
          </p>
          <button
            onClick={this.handleReset}
            className="bg-rl-gold text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors"
          >
            清除存档并重新开始
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 边框样式映射 ─────────────────────────────────────────────────
function getFrameStyle(frame: FrameId): React.CSSProperties {
  switch (frame) {
    case 'silver':
      return { boxShadow: 'inset 0 0 0 2px rgba(200,200,210,0.55), 0 0 18px rgba(180,180,190,0.15)' };
    case 'gold':
      return { boxShadow: 'inset 0 0 0 2px rgba(250,204,21,0.75), 0 0 22px rgba(250,204,21,0.18)' };
    case 'rainbow':
      return { boxShadow: 'inset 0 0 0 2px transparent', outline: '2px solid transparent', backgroundImage: 'none', border: '2px solid transparent', backgroundClip: 'padding-box', filter: 'drop-shadow(0 0 6px #f472b6) drop-shadow(0 0 6px #60a5fa) drop-shadow(0 0 6px #34d399)' };
    case 'black':
      return { boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.9), inset 0 0 0 4px rgba(50,50,60,0.6)' };
    default:
      return {};
  }
}

// ── 主应用 ──────────────────────────────────────────────────────
function AppInner() {
  const showSkillPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('skillPreview') === '1';

  const showSkillFaceTest =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('skillFaceTest') === '1';

  const { run, handState, reward, dealInitialHand, enterEndlessMode, abandonRun } = useRLStore();
  const { profile, recordNormalClear, recordHardClear } = useProfileStore();

  const frameStyle = useMemo(() => getFrameStyle(profile.activeFrame), [profile.activeFrame]);

  const hasActiveRun =
    run !== null &&
    (run.status === 'running' || run.status === 'victory' || run.status === 'defeat');

  // 主线通关时记录 profile（仅在 victory 时触发一次）
  useEffect(() => {
    if (!run || run.status !== 'victory' || run.isEndless) return;
    const { runNo, difficulty } = run;
    if (runNo > 0) {
      if (difficulty === 'normal') recordNormalClear(runNo);
      else if (difficulty === 'hard') recordHardClear(runNo);
    }
  }, [run?.status, run?.runNo, run?.difficulty, run?.isEndless, recordNormalClear, recordHardClear]);

  // 恢复兜底：run 存在但 handState 丢失时自动补发
  // 有 reward 待处理（如开局三选一）时不自动发牌
  useEffect(() => {
    if (showSkillPreview || showSkillFaceTest) return;
    const endlessStageMissing =
      run?.status === 'running' &&
      run.isEndless &&
      !run.stages[run.currentStageIndex];
    if (run?.status === 'running' && ((!handState && !reward) || endlessStageMissing)) {
      dealInitialHand();
    }
  }, [showSkillPreview, showSkillFaceTest, run, handState, reward, dealInitialHand]);

  // 胜利弹层：仅在主线通关（非无尽）时显示
  const showVictoryModal = run?.status === 'victory' && !run.isEndless;

  const content = !hasActiveRun
    ? <RunEntry />
    : !handState && run?.status !== 'victory'
      ? (
        <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
          正在恢复游戏…
        </div>
      )
      : <StageView />;

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col bg-[#0a192e] text-slate-100">
      {/* 上层：漂移光晕（与 VPoker 一致） */}
      <div className="main-scene-bg-halo" aria-hidden>
        <div className="main-scene-bg-halo__layer" />
      </div>

      {/* 固定手机画布宽度：Mac 宽屏也与真机同一列逻辑宽，避免 vw / 视口差导致布局走样 */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[390px] flex-1 flex-col overflow-x-hidden" style={frameStyle}>
        {showSkillPreview ? (
          <SkillCardShowcase />
        ) : showSkillFaceTest ? (
          <SkillFaceTestBoard />
        ) : (
          content
        )}
      </div>

      {/* 胜利后弹层：继续无尽 / 结算返回 */}
      <EndlessChoiceModal
        open={showVictoryModal}
        onContinueEndless={() => enterEndlessMode()}
        onReturnToMenu={() => abandonRun()}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
