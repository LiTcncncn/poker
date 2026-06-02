import React, { useRef, useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useRLStore } from '../store/roguelikeStore';
import { useTutorialStore } from '../store/tutorialStore';
import { MAINLINE_RUNS, buildRunConfig, buildFreeplayConfig } from '../config/mainlineRuns';
import { RushLeaderboardModal } from './RushLeaderboardModal';
import { TutorialOverlay, tutorialHighlightClass } from './TutorialOverlay';
import { HOME_TUTORIAL_LINES } from '../tutorial/tutorialConfig';
import { clearRoguelikeSave } from '../utils/clearRoguelikeSave';

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

const RUN_TITLE_BOX_WIDTH_REM = 15;
const RUN_TITLE_FONT_NORMAL = 'text-6xl';
const RUN_TITLE_FONT_COMPACT = 'text-5xl';

function runTitleFontClass(title: string): string {
  const charCount = [...title].length;
  if (charCount <= 4) return RUN_TITLE_FONT_NORMAL;
  if (charCount === 5) return RUN_TITLE_FONT_COMPACT;
  return 'text-4xl';
}

export function RunEntry() {
  const {
    profile,
    isNormalCleared,
    isHardCleared,
    isNormalChallengeableRun,
    isHardUnlocked,
    isEndlessAndLeaderboardUnlocked,
  } = useProfileStore();

  const inHomeTutorial = !profile.tutorialCompleted;
  const showEndlessRow = isEndlessAndLeaderboardUnlocked();

  const [currentRunNo, setCurrentRunNo] = useState(() =>
    inHomeTutorial ? 1 : Math.max(1, profile.highestNormalRunCleared + 1),
  );
  const [difficulty, setDifficulty] = useState<'normal' | 'hard'>('normal');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const { startNewRun } = useRLStore();
  // 引导：挑战按钮 ref，供手势箭头定位
  const challengeBtnRef = useRef<HTMLButtonElement>(null);

  const homeStep = useTutorialStore((s) => s.homeStep);
  const lineIndex = useTutorialStore((s) => s.lineIndex);
  const advanceHomeStep = useTutorialStore((s) => s.advanceHomeStep);
  const skipHomeLines = useTutorialStore((s) => s.skipHomeLines);

  const effectiveRunNo = inHomeTutorial ? 1 : currentRunNo;
  const runDef = MAINLINE_RUNS.find((r) => r.runNo === effectiveRunNo);
  const isNormalClear = isNormalCleared(effectiveRunNo);
  const isHardClear = isHardCleared(effectiveRunNo);
  const canChallenge = difficulty === 'normal'
    ? isNormalChallengeableRun(effectiveRunNo)
    : isHardUnlocked(effectiveRunNo);

  const config = runDef ? buildRunConfig(effectiveRunNo, difficulty, profile.highestNormalRunCleared) : null;
  const displayTags =
    difficulty === 'normal'
      ? (runDef?.displayTags ?? [])
      : [...(runDef?.displayTags ?? []), ...(runDef?.hardDisplayTags ?? [])];

  const highestUnlocked = Math.max(1, profile.highestNormalRunCleared + 1);
  const titleVisibleUpTo = Math.min(50, highestUnlocked + 1);
  const maxNavigable = Math.min(50, titleVisibleUpTo + 1);
  const isMystery = !inHomeTutorial && effectiveRunNo > titleVisibleUpTo;
  const displayTitle = isMystery ? '？？？' : (runDef?.title ?? `第 ${effectiveRunNo} 局`);
  const titleFontClass = runTitleFontClass(displayTitle);

  const goPrev = () => {
    if (inHomeTutorial) return;
    setCurrentRunNo((n) => Math.max(1, n - 1));
  };
  const goNext = () => {
    if (inHomeTutorial) return;
    setCurrentRunNo((n) => Math.min(maxNavigable, n + 1));
  };

  const handleChallenge = () => {
    if (!config || !canChallenge) return;
    if (inHomeTutorial && homeStep !== 'challenge') return;
    if (inHomeTutorial) {
      useTutorialStore.setState({ homeStep: null, lineIndex: 0 });
    }
    startNewRun(config);
  };

  const handleFreeplay = () => {
    startNewRun(buildFreeplayConfig());
  };

  const handleHomeTutorialTap = () => {
    if (homeStep === 'welcome_1') {
      advanceHomeStep(); // welcome_1 → challenge（文案2 + 按钮高亮同步出现）
      return;
    }
    // challenge 步骤不允许点遮罩推进：必须点“挑战”按钮
  };

  const isHard = difficulty === 'hard';

  return (
    <div className={`relative flex flex-col min-h-screen ${isHard ? 'bg-[#1a0a0a]' : 'bg-transparent'}`}>

      {inHomeTutorial && homeStep != null && (
        <TutorialOverlay
          homeStep={homeStep}
          lineIndex={lineIndex}
          onTap={handleHomeTutorialTap}
          gestureTargetRef={homeStep === 'challenge' ? challengeBtnRef : undefined}
          placement="center"
        />
      )}

      <div className="flex flex-col flex-1 items-center px-5 pt-4 pb-8 gap-6">

        {!inHomeTutorial && (
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
        )}

        <div className="flex flex-col items-center justify-center gap-5 w-full" style={{ height: '260px', flexShrink: 0, paddingTop: '120px' }}>
          <h1 className={`text-center font-black leading-snug text-2xl ${isHard ? 'text-red-400' : 'text-yellow-400'}`}>
            难上加难的野人牌
          </h1>

          <div className="flex items-center gap-3 w-full justify-center">
            <button
              onClick={goPrev}
              disabled={inHomeTutorial || effectiveRunNo <= 1}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-2xl text-gray-300 flex-shrink-0"
              aria-label="上一局"
            >
              ‹
            </button>

            <div className="flex flex-col items-center gap-2 flex-1 text-center">
              <div
                className="relative flex items-center justify-center select-none shrink-0"
                style={{ width: `${RUN_TITLE_BOX_WIDTH_REM}rem`, lineHeight: 1 }}
              >
                <span
                  aria-hidden
                  className={`absolute font-black whitespace-nowrap pointer-events-none ${titleFontClass}`}
                  style={{ color: '#69C9D0', transform: 'translate(-3px, -2px)', mixBlendMode: 'screen', opacity: 0.5 }}
                >
                  {displayTitle}
                </span>
                <span
                  aria-hidden
                  className={`absolute font-black whitespace-nowrap pointer-events-none ${titleFontClass}`}
                  style={{ color: '#EE1D52', transform: 'translate(5px, 3px)', mixBlendMode: 'screen' }}
                >
                  {displayTitle}
                </span>
                <span
                  className={`relative font-black whitespace-nowrap ${titleFontClass}`}
                  style={{ color: isHard ? '#fca5a5' : '#ffffff' }}
                >
                  {displayTitle}
                </span>
              </div>
              <div className="h-5 flex items-center justify-center">
                {!inHomeTutorial && effectiveRunNo > highestUnlocked && (
                  <span className="text-xs text-gray-500">通关第 {effectiveRunNo - 1} 局普通后解锁</span>
                )}
              </div>
            </div>

            {!inHomeTutorial && effectiveRunNo < maxNavigable ? (
              <button
                onClick={goNext}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors text-2xl text-gray-300 flex-shrink-0"
                aria-label="下一局"
              >
                ›
              </button>
            ) : (
              <div className="w-10 flex-shrink-0" />
            )}
          </div>

          <div className="h-6 flex flex-wrap gap-1.5 justify-center w-full items-center">
            {canChallenge && displayTags.map((tag, i) => {
              const isBuff = tag.includes('+') && !tag.includes('目标');
              const isSpecial = tag.includes('♥') || tag.includes('♠') || tag.includes('♦') || tag.includes('♣') || tag.includes('牌堆') || tag.includes('关');
              return <RuleChip key={i} label={tag} variant={isSpecial ? 'special' : isBuff ? 'buff' : 'debuff'} />;
            })}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-3 w-full">
          {canChallenge ? (
            <>
              <button
                ref={challengeBtnRef}
                onClick={handleChallenge}
                className={`w-full font-black text-lg py-3.5 rounded-2xl transition-all shadow-lg ${tutorialHighlightClass(
                  inHomeTutorial && homeStep === 'challenge',
                )} ${
                  isHard
                    ? 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/40'
                    : 'bg-rl-gold hover:bg-yellow-300 text-black shadow-yellow-900/30'
                }`}
              >
                {(isHard ? isHardClear : isNormalClear) ? '再次挑战' : isHard ? '困难挑战' : '挑战'}
              </button>

              {showEndlessRow && (
                <>
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
              )}
            </>
          ) : (
            <div className="w-full text-center py-3.5 text-gray-500 text-sm font-medium">
              {difficulty === 'hard'
                ? `先通关第 ${effectiveRunNo} 局普通才能挑战困难`
                : `先通关第 ${effectiveRunNo - 1} 局才能解锁`}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (window.confirm('确定清空本地存档？将回到新手引导初始状态。')) {
                clearRoguelikeSave();
                window.location.reload();
              }
            }}
            className="w-full text-red-400/80 hover:text-red-300 text-xs py-2 transition-colors border border-red-900/40 rounded-xl"
          >
            清档
          </button>
        </div>
      </div>

      <RushLeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
    </div>
  );
}
