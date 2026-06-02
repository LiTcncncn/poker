import { create } from 'zustand';
import { useProfileStore } from './profileStore';
import { RUN_TUTORIAL_LINES } from '../tutorial/tutorialConfig';

export type HomeTutorialStep = 'welcome_1' | 'challenge' | null;

export type RunTutorialStep =
  | 'hand_intro'
  | 'hold_four'
  | 'draw'
  | 'score'
  | 'stage_clear'
  | 'next_stage'
  | 'shop_intro'
  | 'shop_buy'
  | 'shop_continue'
  | 'rules_extra'
  | null;

interface TutorialStore {
  homeStep: HomeTutorialStep;
  runStep: RunTutorialStep;
  /** 引导文案子句索引（流式播放） */
  lineIndex: number;
  lastStageDiamondReward: number;
  autoFlipLocked: boolean;

  resetHomeTutorial: () => void;
  advanceHomeStep: () => void;
  skipHomeLines: () => void;

  setRunStep: (step: RunTutorialStep) => void;
  advanceRunLines: () => void;
  skipRunLines: () => void;
  setLastStageDiamondReward: (n: number) => void;
  setAutoFlipLocked: (v: boolean) => void;

  onTutorialStage0FlipDone: () => void;
  onTutorialStage1FlipDone: () => void;
  onHoldFourComplete: () => void;
  onStageClearShown: () => void;
  completeTutorial: () => void;
}

const HAND_INTRO_KEYS = ['hand_intro_1', 'hand_intro_2', 'hand_intro_3'] as const;
const RULES_EXTRA_KEYS = ['rules_extra_2', 'rules_extra_3'] as const;

function linesForRunStep(step: RunTutorialStep, diamondReward: number): string[] {
  if (step === 'stage_clear') {
    return [`本关目标达成，获得 💎${diamondReward}！`];
  }
  if (step === 'hand_intro') {
    const key = HAND_INTRO_KEYS[0];
    return RUN_TUTORIAL_LINES[key] ?? [];
  }
  if (step === 'rules_extra') {
    return [];
  }
  if (step === 'shop_intro') return RUN_TUTORIAL_LINES.shop_intro;
  return [];
}

export function getRunTutorialLines(
  step: RunTutorialStep,
  lineIndex: number,
  diamondReward: number,
): { lines: string[]; flatIndex: number } {
  if (!step) return { lines: [], flatIndex: 0 };
  if (step === 'hand_intro') {
    const flat: string[] = [];
    for (const k of HAND_INTRO_KEYS) flat.push(...(RUN_TUTORIAL_LINES[k] ?? []));
    return { lines: flat, flatIndex: lineIndex };
  }
  if (step === 'rules_extra') {
    const flat: string[] = [];
    for (const k of RULES_EXTRA_KEYS) flat.push(...(RUN_TUTORIAL_LINES[k] ?? []));
    return { lines: flat, flatIndex: lineIndex };
  }
  const lines = linesForRunStep(step, diamondReward);
  return { lines, flatIndex: lineIndex };
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  homeStep: 'welcome_1',
  runStep: null,
  lineIndex: 0,
  lastStageDiamondReward: 0,
  autoFlipLocked: false,

  resetHomeTutorial: () => {
    set({
      homeStep: 'welcome_1',
      runStep: null,
      lineIndex: 0,
      lastStageDiamondReward: 0,
      autoFlipLocked: false,
    });
  },

  advanceHomeStep: () => {
    const { homeStep } = get();
    if (homeStep === 'welcome_1') set({ homeStep: 'challenge', lineIndex: 0 });
  },

  skipHomeLines: () => {
    get().advanceHomeStep();
  },

  setRunStep: (step) => set({ runStep: step, lineIndex: 0 }),

  advanceRunLines: () => {
    const { runStep, lineIndex, lastStageDiamondReward } = get();
    if (!runStep) return;
    const { lines } = getRunTutorialLines(runStep, 0, lastStageDiamondReward);
    if (lineIndex + 1 < lines.length) {
      set({ lineIndex: lineIndex + 1 });
      return;
    }
    if (runStep === 'hand_intro') set({ runStep: 'hold_four', lineIndex: 0 });
    else if (runStep === 'stage_clear') set({ runStep: 'next_stage', lineIndex: 0 });
    else if (runStep === 'shop_intro') set({ runStep: 'shop_buy', lineIndex: 0 });
    else if (runStep === 'rules_extra') {
      useProfileStore.getState().completeTutorial();
      get().completeTutorial();
    }
  },

  skipRunLines: () => {
    get().advanceRunLines();
  },

  setLastStageDiamondReward: (n) => set({ lastStageDiamondReward: n }),
  setAutoFlipLocked: (v) => set({ autoFlipLocked: v }),

  onTutorialStage0FlipDone: () => {
    set({ runStep: 'hand_intro', lineIndex: 0 });
  },

  onTutorialStage1FlipDone: () => {
    set({ runStep: 'rules_extra', lineIndex: 0 });
  },

  onHoldFourComplete: () => {
    set({ runStep: 'draw', lineIndex: 0 });
  },

  onStageClearShown: () => {
    set({ runStep: 'next_stage', lineIndex: 0 });
  },

  completeTutorial: () => {
    set({ runStep: null, lineIndex: 0, homeStep: null, autoFlipLocked: false });
  },
}));
