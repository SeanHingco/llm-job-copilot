"use client";

type Props = {
  value: number;          // 0..100
  size?: number;          // px
  stroke?: number;        // px
  label?: string;
};

export default function PercentRing({ value, size = 64, stroke = 8, label }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="text-foreground"
          stroke="currentColor"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="text-primary"
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-foreground text-xs"
        >
          {pct}%
        </text>
      </svg>
      {label ? <span className="mt-1 text-xs text-foreground">{label}</span> : null}
    </div>
  );
}
