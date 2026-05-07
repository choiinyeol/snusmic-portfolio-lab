type SparkPoint = { x: number; y: number };

export function Sparkline({
  values,
  width = 160,
  height = 48,
  tone = 'accent',
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: 'accent' | 'good' | 'bad';
}) {
  if (!values.length) return <div className="sparkline sparkline--empty" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / Math.max(1, values.length - 1);
  const points: SparkPoint[] = values.map((value, index) => ({
    x: index * stepX,
    y: height - ((value - min) / span) * height,
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
  const last = points[points.length - 1];
  const fillPath = `${path} L${last.x.toFixed(2)},${height} L0,${height} Z`;
  return (
    <svg
      className={`sparkline sparkline--${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path className="sparkline__fill" d={fillPath} />
      <path className="sparkline__stroke" d={path} />
      <circle cx={last.x} cy={last.y} r={2.5} className="sparkline__dot" />
    </svg>
  );
}
