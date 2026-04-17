import React from 'react';
import { SkillDef, SkillQuality } from '../types/skill';

const QUALITY_STYLE: Record<SkillQuality, { border: string; badge: string; label: string }> = {
  green:  { border: 'border-green-500',  badge: 'bg-green-600',  label: '普通' },
  blue:   { border: 'border-blue-400',   badge: 'bg-blue-600',   label: '稀有' },
  purple: { border: 'border-purple-400', badge: 'bg-purple-600', label: '史诗' },
};

interface Props {
  skill: SkillDef;
  /** 显示名（可覆盖 skill.name，用于累积值展示） */
  displayName?: string;
  /** 点击时触发（用于奖励选择） */
  onClick?: () => void;
  /** 是否已拥有（只展示，不可点击） */
  owned?: boolean;
  /** 是否紧凑模式（技能槽中小卡片） */
  compact?: boolean;
}

export default function SkillCard({ skill, displayName, onClick, owned = false, compact = false }: Props) {
  const q = QUALITY_STYLE[skill.quality];
  const name = displayName ?? skill.name;

  if (compact) {
    return (
      <div
        title={`${name}：${skill.description}`}
        className={`
          w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-default
          border ${q.border} bg-gray-800 text-white
        `}
      >
        <span className="truncate">{name}</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={owned || !onClick}
      className={`
        flex flex-col gap-2 p-4 rounded-xl border-2 text-left w-full transition-all
        ${q.border} bg-gray-900
        ${onClick && !owned ? 'hover:scale-[1.02] hover:brightness-110 cursor-pointer active:scale-95' : 'cursor-default'}
        ${owned ? 'opacity-60' : ''}
      `}
    >
      {/* 品质标签 + 名称 */}
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${q.badge} text-white`}>
          {q.label}
        </span>
        <span className="text-white font-bold text-base">{name}</span>
        {owned && <span className="ml-auto text-xs text-gray-400">已拥有</span>}
      </div>

      {/* 描述 */}
      <p className="text-sm text-gray-300 leading-relaxed">{skill.description}</p>
    </button>
  );
}
