import type { RunState } from '../types/run';

/** IAA 每关记录与 `roguelikeStore` 一致：用 `currentStageIndex`（无尽模式固定槽位，勿用 `stage.stageIndex`） */
export function getIaaStageKey(run: Pick<RunState, 'currentStageIndex'>): number {
  return run.currentStageIndex;
}
