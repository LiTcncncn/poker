import React, { Component, ReactNode, useEffect } from 'react';
import { useRLStore } from './store/roguelikeStore';
import { RunEntry } from './components/RunEntry';
import { StageView } from './components/StageView';

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
      ['poker-roguelike-storage-v7', 'poker-roguelike-storage-v6',
       'poker-roguelike-storage-v5', 'poker-roguelike-storage-v4',
       'poker-roguelike-storage-v3', 'poker-roguelike-storage-v2',
       'poker-roguelike-storage'].forEach(k =>
        localStorage.removeItem(k)
      );
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

// ── 主应用 ──────────────────────────────────────────────────────
function AppInner() {
  const { run, handState, reward, startNewRun, dealInitialHand } = useRLStore();

  const hasActiveRun =
    run !== null &&
    (run.status === 'running' || run.status === 'victory' || run.status === 'defeat');

  // 恢复兜底：run 存在但 handState 丢失时自动补发
  // 有 reward 待处理（如开局三选一）时不自动发牌
  useEffect(() => {
    if (run?.status === 'running' && !handState && !reward) {
      dealInitialHand();
    }
  }, [run, handState, reward, dealInitialHand]);

  const content = !hasActiveRun
    ? <RunEntry onStart={startNewRun} />
    : !handState
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

      <div className="relative z-10 flex-1">
        {content}
      </div>
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
