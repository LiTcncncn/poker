import type { SkillDef, SkillEffect } from '../types/skill';
import {
  getSuperCardIndependentFactor,
  SKILL_COUNT_MULT_ID,
  SKILL_COUNT_MULT_PER_SKILL,
} from '../engine/skillEngine';
import type { SkillNumericSegment } from './skillNumericDisplay';

export interface SkillCardFaceStatsOptions {
  /** `skillAccumulation[skill.id]`，缺省按 0 */
  accumulated?: number;
  /** 本局超级牌张数；缺省则「超级牌乘倍」只展示每牌增量文案 */
  superCardCount?: number;
}

export interface SkillCardFaceStats {
  /** 非累积类效果的简短数值摘要 */
  baseText: string;
  /** 有累积类技能时展示当前池（含 $0 / +0倍） */
  accumText: string | null;
  /** 超级牌独立乘区：有张数时展示当前 ×，否则展示每牌 Δ */
  superCardText: string | null;
}

function formatEffectBase(ef: SkillEffect): string | null {
  switch (ef.type) {
    case 'add_score':
      return ef.value !== 0 ? `+$${ef.value}` : null;
    case 'add_multiplier':
      return ef.value !== 0 ? `+${ef.value}倍` : null;
    case 'independent_multiply':
      if (ef.requireRunDiamondsLte !== undefined) return null;
      return ef.value !== 1 ? `×${ef.value}` : null;
    case 'super_card_independent_multiply':
      return null;
    case 'hand_add_score':
      return `+$${ef.value}`;
    case 'hand_add_multiplier':
      return `+${ef.value}倍`;
    case 'all_cards_score':
      return ef.value !== 0 ? `全+$${ef.value}` : '全计分';
    case 'per_scoring_card_score':
      return `分牌+$${ef.value}`;
    case 'per_scoring_card_multiplier':
      return `分牌+${ef.value}倍`;
    case 'per_non_scoring_card_multiplier':
      return `非分+${ef.value}倍`;
    case 'accumulate_score':
      return `+$${ef.value}/触发`;
    case 'accumulate_score_saved_hands':
      return `+$${ef.value}/省手`;
    case 'accumulate_multiplier':
      return `+${ef.value}倍/触发`;
    case 'accumulate_multiplier_no_draw':
      return `+${ef.value}倍/未补`;
    case 'modify_rule':
      return null;
    case 'per_run_diamond_score':
    case 'per_run_diamond_multiplier':
      return null;
    case 'random_hand_add_multiplier': {
      const mn = ef.randomMultMin ?? 2;
      const mx = ef.randomMultMax ?? 15;
      return `+${mn}~${mx}倍`;
    }
    case 'per_remaining_hand_add_multiplier':
      return null;
    default:
      return null;
  }
}

export function getSkillCardFaceStats(skill: SkillDef, opts?: SkillCardFaceStatsOptions): SkillCardFaceStats {
  const accumulated = opts?.accumulated ?? 0;
  const superCardCount = opts?.superCardCount;

  const rawParts: string[] = [];
  for (const ef of skill.effects) {
    const s = formatEffectBase(ef);
    if (s) rawParts.push(s);
  }
  const baseText = [...new Set(rawParts)].join(' · ');

  const hasScoreAccum = skill.effects.some(
    (e) => e.type === 'accumulate_score' || e.type === 'accumulate_score_saved_hands'
  );
  const hasMultAccum = skill.effects.some(
    (e) => e.type === 'accumulate_multiplier' || e.type === 'accumulate_multiplier_no_draw'
  );

  let accumText: string | null = null;
  if (hasScoreAccum) accumText = `累积 $${accumulated}`;
  else if (hasMultAccum) accumText = `累积 +${accumulated}倍`;

  let superCardText: string | null = null;
  if (skill.effects.some((e) => e.type === 'super_card_independent_multiply')) {
    if (superCardCount !== undefined) {
      const fac = getSuperCardIndependentFactor(skill, superCardCount);
      if (fac != null) superCardText = `当前 ×${fac.toFixed(1)}`;
    } else {
      const ef = skill.effects.find((e) => e.type === 'super_card_independent_multiply');
      if (ef) superCardText = `每两超牌 +${ef.value}`;
    }
  }

  return { baseText, accumText, superCardText };
}

