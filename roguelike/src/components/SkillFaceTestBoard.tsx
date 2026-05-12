import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SkillDef, SkillEnhancement, SkillQuality } from '../types/skill';
import { ALL_SKILLS } from '../engine/skillEngine';
import { SkillPlayingCard } from './SkillPlayingCard';
import { SkillPlayingCardDetailModal } from './SkillPlayingCardDetailModal';

type FitMode = 'cover' | 'contain';

type SlotState = {
  slotId: number; // 1..6
  skill: SkillDef;
  enhancement: SkillEnhancement;
  imageUrl: string | null;
  fileName: string | null;
  imgW: number | null;
  imgH: number | null;
  ratioOk: boolean | null;
  fit: FitMode;
  opacity: number; // 0..1
};

function pickTwoPerQuality(): SkillDef[] {
  const byQ: Record<SkillQuality, SkillDef[]> = { green: [], blue: [], purple: [] };
  for (const s of ALL_SKILLS) {
    byQ[s.quality].push(s);
  }
  // 稳定取样：每个品质按 JSON 顺序取前两个
  return [...byQ.green.slice(0, 2), ...byQ.blue.slice(0, 2), ...byQ.purple.slice(0, 2)];
}

function ratioIs2to3(w: number, h: number) {
  const r = w / h;
  return Math.abs(r - 2 / 3) <= 0.01; // 允许 1% 误差
}

async function getImageSize(url: string): Promise<{ w: number; h: number }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = url;
  });
}

const DEFAULT_ENHANCEMENTS: SkillEnhancement[] = ['normal', 'flash', 'gold', 'laser', 'black', 'normal'];

export function SkillFaceTestBoard() {
  const skills = useMemo(() => pickTwoPerQuality(), []);
  const [globalFit] = useState<FitMode>('cover');
  const [globalOpacity] = useState(1);

  const [detail, setDetail] = useState<{
    slot: SlotState;
  } | null>(null);

  const prevUrlsRef = useRef<string[]>([]);

  const [slots, setSlots] = useState<SlotState[]>(() => {
    const picked = skills.length === 6 ? skills : [...skills, ...skills].slice(0, 6);
    return picked.map((skill, i) => ({
      slotId: i + 1,
      skill,
      enhancement: DEFAULT_ENHANCEMENTS[i] ?? 'normal',
      imageUrl: null,
      fileName: null,
      imgW: null,
      imgH: null,
      ratioOk: null,
      fit: globalFit,
      opacity: globalOpacity,
    }));
  });

  // 清理 blob URL，避免泄漏
  useEffect(() => {
    return () => {
      for (const u of prevUrlsRef.current) URL.revokeObjectURL(u);
      prevUrlsRef.current = [];
    };
  }, []);

  function clearAll() {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.imageUrl) {
          URL.revokeObjectURL(s.imageUrl);
        }
        return {
          ...s,
          imageUrl: null,
          fileName: null,
          imgW: null,
          imgH: null,
          ratioOk: null,
        };
      }),
    );
  }

  function clearOne(slotId: number) {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.slotId !== slotId) return s;
        if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
        return {
          ...s,
          imageUrl: null,
          fileName: null,
          imgW: null,
          imgH: null,
          ratioOk: null,
        };
      }),
    );
  }

  async function onPickFile(slotId: number, file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    prevUrlsRef.current.push(url);

    let w: number | null = null;
    let h: number | null = null;
    let ok: boolean | null = null;
    try {
      const size = await getImageSize(url);
      w = size.w;
      h = size.h;
      ok = ratioIs2to3(size.w, size.h);
    } catch {
      // ignore size
    }

    setSlots((prev) =>
      prev.map((s) => {
        if (s.slotId !== slotId) return s;
        if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
        return {
          ...s,
          imageUrl: url,
          fileName: file.name ?? null,
          imgW: w,
          imgH: h,
          ratioOk: ok,
          // 新上传默认吃当前“全局”设置，减少每次重复调参
          fit: globalFit,
          opacity: globalOpacity,
        };
      }),
    );
  }

  // 全局设置模块已移除：fit/opacity 固定为默认值（cover + 1）

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col gap-4 px-3 py-6 pb-16 text-slate-100">
      <header className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black">技能牌牌面插画对比</h1>
      </header>

      {/* 3×2 商店尺度对比板 */}
      <section className="space-y-2">
        <div className="text-sm font-black text-white">商店尺度（3×2）</div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-white/10 bg-black/10 px-3 py-1.5 text-xs font-bold text-slate-200"
          >
            全部清除
          </button>
        </div>
        <div className="mx-auto grid w-max max-w-full grid-cols-[repeat(3,4.5rem)] grid-rows-2 justify-center gap-x-3 gap-y-4">
          {slots.map((slot) => (
            <div
              key={slot.slotId}
              className="flex w-full flex-col items-center gap-1"
            >
              <button
                type="button"
                onClick={() => setDetail({ slot })}
                className="relative w-full touch-manipulation rounded-[14px] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rl-gold/50"
                aria-label={`查看 #${slot.slotId} ${slot.skill.name} 详情`}
              >
                <div
                  className="relative w-full overflow-visible rounded-[14px] border border-rl-border/50 bg-rl-bg/20 shadow-inner"
                  style={{ aspectRatio: '2 / 3' }}
                >
                  <SkillPlayingCard
                    skill={slot.skill}
                    enhancement={slot.enhancement}
                    faceImageUrl={slot.imageUrl ?? undefined}
                    faceImageFit={slot.fit}
                    faceImageOpacity={slot.opacity}
                    hideFaceText={Boolean(slot.imageUrl)}
                    disablePurpleShimmer={true}
                    className="absolute inset-0 h-full w-full min-h-0 !max-w-none hover:!translate-y-0 active:!scale-100"
                  />
                </div>
              </button>

              <div className="w-full text-center text-[10px] leading-tight text-slate-400">
                <div className="font-bold text-slate-200">#{slot.slotId}</div>
                <div className="truncate">{slot.skill.name}</div>
              </div>

              <label className="w-full">
                <span className="sr-only">选择图片</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(slot.slotId, e.target.files?.[0] ?? null)}
                />
                <div className="w-full rounded-lg bg-rl-gold text-black text-[12px] font-black py-1.5 text-center">
                  {slot.imageUrl ? '换图' : '选图'}
                </div>
              </label>

              <button
                type="button"
                onClick={() => clearOne(slot.slotId)}
                className="w-full rounded border border-white/10 bg-black/10 py-1 text-[10px] font-bold text-slate-200"
              >
                清除此卡
              </button>

              <div className="w-full text-center text-[9px] text-slate-500">
                {slot.imgW && slot.imgH ? (
                  <>
                    {slot.imgW}×{slot.imgH}{' '}
                    {slot.ratioOk == null ? null : slot.ratioOk ? (
                      <span className="text-emerald-300">2:3 OK</span>
                    ) : (
                      <span className="text-amber-300">非 2:3</span>
                    )}
                  </>
                ) : slot.imageUrl ? (
                  <span className="text-slate-400">已选择</span>
                ) : (
                  <span>未选择</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {detail ? (
        <SkillPlayingCardDetailModal
          skill={detail.slot.skill}
          enhancement={detail.slot.enhancement}
          onClose={() => setDetail(null)}
          // detail modal 内目前不支持插画；第一版先用点击回到对比板即可
        />
      ) : null}
    </div>
  );
}

