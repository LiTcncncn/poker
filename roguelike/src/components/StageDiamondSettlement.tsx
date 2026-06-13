import React from 'react';
import {
  baseLabelForKind,
  type StageDiamondBreakdown,
} from '../engine/stageDiamondEngine';

interface Props {
  breakdown: StageDiamondBreakdown;
  onContinue: () => void;
}

function DiamondRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-200">{label}</span>
      <span className="shrink-0 tabular-nums text-rl-gold">💎{amount}</span>
    </div>
  );
}

export function StageDiamondSettlement({ breakdown, onContinue }: Props) {
  const {
    stageLabel,
    base,
    handBonus,
    holdBonus,
    handsLeft,
    holdLeft,
    stageKind,
    tycoonBonus,
    stageDiamondCardEarned,
    totalGranted,
  } = breakdown;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 px-3"
      role="dialog"
      aria-modal
      aria-label="本关钻石奖励"
    >
      <div className="w-full max-w-[390px] rounded-2xl border border-white/10 bg-[#0f1f35] px-5 py-6 shadow-2xl">
        <h2 className="mb-4 text-center text-base font-bold text-white">{stageLabel}</h2>

        <div className="flex flex-col gap-2.5">
          <DiamondRow label={baseLabelForKind(stageKind)} amount={base} />
          <DiamondRow label={`剩余手数（${handsLeft}）`} amount={handBonus} />
          <DiamondRow label={`剩余补牌（${holdLeft}）`} amount={holdBonus} />
          {tycoonBonus > 0 ? <DiamondRow label="钻石王老五" amount={tycoonBonus} /> : null}
          {stageDiamondCardEarned > 0 ? (
            <DiamondRow label="钻石牌" amount={stageDiamondCardEarned} />
          ) : null}
        </div>

        <div className="my-4 border-t border-white/10" />

        <div className="mb-5 flex items-center justify-between text-base font-bold">
          <span className="text-white">本关合计</span>
          <span className="tabular-nums text-rl-gold">💎{totalGranted}</span>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-xl bg-rl-gold py-3 text-base font-black text-black transition-colors hover:bg-yellow-300"
        >
          继续
        </button>
      </div>
    </div>
  );
}