function formatIndependentFactorShort(f: number): string {
  const x = Math.round(f * 10) / 10;
  return Number.isInteger(x) ? `×${x}` : `×${x.toFixed(1)}`;
}

function faceBaseNumericSegmentFromEffect(ef: SkillEffect): SkillNumericSegment | null {
  switch (ef.type) {
    case 'add_score':
      return ef.value !== 0 ? { kind: 'score', text: `+$${ef.value}` } : null;
    case 'add_multiplier':
      return ef.value !== 0 ? { kind: 'mult_add', text: `+${ef.value} 倍` } : null;
    case 'independent_multiply':
      if (ef.requireRunDiamondsLte !== undefined) return null;
      return ef.value !== 1
        ? { kind: 'times', text: formatIndependentFactorShort(ef.value) }
        : null;
    case 'super_card_independent_multiply':
      return null;
    case 'hand_add_score':
      return ef.value !== 0 ? { kind: 'score', text: `+$${ef.value}` } : null;
    case 'hand_add_multiplier':
      return ef.value !== 0 ? { kind: 'mult_add', text: `+${ef.value} 倍` } : null;
    case 'all_cards_score':
      return ef.value !== 0 ? { kind: 'score', text: `+$${ef.value}` } : null;
    case 'per_scoring_card_score':
      return ef.value !== 0 ? { kind: 'score', text: `+$${ef.value}` } : null;
    case 'per_scoring_card_multiplier':
      return ef.value !== 0 ? { kind: 'mult_add', text: `+${ef.value} 倍` } : null;
    case 'per_non_scoring_card_multiplier':
      return ef.value !== 0 ? { kind: 'mult_add', text: `+${ef.value} 倍` } : null;
    case 'accumulate_score':
    case 'accumulate_score_saved_hands':
    case 'accumulate_multiplier':
    case 'accumulate_multiplier_no_draw':
      return null;
    case 'modify_rule':
      return null;
    case 'per_run_diamond_score':
    case 'per_run_diamond_multiplier':
      return null;
    case 'random_hand_add_multiplier': {
      const mn = ef.randomMultMin ?? 2;
      const mx = ef.randomMultMax ?? 15;
      return { kind: 'mult_add', text: `+${mn}~${mx} 倍` };
    }
    case 'per_remaining_hand_add_multiplier':
      return null;
    default:
      return null;
  }
}

/** A 加注加倍率：缩短文案便于单行字号略大（仍为 $→蓝、倍→红） */
function aceComboFaceBaseSegments(skill: Pick<SkillDef, 'effects'>): SkillNumericSegment[] | null {
  const scoreEf = skill.effects.find((e) => e.type === 'per_scoring_card_score');
  const multEf = skill.effects.find((e) => e.type === 'per_scoring_card_multiplier');
  if (!scoreEf || !multEf) return null;
  return [
    { kind: 'score', text: `$${scoreEf.value}` },
    { kind: 'mult_add', text: `${multEf.value} 倍` },
  ];
}

export interface SkillFaceNumericOpts {
  /** 局内 💎；用于钻石估值/倍率牌面动态显示 */
  runDiamonds?: number;
  /** 剩手加倍：与 `stageUsedHands` 同传，用于牌面动态 +倍 */
  stageTotalHands?: number;
  stageUsedHands?: number;
  /** 随机加倍：翻牌后本手已锁定的点数，牌面显示具体 +N 倍（未翻牌不传则显示区间） */
  pendingRandomHandMult?: number;
  /** 已装备技能 id；用于「技能数加倍」牌面显示当前实际 +N 倍（与结算一致） */
  acquiredSkillIds?: string[];
}

