import type { SVGProps } from 'react';

type Point = { value: number | null };
type Tone = 'good' | 'bad' | 'warn' | 'accent' | 'neutral';

type MiniSparklineProps = {
  points: Point[];
  tone?: Tone;
  height?: number;
  maxPoints?: number;
  label?: string;
} & Omit<SVGProps<SVGSVGElement>, 'height' | 'points'>;

const TONE_COLOR: Record<Tone, string> = {
  good: '#16a368',
  bad: '#ef4452',
  warn: '#f29423',
  accent: '#3182f6',
  neutral: '#64748b',
};

export function MiniSparkline({
  points,
  tone = 'accent',
  height = 32,
  maxPoints = 36,
  label = 'mini trend',
  className,
  ...svgProps
}: MiniSparklineProps) {
  const values = points.map((point) => point.value).filter((value): value is number => Number.isFinite(value));
  if (values.length < 2) {
    return <div className="h-8 rounded-xl bg-slate-100/70" aria-label={`${label}: insufficient data`} />;
  }

  const step = Math.max(1, Math.floor(values.length / maxPoints));
  const sampled = values.filter((_, index) => index % step === 0).slice(-maxPoints);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  const innerHeight = Math.max(12, height - 4);
  const d = sampled
    .map((value, index) => {
      const x = (index / Math.max(1, sampled.length - 1)) * 100;
      const y = height - 2 - ((value - min) / span) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`;
    })
    .join(' ');
  const color = TONE_COLOR[tone];

  return (
    <svg
      className={className ?? 'h-8 w-full overflow-visible'}
      viewBox={`0 0 100 ${height}`}
      role="img"
      aria-label={label}
      {...svgProps}
    >
      <path d={`${d} L 100 ${height} L 0 ${height} Z`} fill={color} fillOpacity="0.08" stroke="none" />
      <path d={d} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function round(value: number): string {
  return value.toFixed(2);
}
