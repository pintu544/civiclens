import { severityColor, severityLabel } from '@/lib/utils';

/** 1–5 severity meter with label. */
export function SeverityMeter({
  severity,
  size = 'md',
}: {
  severity: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color = severityColor(severity);
  const seg = size === 'sm' ? 'h-1.5 w-6' : size === 'lg' ? 'h-3 w-12' : 'h-2 w-8';
  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex items-center gap-1" role="img" aria-label={`Severity ${severity} of 5: ${severityLabel(severity)}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`${seg} rounded-full ${i <= severity ? '' : 'bg-slate-200'}`}
            style={i <= severity ? { backgroundColor: color } : undefined}
          />
        ))}
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {severity}/5 · {severityLabel(severity)}
      </span>
    </div>
  );
}
