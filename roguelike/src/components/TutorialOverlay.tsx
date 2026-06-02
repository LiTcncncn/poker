import React, { useEffect, useState } from 'react';
import { HOME_TUTORIAL_LINES } from '../tutorial/tutorialConfig';
import { getRunTutorialLines, HomeTutorialStep, RunTutorialStep } from '../store/tutorialStore';

/** 每字间隔（ms）——数值越大越慢 */
const CHAR_MS = 60;

function renderGoldWord(text: string): React.ReactNode {
  // 需求：欢迎语中「野人牌」三字为金色
  const target = '野人牌';
  const parts = text.split(target);
  if (parts.length === 1) return text;
  const out: React.ReactNode[] = [];
  parts.forEach((p, idx) => {
    if (p) out.push(p);
    if (idx < parts.length - 1) {
      out.push(
        <span key={`gold-${idx}`} className="text-rl-gold">
          {target}
        </span>
      );
    }
  });
  return out;
}

interface Props {
  homeStep?: HomeTutorialStep;
  runStep?: RunTutorialStep | null;
  lineIndex?: number;
  diamondReward?: number;
  onTap: () => void;
  /**
   * 是否显示指向目标控件的手势箭头。
   * 传入目标元素的 ref，箭头会定位在该元素正上方。
   */
  gestureTargetRef?: React.RefObject<HTMLElement>;
  /** 目标元素变化时用于触发重新测量 */
  gestureRecalcKey?: string | number;
  placement?: 'center' | 'bottom' | 'skillPanel';
  /** 是否显示全屏半透遮罩（hold 选牌阶段应为 false，保证“全亮”） */
  dimBackground?: boolean;
  /** 不挡下层点击（用于过关提示等“仅展示”浮层） */
  passThrough?: boolean;
}

export function TutorialOverlay({
  homeStep = null,
  runStep = null,
  lineIndex = 0,
  diamondReward = 0,
  onTap,
  gestureTargetRef,
  gestureRecalcKey,
  placement = 'center',
  dimBackground = true,
  passThrough = false,
}: Props) {
  const isHomeChallengeLock = homeStep === 'challenge';
  const lines = (() => {
    if (homeStep === 'welcome_1') return HOME_TUTORIAL_LINES.welcome_1;
    // 主界面：第二段文案与“挑战”高亮同一步展示
    if (homeStep === 'challenge') return HOME_TUTORIAL_LINES.welcome_2;
    if (runStep) {
      const { lines: all } = getRunTutorialLines(runStep, 0, diamondReward);
      return all;
    }
    return [];
  })();

  const fullText = lines[lineIndex] ?? lines[lines.length - 1] ?? '';
  const [shown, setShown] = useState('');
  // 手势位置
  const [gesturePos, setGesturePos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setShown('');
    if (!fullText) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(id);
    }, CHAR_MS);
    return () => clearInterval(id);
  }, [fullText]);

  // 计算目标控件位置，放箭头在其正上方
  useEffect(() => {
    if (!gestureTargetRef?.current) {
      setGesturePos(null);
      return;
    }
    const measure = () => {
      const el = gestureTargetRef!.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setGesturePos({
        top: rect.top - 52,          // 箭头图标约 40px 高，再留 12px 间距
        left: rect.left + rect.width / 2,
      });
    };
    // 目标元素切换时，下一帧再测量，避免 ref 刚更新但 DOM 还未排版完成
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [gestureTargetRef, gestureRecalcKey]);

  const typingDone = shown.length >= fullText.length && fullText.length > 0;
  const showTapCta = !isHomeChallengeLock;
  const showPanel = fullText.trim().length > 0;

  if (!homeStep && !runStep) return null;

  const panelCls = (() => {
    if (placement === 'skillPanel') {
      return 'absolute inset-x-2 top-2 z-[200] rounded-xl border border-white/10 bg-black/80 px-4 py-3 shadow-lg';
    }
    if (placement === 'bottom') {
      return 'fixed inset-x-0 bottom-0 z-[200] mx-auto max-w-[390px] rounded-t-2xl border-t border-white/10 bg-black/85 px-5 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]';
    }
    // center：面板样式（外层用 flex 做垂直居中，避免 fixed+translate 在部分手机浏览器偏移）
    return 'w-full max-w-[390px] rounded-2xl border border-white/10 bg-black/85 px-5 py-6 shadow-2xl';
  })();

  return (
    <>
      {/* 全屏遮罩，点击推进 */}
      {dimBackground && (
        <div
          className="fixed inset-0 z-[150] bg-black/60"
          aria-hidden
          onClick={showTapCta ? onTap : undefined}
        />
      )}

      {/* 文案面板（无文案时仅保留遮罩 + 手势） */}
      {showPanel && (
        placement === 'center' ? (
          <div className={`${passThrough ? 'pointer-events-none' : 'pointer-events-none'} fixed inset-0 z-[200] flex items-center justify-center px-2`}>
            <div
              role="dialog"
              className={`${panelCls} relative`}
              style={{ pointerEvents: passThrough ? 'none' : 'auto' }}
              onClick={(e) => {
                e.stopPropagation();
                if (showTapCta) onTap();
              }}
            >
              {/* 固定高度：约 3 行文案高度，避免字数变化导致面板忽高忽低 */}
              <div className="h-[5.6rem] overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
                <p className="whitespace-pre-line text-white text-xl font-bold leading-relaxed tracking-wide">
                  {renderGoldWord(shown)}
                  {!typingDone && <span className="animate-pulse opacity-80">▍</span>}
                </p>
              </div>
              {showTapCta && (
                <div className="absolute bottom-3 right-4 text-xs font-bold text-white/85">
                  点击继续
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            role="dialog"
            className={`${panelCls} relative`}
            onClick={(e) => {
              e.stopPropagation();
              if (showTapCta) onTap();
            }}
          >
            {/* 固定高度：约 3 行文案高度，避免字数变化导致面板忽高忽低 */}
            <div className="h-[5.6rem] overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
              <p className="whitespace-pre-line text-white text-xl font-bold leading-relaxed tracking-wide">
                {renderGoldWord(shown)}
                {!typingDone && <span className="animate-pulse opacity-80">▍</span>}
              </p>
            </div>
            {showTapCta && (
              <div className="absolute bottom-3 right-4 text-xs font-bold text-white/85">
                点击继续
              </div>
            )}
          </div>
        )
      )}

      {/* 手势箭头：定位在目标按钮正上方 */}
      {gesturePos && (
        <div
          className="pointer-events-none fixed z-[210] -translate-x-1/2 text-3xl animate-bounce"
          style={{ top: gesturePos.top, left: gesturePos.left }}
          aria-hidden
        >
          👇
        </div>
      )}
    </>
  );
}

/** 引导高亮环 */
export function tutorialHighlightClass(active: boolean): string {
  return active
    ? 'relative z-[170] rl-tutorial-focus'
    : '';
}
