'use client';

import { CATEGORIES, CATEGORY_COLOR, STATUS_COLOR, STATUS_LABEL } from '@/lib/constants';
import type { Category, Status } from '@/lib/constants';

/** Horizontal bar chart of reports per category. Pure SVG. */
export function CategoryBarChart({ byCategory }: { byCategory: Record<Category, number> }) {
  const rows = CATEGORIES.map((c) => ({ ...c, count: byCategory[c.id] ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));
  const barH = 22;
  const gap = 14;
  const labelW = 150;
  const valueW = 40;
  const width = 560;
  const chartW = width - labelW - valueW;
  const height = rows.length * (barH + gap) + gap;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[480px] w-full"
        role="img"
        aria-label="Reports by category bar chart"
      >
        {rows.map((r, i) => {
          const y = gap + i * (barH + gap);
          const w = Math.max(r.count > 0 ? 8 : 0, (r.count / max) * chartW);
          return (
            <g key={r.id}>
              <text x={0} y={y + barH / 2 + 4} fontSize={12} fontWeight={600} fill="#475569">
                {r.label.length > 20 ? r.label.slice(0, 19) + '…' : r.label}
              </text>
              <rect x={labelW} y={y} width={chartW} height={barH} rx={6} fill="#f1f5f9" />
              <rect
                x={labelW}
                y={y}
                width={w}
                height={barH}
                rx={6}
                fill={CATEGORY_COLOR[r.id]}
                opacity={0.85}
              >
                <title>{`${r.label}: ${r.count} reports`}</title>
              </rect>
              <text x={labelW + chartW + 10} y={y + barH / 2 + 4} fontSize={12} fontWeight={700} fill="#0f172a">
                {r.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Donut chart of reports by status. Pure SVG. */
export function StatusDonut({ byStatus }: { byStatus: Record<Status, number> }) {
  const order: Status[] = ['reported', 'acknowledged', 'in_progress', 'resolved'];
  const total = order.reduce((s, st) => s + (byStatus[st] ?? 0), 0);
  const size = 220;
  const r = 80;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 30;

  let acc = 0;
  const segs = order.map((st) => {
    const value = byStatus[st] ?? 0;
    const frac = total > 0 ? value / total : 0;
    const seg = { st, value, start: acc, frac };
    acc += frac;
    return seg;
  });

  const arc = (startFrac: number, frac: number) => {
    if (frac <= 0) return '';
    if (frac >= 1) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
    }
    const a0 = startFrac * Math.PI * 2 - Math.PI / 2;
    const a1 = (startFrac + frac) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-52 w-52 shrink-0" role="img" aria-label="Reports by status donut chart">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segs.map((s) =>
          s.frac > 0 ? (
            <path
              key={s.st}
              d={arc(s.start, s.frac)}
              fill="none"
              stroke={STATUS_COLOR[s.st]}
              strokeWidth={stroke}
              strokeLinecap="butt"
            >
              <title>{`${STATUS_LABEL[s.st]}: ${s.value}`}</title>
            </path>
          ) : null,
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={30} fontWeight={800} fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={12} fontWeight={500} fill="#64748b">
          reports
        </text>
      </svg>
      <ul className="w-full space-y-2.5 sm:w-auto">
        {order.map((st) => {
          const value = byStatus[st] ?? 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <li key={st} className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLOR[st] }} aria-hidden="true" />
              <span className="font-semibold text-slate-700">{STATUS_LABEL[st]}</span>
              <span className="ml-auto pl-6 font-bold text-slate-900 tabular-nums">
                {value} <span className="font-medium text-slate-400">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
