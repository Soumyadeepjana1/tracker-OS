import { useMemo } from 'react';
import type { HeatmapCell } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { formatDate, fromISODate, monthLabel } from '@/lib/date';
import { EmptyState } from '@/components/ui/primitives';
import { IconChart } from '@/components/icons';

/** Chart palette — fixed hues that read well on both the dark and light themes. */
export const CHART_COLORS = [
  '#6d5efc',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#60a5fa',
  '#f472b6',
  '#a78bfa',
  '#2dd4bf',
  '#fb923c',
];

export interface ChartPoint {
  label: string;
  value: number;
}

const BAR_TONES = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
} as const;

const HEAT_ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

/* -------------------------------- bar chart ------------------------------ */

export function BarChart({
  data,
  height = 180,
  unit = 'h',
  tone = 'brand',
  className,
  emptyLabel = 'No data yet',
}: {
  data: ChartPoint[];
  height?: number;
  unit?: string;
  tone?: 'brand' | 'accent' | 'ok' | 'warn';
  className?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  if (!data.length) {
    return <EmptyState title={emptyLabel} description="Log a study session to populate this chart." icon={<IconChart size={20} />} />;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative" style={{ height }}>
        {gridLines.map((ratio) => (
          <div
            key={ratio}
            className="absolute inset-x-0 border-t border-dashed border-line/70"
            style={{ bottom: `${ratio * 88}%` }}
          >
            <span className="absolute -top-2 right-0 bg-surface px-1 font-mono text-[9.5px] text-fg-subtle">
              {(max * ratio).toFixed(max < 4 ? 1 : 0)}
              {unit}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {data.map((point, index) => {
            const percent = (point.value / max) * 88;
            return (
              <div key={`${point.label}-${index}`} className="group relative flex h-full flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-[4px] transition-all duration-500 ease-out',
                    BAR_TONES[tone],
                    point.value === 0 && 'bg-surface-3',
                  )}
                  style={{ height: `${Math.max(point.value > 0 ? 3 : 2, percent)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] shadow-pop group-hover:block">
                  <span className="font-semibold text-fg">{point.value}</span>
                  <span className="text-fg-muted">
                    {unit} · {point.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-[3px]">
        {data.map((point, index) => (
          <span
            key={`${point.label}-label-${index}`}
            className="flex-1 truncate text-center font-mono text-[9.5px] text-fg-subtle"
          >
            {index % 2 === 0 ? point.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- area chart ------------------------------ */

export function AreaChart({
  data,
  height = 120,
  color = CHART_COLORS[0],
  unit = 'h',
  className,
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  unit?: string;
  className?: string;
}) {
  const geometry = useMemo(() => {
    if (data.length < 2) return null;
    const width = 300;
    const chartHeight = 100;
    const max = Math.max(1, ...data.map((point) => point.value));
    const step = width / (data.length - 1);
    const points = data.map((point, index) => ({
      x: index * step,
      y: chartHeight - (point.value / max) * (chartHeight - 10) - 4,
      point,
    }));
    const line = points.map((entry, index) => `${index === 0 ? 'M' : 'L'}${entry.x.toFixed(2)},${entry.y.toFixed(2)}`).join(' ');
    const area = `${line} L${width},${chartHeight} L0,${chartHeight} Z`;
    return { line, area, points, max };
  }, [data]);

  if (!geometry) {
    return <EmptyState title="Not enough data" description="At least two data points are needed for a trend." icon={<IconChart size={20} />} />;
  }

  const gradientId = `area-${color.replace('#', '')}`;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative w-full" style={{ height }}>
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.36" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="var(--line)" strokeWidth="0.6" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {geometry.points.map((entry, index) => (
            <circle
              key={index}
              cx={entry.x}
              cy={entry.y}
              r="1.6"
              fill={color}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${entry.point.label}: ${entry.point.value}${unit}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="flex justify-between font-mono text-[9.5px] text-fg-subtle">
        {data.map((point, index) =>
          index % Math.ceil(data.length / 7) === 0 || index === data.length - 1 ? (
            <span key={`${point.label}-${index}`}>{point.label}</span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/* ------------------------------- donut chart ----------------------------- */

export function DonutChart({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
  className,
  legendClassName,
}: {
  segments: { label: string; value: number }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
  legendClassName?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={thickness} className="stroke-surface-3" />
          {total > 0 &&
            segments.map((segment, index) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const element = (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={thickness}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${segment.label}: ${segment.value}`}</title>
                </circle>
              );
              offset += dash;
              return element;
            })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue ? <span className="font-mono text-xl font-semibold text-fg">{centerValue}</span> : null}
            {centerLabel ? <span className="text-[10.5px] text-fg-muted">{centerLabel}</span> : null}
          </div>
        )}
      </div>
      <ul className={cn('flex min-w-40 flex-1 flex-col gap-2', legendClassName)}>
        {segments.map((segment, index) => (
          <li key={segment.label} className="flex items-center gap-2.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-fg-muted">{segment.label}</span>
            <span className="font-mono text-[11px] font-medium text-fg">{segment.value}</span>
          </li>
        ))}
        {!segments.length ? <li className="text-xs text-fg-subtle">No data yet.</li> : null}
      </ul>
    </div>
  );
}

/* --------------------------------- heatmap ------------------------------- */

const HEAT_LEVELS = [
  'bg-surface-3',
  'bg-ok/25',
  'bg-ok/45',
  'bg-ok/70',
  'bg-ok',
];

export function ActivityHeatmap({
  cells,
  className,
  cellSize = 12,
}: {
  cells: HeatmapCell[];
  className?: string;
  cellSize?: number;
}) {
  const columns = useMemo(() => {
    const result: HeatmapCell[][] = [];
    cells.forEach((cell, index) => {
      const column = Math.floor(index / 7);
      (result[column] ||= []).push(cell);
    });
    return result;
  }, [cells]);

  const monthMarkers = useMemo(() => {
    return columns.map((column, index) => {
      const first = column[0];
      if (!first) return null;
      const previous = columns[index - 1]?.[0];
      const currentMonth = fromISODate(first.date).getMonth();
      const previousMonth = previous ? fromISODate(previous.date).getMonth() : -1;
      return currentMonth !== previousMonth ? monthLabel(first.date) : null;
    });
  }, [columns]);

  const totalMinutes = cells.reduce((sum, cell) => sum + cell.minutes, 0);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex flex-col gap-[3px] pt-3">
          {HEAT_ROW_LABELS.map((day, row) => (
            <span
              key={row}
              className="flex items-center justify-end pr-1 font-mono text-[9px] text-fg-subtle"
              style={{ height: cellSize }}
            >
              {day}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-[3px]">
          <div className="flex gap-[3px]">
            {monthMarkers.map((marker, index) => (
              <span
                key={index}
                className="font-mono text-[9px] text-fg-subtle"
                style={{ width: cellSize, minWidth: cellSize }}
              >
                {marker ?? ''}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((column, columnIndex) => (
              <div key={columnIndex} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, rowIndex) => {
                  const cell = column[rowIndex];
                  if (!cell) {
                    return <span key={rowIndex} style={{ width: cellSize, height: cellSize }} />;
                  }
                  return (
                    <span
                      key={rowIndex}
                      title={`${formatDate(cell.date, 'long')} · ${cell.minutes} min · ${cell.tasks} task(s) completed`}
                      className={cn('rounded-[3px] transition-transform hover:scale-125', HEAT_LEVELS[cell.level])}
                      style={{ width: cellSize, height: cellSize }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
        <span className="text-[11px] text-fg-muted">
          {Math.round(totalMinutes / 60)} hours logged in the last {columns.length} weeks
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] text-fg-subtle">Less</span>
          {HEAT_LEVELS.map((level, index) => (
            <span
              key={level}
              className={cn('h-2.5 w-2.5 rounded-[3px]', level)}
              title={['No activity', '< 30 min', '30-60 min', '1-2.5 h', '2.5 h+'][index]}
            />
          ))}
          <span className="text-[10.5px] text-fg-subtle">More</span>
        </div>
      </div>
    </div>
  );
}
