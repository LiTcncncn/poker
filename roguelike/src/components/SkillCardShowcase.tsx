import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { SkillDef, SkillEnhancement, SkillQuality } from '../types/skill';
import { ALL_SKILLS } from '../engine/skillEngine';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';
import { UpgradePlayingCard } from './UpgradePlayingCard';
import { HAND_NAMES } from '../engine/handEngine';
import { ENHANCEMENT_DISPLAY } from '../utils/skillEnhancementDisplay';

const QUALITIES: SkillQuality[] = ['green', 'blue', 'purple'];
const ENHANCEMENTS: SkillEnhancement[] = ['normal', 'flash', 'gold', 'laser', 'black'];

const QUALITY_LABEL: Record<SkillQuality, string> = {
  green: '绿',
  blue: '蓝',
  purple: '紫',
};

function firstSkillOfQuality(q: SkillQuality): SkillDef {
  const s = ALL_SKILLS.find((sk) => sk.quality === q);
  if (!s) throw new Error(`runSkillPool 中缺少品质为 ${q} 的技能`);
  return s;
}

/** 预览用：演示累积池 / 超级牌乘倍（实战胜绑定 skillAccumulation / attributeCards） */
const SHOWCASE_SUPER_COUNT = 2;
const SHOWCASE_ACCUM_DEMO: Record<string, number> = {
  pair_accum: 80,
};

/** 牌面双基础数值（+$30 / +4倍）+ 特殊边示意：runSkillPool `ace_combo` */
const SHOWCASE_ACE_COMBO_SKILL = ALL_SKILLS.find((s) => s.id === 'ace_combo');
const SHOWCASE_ACE_COMBO_EDGES = ['flash', 'gold', 'laser', 'black'] as const satisfies readonly SkillEnhancement[];

/** 升级牌预览：与实装 `UpgradePlayingCard` 同组件，便于在 ?skillPreview=1 下调底色/边框 */
const SHOWCASE_UPGRADE_DEMOS = [
  { handName: HAND_NAMES.flush, currentLevel: 2, baseScoreDelta: 25, multiplierDelta: 1 },
  { handName: HAND_NAMES.full_house, currentLevel: 4, baseScoreDelta: 40, multiplierDelta: 0 },
  { handName: HAND_NAMES.straight_flush, currentLevel: 1, baseScoreDelta: 0, multiplierDelta: 2 },
] as const;

function exitShowcase() {
  const u = new URL(window.location.href);
  u.searchParams.delete('skillPreview');
  window.history.replaceState({}, '', u.pathname + u.search + u.hash);
  window.location.reload();
}

