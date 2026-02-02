import React, { useMemo, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface EarningsChartProps {
  records: number[];
  handCount: number;
}

const INITIAL_POINTS = 40; // 初始40格

export const EarningsChart: React.FC<EarningsChartProps> = ({ records, handCount }) => {
  // 计算点位分布
  const points = useMemo(() => {
    
    if (handCount <= INITIAL_POINTS) {
      // 前 40 手：1:1 映射
      return records.map((score, index) => ({
        x: index,
        y: score,
        handIndex: index + 1
      }));
    } else {
      // 第 41 手开始：滑动窗口，保留最后 40 手
      const last40Records = records.slice(-INITIAL_POINTS);
      return last40Records.map((score, index) => ({
        x: index, // x: 0, 1, 2, ..., 39（始终是 40 个点）
        y: score,
        handIndex: handCount - INITIAL_POINTS + index + 1 // handIndex: 从 (handCount-39) 到 handCount
      }));
    }
  }, [records, handCount]);

  // 计算动态 Y 轴范围（基于实际显示的 points）
  const { yMin, yMax } = useMemo(() => {
    if (points.length === 0) {
      return { yMin: 0, yMax: 100 };
    }
    
    // 基于实际显示的点来计算y轴范围
    const scores = points.map(p => p.y);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;
    const padding = Math.max(range * 0.1, 10); // 10% 上下边距，最少10
    
    return {
      yMin: Math.max(0, minScore - padding),
      yMax: maxScore + padding
    };
  }, [points]);

  // SVG 尺寸
  const width = 100;
  const height = 60;
  const padding = { top: 5, right: 5, bottom: 5, left: 5 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // 计算实际像素尺寸（用于绘制不拉伸的圆点）
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelSize, setPixelSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updatePixelSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setPixelSize({ width: rect.width, height: rect.height });
        }
      }
    };
    
    // 初始计算
    updatePixelSize();
    
    // 当点数变化时，使用 requestAnimationFrame 确保 DOM 已更新
    const rafId = requestAnimationFrame(() => {
      updatePixelSize();
    });
    
    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      updatePixelSize();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    const handleResize = () => {
      updatePixelSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [points.length]); // 当点数变化时重新计算

  // 生成折线路径
  const pathData = useMemo(() => {
    if (points.length === 0) return '';
    
    // 根据当前阶段确定最大x值用于归一化（始终是 40 个点，x 从 0 到 39）
    const maxX = INITIAL_POINTS - 1; // 始终是 39
    
    return points.map((point, index) => {
      const x = padding.left + (point.x / Math.max(1, maxX)) * chartWidth;
      const y = padding.top + chartHeight - ((point.y - yMin) / Math.max(1, yMax - yMin)) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  }, [points, yMin, yMax, chartWidth, chartHeight, padding, handCount]);

  // 生成网格线
  const gridLines = useMemo(() => {
    const lines = [];
    const gridCount = 3; // 3条水平网格线
    
    for (let i = 0; i <= gridCount; i++) {
      const y = padding.top + (i / gridCount) * chartHeight;
      const value = yMax - (i / gridCount) * (yMax - yMin);
      lines.push({ y, value });
    }
    
    return lines;
  }, [yMin, yMax, chartHeight, padding]);

  if (records.length === 0) {
    return (
      <div className="w-full max-w-6xl h-20 sm:h-24 flex items-center justify-center bg-slate-800/30 rounded-lg border border-slate-700/50">
        <p className="text-slate-500 text-xs sm:text-sm">开始翻牌后显示收益曲线</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl h-20 sm:h-24 bg-slate-800/30 rounded-lg border border-slate-700/50 p-2 sm:p-3">
      <div ref={containerRef} className="relative w-full h-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* 网格线 */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          
          {gridLines.map((line, index) => (
            <line
              key={index}
              x1={padding.left}
              y1={line.y}
              x2={width - padding.right}
              y2={line.y}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="0.5"
              strokeDasharray="1,1"
            />
          ))}

          {/* 折线 */}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        
        {/* 数据点 - 使用绝对定位的div确保圆形不拉伸 */}
        {pixelSize.width > 0 && pixelSize.height > 0 && points.map((point, index) => {
          // 根据当前阶段确定最大x值用于归一化（始终是 40 个点，x 从 0 到 39）
          const maxX = INITIAL_POINTS - 1; // 始终是 39
          
          // 计算在viewBox中的坐标
          const viewBoxX = padding.left + (point.x / Math.max(1, maxX)) * chartWidth;
          const viewBoxY = padding.top + chartHeight - ((point.y - yMin) / Math.max(1, yMax - yMin)) * chartHeight;
          
          // 转换为实际像素坐标
          const pixelX = (viewBoxX / width) * pixelSize.width;
          const pixelY = (viewBoxY / height) * pixelSize.height;
          
          const isLastPoint = index === points.length - 1;
          
          return (
            <div
              key={index}
              className={clsx(
                "absolute rounded-full",
                isLastPoint 
                  ? "bg-orange-400 opacity-100 animate-ecg-glow" 
                  : "bg-orange-500 opacity-80"
              )}
              style={{
                left: `${pixelX}px`,
                top: `${pixelY}px`,
                width: isLastPoint ? '8px' : '5px',
                height: isLastPoint ? '8px' : '5px',
                transform: 'translate(-50%, -50%)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

