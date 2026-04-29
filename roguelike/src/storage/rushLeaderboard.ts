import type { HandType } from '../shared/types/poker';
import type { RunState } from '../types/run';
import { TOTAL_STAGES } from '../engine/runEngine';
import { handTypeCategoryLabel } from '../engine/handEngine';

const STORAGE_KEY = 'poker-roguelike-rush-leaderboard-v1';
const MAX_ENTRIES = 10;

export interface RushLeaderboardEntry {
  /** 已完成主线关数 + 无尽关数 */
  clearedTotal: number;
  /** 单手最高收益那一手的牌型（非牌力最大） */
  maxHandType: HandType | null;
  maxSingleHandGold: number;
  endedAt: number;
}

export function clearedStagesTotal(run: RunState): number {
  const mainWon = run.stages.filter(
    s => s.stageIndex < TOTAL_STAGES && s.status === 'won',
  ).length;
  return mainWon + run.endlessStagesCleared;
}

function loadRaw(): RushLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RushLeaderboardEntry =>
        e != null &&
        typeof e === 'object' &&
        typeof (e as RushLeaderboardEntry).clearedTotal === 'number' &&
        typeof (e as RushLeaderboardEntry).maxSingleHandGold === 'number' &&
        typeof (e as RushLeaderboardEntry).endedAt === 'number',
    );
  } catch {
    return [];
  }
}

function saveRaw(entries: RushLeaderboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota */
  }
}

/** 读取排行（已按名次排好，最多 10 条） */
export function loadRushLeaderboard(): RushLeaderboardEntry[] {
  return sortEntries(loadRaw()).slice(0, MAX_ENTRIES);
}

export function clearRushLeaderboard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function sortEntries(entries: RushLeaderboardEntry[]): RushLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.clearedTotal !== a.clearedTotal) return b.clearedTotal - a.clearedTotal;
    if (b.maxSingleHandGold !== a.maxSingleHandGold) return b.maxSingleHandGold - a.maxSingleHandGold;
    return b.endedAt - a.endedAt;
  });
}

/** 放弃/结算本局时写入一条历史（仅统计类，不入 zustand） */
export function recordRunOnAbandon(run: RunState): void {
  const clearedTotal = clearedStagesTotal(run);
  const maxSingleHandGold = run.maxSingleHandGold ?? 0;
  if (clearedTotal <= 0 && run.totalGoldEarned <= 0) return;

  const best = run.bestHandThisRun;
  const maxHandType =
    best && best.finalGold === maxSingleHandGold ? best.handType : null;

  const entry: RushLeaderboardEntry = {
    clearedTotal,
    maxHandType,
    maxSingleHandGold,
    endedAt: Date.now(),
  };

  const next = sortEntries([...loadRaw(), entry]).slice(0, MAX_ENTRIES);
  saveRaw(next);
}

export function formatRushLeaderboardTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function rushMaxHandLabel(handType: HandType | null): string {
  if (!handType) return '—';
  return handTypeCategoryLabel(handType);
}
