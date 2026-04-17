import React, { useState } from 'react';
import { HandResult } from '../types/poker';
import { X, Trophy, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { EarningsChart } from './EarningsChart';
import clsx from 'clsx';

interface StatsViewProps {
  bestHands: HandResult[];
  stats: Record<string, { count: number; totalScore: number }>;
  chartRecords: number[];
  chartHandCount: number;
  onClose: () => void;
  onReset?: () => void;
}

const handTypeNames: Record<string, string> = {
  high_card: '高牌',
  one_pair: '一对',
  two_pairs: '两对',
  three_of_a_kind: '三条',
  straight: '顺子',
  flush: '同花',
  full_house: '葫芦',
  four_of_a_kind: '四条',
  five_of_a_kind: '五条',
  six_of_a_kind: '六条',
  seven_of_a_kind: '七条',
  straight_flush: '同花顺',
  royal_flush: '皇家同花顺',
};

type SortField = 'count' | 'totalScore';
type SortOrder = 'asc' | 'desc';

export const StatsView: React.FC<StatsViewProps> = ({ bestHands, stats, chartRecords, chartHandCount, onClose, onReset }) => {
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // 兼容旧数据格式：如果stats的值是number，转换为新格式
  const normalizedStats: Record<string, { count: number; totalScore: number }> = {};
  Object.entries(stats).forEach(([type, value]) => {
    if (typeof value === 'number') {
      // 旧格式：只有count
      normalizedStats[type] = { count: value, totalScore: 0 };
    } else {
      // 新格式
      normalizedStats[type] = value;
    }
  });
  
  const totalHands = Object.values(normalizedStats).reduce((sum, stat) => sum + stat.count, 0);
  const totalEarnings = Object.values(normalizedStats).reduce((sum, stat) => sum + stat.totalScore, 0);
  
  // 计算最大值（用于条状图）
  const maxCount = Math.max(...Object.values(normalizedStats).map(s => s.count), 1);
  const maxScore = Math.max(...Object.values(normalizedStats).map(s => s.totalScore), 1);
  
  // 排序函数
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 切换排序顺序
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 改变排序字段，默认降序
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  // 排序统计数据
  const sortedStats = Object.entries(normalizedStats)
    .sort((a, b) => {
      const valueA = a[1][sortField];
      const valueB = b[1][sortField];
      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    })
    .map(([type, { count, totalScore }]) => ({
      type,
      name: handTypeNames[type] || type,
      count,
      totalScore,
      countPercentage: maxCount > 0 ? (count / maxCount * 100) : 0,
      scorePercentage: maxScore > 0 ? (totalScore / maxScore * 100) : 0,
    }));

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-view-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-600/50 bg-slate-900/35 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <TrendingUp className="h-7 w-7 shrink-0 text-yellow-400 sm:h-8 sm:w-8" aria-hidden />
          <div className="min-w-0">
            <h2
              id="stats-view-title"
              className="text-2xl font-bold text-slate-100 sm:text-3xl"
            >
              游戏统计
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-400">
              总计 {totalHands} 手牌 · 累计收益 ${totalEarnings}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-700/80"
        >
          <X className="h-6 w-6 text-slate-400" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] sm:p-4">
          {/* 心电图组件 - 在统计界面顶端 */}
          <section className="mb-6 sm:mb-8">
            <div className="mb-4 w-full sm:mb-6">
              <EarningsChart records={chartRecords} handCount={chartHandCount} />
            </div>
          </section>

          {/* Best Hands */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <h3 className="text-2xl font-bold text-slate-100">最高收益记录 Top 5</h3>
            </div>
            {bestHands.length > 0 ? (
              <div className="space-y-3">
                {bestHands.map((hand, index) => (
                  <div
                    key={index}
                    className={clsx(
                      'flex items-center justify-between rounded-xl border p-4',
                      index === 0 &&
                        'border-yellow-500/40 bg-gradient-to-r from-yellow-500/15 to-orange-500/15',
                      index === 1 &&
                        'border-slate-500/40 bg-gradient-to-r from-slate-500/15 to-slate-600/15',
                      index === 2 &&
                        'border-orange-700/40 bg-gradient-to-r from-orange-800/15 to-orange-900/15',
                      index > 2 && 'border-slate-600/50 bg-slate-900/35'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                        index === 0 && "bg-yellow-500 text-black",
                        index === 1 && "bg-slate-400 text-black",
                        index === 2 && "bg-orange-700 text-white",
                        index > 2 && "bg-slate-600 text-white"
                      )}>
                        #{index + 1}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-100">{hand.name}</div>
                        <div className="text-sm text-slate-400">
                          基础倍率 x{hand.baseMultiplier}
                          {hand.bonusMultiplier > 0 && ` + 奖励 +${hand.bonusMultiplier}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-yellow-400">${hand.score}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500">
                <p>还没有记录，开始翻牌吧！</p>
              </div>
            )}
          </section>

          {/* Stats by Hand Type */}
          <section>
            <h3 className="text-2xl font-bold text-slate-100 mb-4">牌型统计</h3>
            {sortedStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-600/60">
                      <th className="text-left py-3 px-4 text-slate-300 font-semibold">牌型</th>
                      <th 
                        className="text-right py-3 px-4 text-slate-300 font-semibold cursor-pointer hover:bg-slate-700/30 transition-colors select-none"
                        onClick={() => handleSort('count')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>次数</span>
                          {sortField === 'count' ? (
                            sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 opacity-30" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-right py-3 px-4 text-slate-300 font-semibold cursor-pointer hover:bg-slate-700/30 transition-colors select-none"
                        onClick={() => handleSort('totalScore')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>收益总计</span>
                          {sortField === 'totalScore' ? (
                            sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 opacity-30" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.map(({ type, name, count, totalScore, countPercentage, scorePercentage }, index) => (
                      <tr 
                        key={type} 
                        className={clsx(
                          "border-b border-slate-700/50 transition-colors hover:bg-slate-700/30",
                          index % 2 === 0 && 'bg-slate-900/25'
                        )}
                      >
                        <td className="py-3 px-4">
                          <span className="text-slate-100 font-medium">{name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex-1 max-w-[100px] bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                                style={{ width: `${countPercentage}%` }}
                              />
                            </div>
                            <span className="text-slate-300 w-12 text-right">{count}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex-1 max-w-[100px] bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-500"
                                style={{ width: `${scorePercentage}%` }}
                              />
                            </div>
                            <span className="text-yellow-400 font-bold w-16 text-right">${totalScore}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600/60 bg-slate-900/40">
                      <td className="py-3 px-4 text-slate-100 font-bold">总计</td>
                      <td className="text-right py-3 px-4 text-slate-100 font-bold pr-16">{totalHands}</td>
                      <td className="text-right py-3 px-4 text-yellow-400 font-bold pr-20">${totalEarnings}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500">
                <p>还没有统计数据</p>
              </div>
            )}
          </section>
          
          {/* 重置游戏按钮 */}
          {onReset && (
            <div className="mt-6 border-t border-slate-600/50 pt-6 sm:mt-8 sm:pt-8">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('确定要重置游戏吗？这将清除所有进度和数据，包括金币、牌池、统计等。')) {
                    onReset();
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-600/15 py-3 font-semibold text-red-400 transition-colors hover:bg-red-600/25 sm:py-4"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>重置游戏</span>
              </button>
            </div>
          )}
      </div>
    </div>
  );
};