/** 牌面技能名下基础数值分段（单行逗号拼接 + 分色） */
export function getSkillFaceBaseNumericSegments(
  skill: Pick<SkillDef, 'effects' | 'id'>,
  opts?: SkillFaceNumericOpts,
): SkillNumericSegment[] {
  if (skill.id === 'ace_combo') {
    const ace = aceComboFaceBaseSegments(skill);
    if (ace) return ace;
  }

  if (skill.id === SKILL_COUNT_MULT_ID) {
    const ids = opts?.acquiredSkillIds;
    if (ids == null) return [];
    const owned = ids.includes(skill.id);
    const n = owned ? ids.length : ids.length + 1;
    const add = n * SKILL_COUNT_MULT_PER_SKILL;
    if (add <= 0) return [];
    return [{ kind: 'mult_add', text: `+${add} 倍` }];
  }

  const gems = opts?.runDiamonds !== undefined ? Math.max(0, opts.runDiamonds) : undefined;
  if (skill.id === 'diamond_score_per_gem' && gems !== undefined) {
    const ef = skill.effects.find((e) => e.type === 'per_run_diamond_score');
    const v = ef?.value ?? 3;
    const cost = Math.max(1, ef?.perRunDiamondsCost ?? 1);
    const steps = Math.floor(gems / cost);
    return [{ kind: 'score', text: `+$${steps * v}` }];
  }
  const dmEf = skill.effects.find((e) => e.type === 'per_run_diamond_multiplier');
  if (dmEf && gems !== undefined) {
    const v = dmEf.value ?? 1;
    const cost = Math.max(1, dmEf.perRunDiamondsCost ?? 1);
    const steps = Math.floor(gems / cost);
    return [{ kind: 'mult_add', text: `+${steps * v} 倍` }];
  }

  const randEf = skill.effects.find((e) => e.type === 'random_hand_add_multiplier');
  if (randEf && opts?.pendingRandomHandMult !== undefined) {
    return [{ kind: 'mult_add', text: `+${opts.pendingRandomHandMult} 倍` }];
  }

  const remEf = skill.effects.find((e) => e.type === 'per_remaining_hand_add_multiplier');
  if (remEf) {
    if (opts?.stageTotalHands !== undefined && opts?.stageUsedHands !== undefined) {
      const n = Math.max(0, opts.stageTotalHands - opts.stageUsedHands - 1);
      const t = n * remEf.value;
      return [{ kind: 'mult_add', text: `+${t} 倍` }];
    }
    return [];
  }

  const out: SkillNumericSegment[] = [];
  const seen = new Set<string>();
  for (const ef of skill.effects) {
    let seg: SkillNumericSegment | null = null;
    if (ef.type === 'independent_multiply' && ef.requireRunDiamondsLte !== undefined) {
      const gems = opts?.runDiamonds;
      if (
        gems !== undefined &&
        gems <= ef.requireRunDiamondsLte &&
        ef.value !== 1
      ) {
        seg = { kind: 'times', text: formatIndependentFactorShort(ef.value) };
      }
    } else {
      seg = faceBaseNumericSegmentFromEffect(ef);
    }
    if (!seg) continue;
    const key = `${seg.kind}:${seg.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(seg);
  }
  return out;
}

/**
 * 牌面「动态最终值」分段（× / +$ / +N 倍），超级牌乘倍仅在传入 `superCardCount` 时加入。
 */
export function getSkillCumulativeFinalSegments(
  skill: Pick<SkillDef, 'id' | 'effects'>,
  opts?: { accumulated?: number; superCardCount?: number },
): SkillNumericSegment[] {
  const accumulated = opts?.accumulated ?? 0;
  const out: SkillNumericSegment[] = [];
  const asDef = skill as SkillDef;

  if (
    skill.effects.some((e) => e.type === 'super_card_independent_multiply') &&
    opts?.superCardCount !== undefined
  ) {
    const fac = getSuperCardIndependentFactor(asDef, opts.superCardCount);
    if (fac != null) {
      out.push({ kind: 'times', text: formatIndependentFactorShort(fac) });
    }
  }

  const hasScoreAccum = skill.effects.some(
    (e) => e.type === 'accumulate_score' || e.type === 'accumulate_score_saved_hands',
  );
  const hasMultAccum = skill.effects.some(
    (e) => e.type === 'accumulate_multiplier' || e.type === 'accumulate_multiplier_no_draw',
  );

  // 「精英关无限制」：accumulated 用作剩余次数（含最后一关已扣至 0、尚未结算移除时显示 0 次）
  if (skill.id === 'elite_unshackled') {
    const charge = accumulated != null && Number.isFinite(Number(accumulated)) ? Number(accumulated) : 3;
    out.push({ kind: 'times', text: `${charge} 次` });
    return out;
  }

  if (hasScoreAccum) out.push({ kind: 'score', text: `+$${accumulated}` });
  else if (hasMultAccum) out.push({ kind: 'mult_add', text: `+${accumulated} 倍` });

  return out;
}
