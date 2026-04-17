import React from 'react';
import { ModifierDef } from '../types/modifier';

const DIFF_STYLE = ['', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

interface Props {
  modifier: ModifierDef;
}

export default function ModifierBadge({ modifier }: Props) {
  const diffColor = DIFF_STYLE[modifier.difficulty] ?? 'text-gray-400';

  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
      {/* 难度指示 */}
      <span className="text-lg">⚠️</span>
      <div>
        <div className={`text-sm font-bold ${diffColor}`}>{modifier.name}</div>
        <div className="text-xs text-gray-400">{modifier.description}</div>
      </div>
    </div>
  );
}