export function SkillCardShowcase() {
  const [detail, setDetail] = useState<{
    skill: SkillDef;
    enhancement: SkillEnhancement;
  } | null>(null);

  const skillByQuality = useMemo(() => {
    const m = {} as Record<SkillQuality, SkillDef>;
    for (const q of QUALITIES) {
      m[q] = firstSkillOfQuality(q);
    }
    return m;
  }, []);

  /** 预览用：模拟一局 3 个已装备技能，供「技能数加倍」等牌面动态数值 */
  const showcaseAcquiredSkillIds = useMemo(
    () => QUALITIES.map((q) => firstSkillOfQuality(q).id),
    [],
  );

  const overlapSkills = useMemo(
    () =>
      QUALITIES.map((q, i) => ({
        skill: skillByQuality[q],
        enhancement: (['flash', 'gold', 'laser', 'black'] as const)[i % 4],
      })),
    [skillByQuality]
  );

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col gap-8 px-3 py-6 pb-16 text-slate-100">
      <header className="space-y-2 border-b border-white/10 pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-rl-gold/90">独立预览 · 手机单列</p>
        <h1 className="text-2xl font-black">技能牌 / 升级牌设计稿</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          与游戏一致：窄栏单列。含技能牌矩阵与<strong className="text-slate-300">升级商店用升级牌</strong>（独立底色+边框，见下节）。
          打开方式 <code className="rounded bg-white/10 px-1">?skillPreview=1</code>
        </p>
        <button
          type="button"
          onClick={exitShowcase}
          className="mt-2 w-full rounded-lg border border-rl-border bg-rl-surface py-2.5 text-sm font-bold text-rl-gold"
        >
          返回游戏
        </button>
      </header>

      <section className="rounded-xl border border-dashed border-amber-500/35 bg-amber-950/15 px-3 py-5">
        <h2 className="mb-1 text-base font-black text-amber-100">升级牌（升级商店）</h2>
        <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
          组件：<code className="text-amber-200/90">UpgradePlayingCard.tsx</code>
          —— 改外框/渐变/字色即全局生效。以下为三张示意（与超级牌商店同宽约{' '}
          <code className="rounded bg-white/10 px-1">4.5rem</code> 列也可拉大）。
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {SHOWCASE_UPGRADE_DEMOS.map((opt, i) => (
            <div key={i} className="flex w-[5.5rem] flex-col items-center gap-2">
              <span className="text-center text-[10px] font-bold text-slate-500">示意 {i + 1}</span>
              <UpgradePlayingCard option={opt} className="!w-full !max-w-none" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <div className="w-[4.5rem]">
            <p className="mb-1 text-center text-[10px] text-slate-500">商店列宽</p>
            <UpgradePlayingCard
              option={SHOWCASE_UPGRADE_DEMOS[0]}
              className="!w-full !max-w-none"
            />
          </div>
        </div>
      </section>

      {SHOWCASE_ACE_COMBO_SKILL && (
        <section className="rounded-xl border border-rl-border bg-rl-surface/40 px-3 py-5">
          <h2 className="mb-1 text-base font-black text-white">A加注加倍率 · 双数值 + 特殊边</h2>
          <p className="mb-5 text-[11px] leading-relaxed text-slate-400">
            <code className="text-cyan-300/90">ace_combo</code>：+$30 与 +4 倍；以下为银 / 金 / 彩 / 黑四档（纵向便于手机浏览）。
          </p>
          <div className="flex flex-col items-center gap-6">
            {SHOWCASE_ACE_COMBO_EDGES.map((e) => (
              <div key={e} className="flex w-full max-w-[220px] flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">{ENHANCEMENT_DISPLAY[e]}</span>
                <SkillPlayingCard
                  skill={SHOWCASE_ACE_COMBO_SKILL}
                  enhancement={e}
                  superCardCount={SHOWCASE_SUPER_COUNT}
                  runDiamonds={12}
                  acquiredSkillIds={showcaseAcquiredSkillIds}
                  className="!w-full !max-w-[200px]"
                  onClick={() =>
                    setDetail({ skill: SHOWCASE_ACE_COMBO_SKILL, enhancement: e })
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-black text-white">品质 × 附加边（横滑）</h2>
        <div className="flex flex-col gap-6">
          {QUALITIES.map((q) => {
            const sk = skillByQuality[q];
            return (
              <div key={q}>
                <div className="mb-2">
                  <span className="font-bold text-white">{QUALITY_LABEL[q]}</span>
                  <span className="ml-2 text-[11px] text-slate-500">{sk.name}</span>
                </div>
                <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
                  {ENHANCEMENTS.map((e) => (
                    <div
                      key={e}
                      className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1.5"
                    >
                      <span className="text-center text-[10px] leading-tight text-slate-500">
                        {e === 'normal' ? '无附加' : ENHANCEMENT_DISPLAY[e]}
                      </span>
                      <SkillPlayingCard
                        skill={sk}
                        enhancement={e}
                        accumulated={SHOWCASE_ACCUM_DEMO[sk.id]}
                        superCardCount={SHOWCASE_SUPER_COUNT}
                        runDiamonds={12}
                        acquiredSkillIds={showcaseAcquiredSkillIds}
                        className="!w-full !max-w-none"
                        onClick={() => setDetail({ skill: sk, enhancement: e })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-black text-white">叠放示意</h2>
        <p className="mb-3 text-[11px] text-slate-500">模拟窄栏内横向叠放。</p>
        <div className="flex h-36 items-end justify-center">
          <div className="relative flex h-32 w-full max-w-[20rem] items-end justify-center">
            {overlapSkills.map(({ skill, enhancement }, i) => (
              <div
                key={skill.id}
                className="absolute bottom-0"
                style={{
                  left: `calc(50% + ${(i - (overlapSkills.length - 1) / 2) * 28}px)`,
                  transform: 'translateX(-50%)',
                  zIndex: i + 1,
                }}
              >
                <SkillPlayingCard
                  skill={skill}
                  enhancement={enhancement}
                  accumulated={SHOWCASE_ACCUM_DEMO[skill.id]}
                  superCardCount={SHOWCASE_SUPER_COUNT}
                  runDiamonds={12}
                  acquiredSkillIds={showcaseAcquiredSkillIds}
                  className="!w-14 !max-w-none"
                  onClick={() => setDetail({ skill, enhancement })}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {detail && (
        <SkillPlayingCardDetailModal
          skill={detail.skill}
          enhancement={detail.enhancement}
          accumulated={SHOWCASE_ACCUM_DEMO[detail.skill.id]}
          superCardCount={SHOWCASE_SUPER_COUNT}
          runDiamonds={12}
          acquiredSkillIds={showcaseAcquiredSkillIds}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
