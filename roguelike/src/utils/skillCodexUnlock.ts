import { MAINLINE_RUNS } from '../config/mainlineRuns';
import {
  SKILL_UNLOCK_ORDER_MAP,
  SKILL_UNLOCK_ORDER_FORWARD_DEFERRED,
  SKILL_UNLOCK_ORDER_RAINBOW_DEFERRED,
  SEVEN_CYCLE_UNLOCK_ORDER,
  SEVEN_CYCLE_UNLOCK_RUN_NO,
  getUnlockedOrdersAfterNormalRun,
} from '../config/skillUnlockOrders';
import { ALL_SKILLS } from '../engine/skillEngine';
import { FRAME_DEFS } from '../types/profile';
import type { SkillDef, SkillEnhancement, SkillQuality } from '../types/skill';

export const SEVEN_CYCLE_SKILL_ID = 'seven_cycle_x4';

const QUALITY_ORDER: SkillQuality[] = ['green', 'blue', 'purple'];

const skillIdToOrder = new Map<string, number>();
for (const [orderKey, ids] of Object.entries(SKILL_UNLOCK_ORDER_MAP)) {
  const order = Number(orderKey);
  for (const id of ids) {
    skillIdToOrder.set(id, order);
  }
}

function mainlineRunTitle(runNo: number): string {
  return MAINLINE_RUNS.find((r) => r.runNo === runNo)?.title ?? `第 ${runNo} 局`;
}

function requiredRunNoForOrder(order: number): number {
  if (order === 1) return 0;
  if (order === 2) return 2;
  if (order === 3) return 3;
  if (order === 4) return 5;
  if (order === SKILL_UNLOCK_ORDER_RAINBOW_DEFERRED) return 14;
  if (order === SKILL_UNLOCK_ORDER_FORWARD_DEFERRED) return 16;
  if (order === SEVEN_CYCLE_UNLOCK_ORDER) return SEVEN_CYCLE_UNLOCK_RUN_NO;
  if (order >= 5 && order <= 26) return 2 * order - 3;
  return 0;
}

export function isSkillUnlockedInCodex(skillId: string, highestNormalCleared: number): boolean {
  const order = skillIdToOrder.get(skillId);
  if (order == null) return false;
  return getUnlockedOrdersAfterNormalRun(highestNormalCleared).includes(order);
}

export function isEnhancementUnlockedInCodex(
  enhancement: Exclude<SkillEnhancement, 'normal'>,
  highestNormalCleared: number,
): boolean {
  const frame = FRAME_DEFS.find(
    (f) =>
      f.id !== 'default' &&
      ((f.id === 'silver' && enhancement === 'flash') ||
        (f.id === 'gold' && enhancement === 'gold') ||
        (f.id === 'rainbow' && enhancement === 'laser') ||
        (f.id === 'black' && enhancement === 'black')),
  );
  if (!frame || frame.unlockRunNo <= 0) return false;
  return highestNormalCleared >= frame.unlockRunNo;
}

/** 未解锁格点击后展示的局中文名；顺序 1 返回 null */
export function getCodexUnlockRunTitleForSkill(skillId: string): string | null {
  const order = skillIdToOrder.get(skillId);
  if (order == null || order === 1) return null;
  const runNo = requiredRunNoForOrder(order);
  if (runNo <= 0) return null;
  return mainlineRunTitle(runNo);
}

export function getCodexUnlockRunTitleForEdge(
  enhancement: Exclude<SkillEnhancement, 'normal'>,
): string | null {
  const frame = FRAME_DEFS.find(
    (f) =>
      f.id !== 'default' &&
      ((f.id === 'silver' && enhancement === 'flash') ||
        (f.id === 'gold' && enhancement === 'gold') ||
        (f.id === 'rainbow' && enhancement === 'laser') ||
        (f.id === 'black' && enhancement === 'black')),
  );
  if (!frame || frame.unlockRunNo <= 0) return null;
  return mainlineRunTitle(frame.unlockRunNo);
}

export function listSkillsForCodex(): SkillDef[] {
  const buckets: Record<SkillQuality, SkillDef[]> = { green: [], blue: [], purple: [] };
  for (const skill of ALL_SKILLS) {
    buckets[skill.quality].push(skill);
  }
  return QUALITY_ORDER.flatMap((q) => buckets[q]);
}

export const CODEX_EDGE_ITEMS: {
  key: string;
  enhancement: Exclude<SkillEnhancement, 'normal'>;
}[] = [
  { key: 'edge-flash', enhancement: 'flash' },
  { key: 'edge-gold', enhancement: 'gold' },
  { key: 'edge-laser', enhancement: 'laser' },
  { key: 'edge-black', enhancement: 'black' },
];
