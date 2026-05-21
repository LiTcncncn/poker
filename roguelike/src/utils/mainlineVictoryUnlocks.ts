import { getMainlineRunDef } from '../config/mainlineRuns';
import { getUnlockedOrdersAfterNormalRun } from '../config/skillUnlockOrders';
/** 主线普通/困难通关后，根据本局编号与难度生成可展示的解锁条目（仅已实现逻辑） */
export function getMainlineVictoryUnlockLines(
  runNo: number,
  difficulty: 'normal' | 'hard',
): string[] {
  if (runNo <= 0) return [];

  if (difficulty === 'hard') {
    return ['困难通关纪录已保存'];
  }

  const lines: string[] = [];

  if (runNo < 50) {
    const next = getMainlineRunDef(runNo + 1);
    lines.push(next ? `解锁第 ${runNo + 1} 局「${next.title}」` : `解锁第 ${runNo + 1} 局`);
  }

  lines.push(`解锁困难第 ${runNo} 局`);

  const prevOrders = getUnlockedOrdersAfterNormalRun(Math.max(0, runNo - 1));
  const newOrders = getUnlockedOrdersAfterNormalRun(runNo).filter(o => !prevOrders.includes(o));
  if (newOrders.length > 0) {
    lines.push(`解锁技能顺序 ${newOrders.join('、')}`);
  }

  return lines;
}
