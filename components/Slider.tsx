"use client";

import { useEffect, useState } from "react";

export function NumberSlider({
  min,
  max,
  step = 1,
  unitPrefix,
  unitSuffix,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  step?: number;
  unitPrefix?: string;
  unitSuffix?: string;
  value: number | null;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const initial = value ?? Math.round((min + max) / 2);
  const [internal, setInternal] = useState<number>(initial);

  useEffect(() => {
    if (value !== null && value !== undefined) setInternal(value);
  }, [value]);

  const pct = ((internal - min) / (max - min)) * 100;
  const formatted = formatNumber(internal);

  function handle(next: number) {
    setInternal(next);
    onChange(next);
  }

  const sliderStyle = { ["--pct" as string]: `${pct}%` } as React.CSSProperties;

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="font-display text-4xl tabular-nums">
          {unitPrefix}
          {formatted}
          {unitSuffix ? ` ${unitSuffix}` : ""}
        </p>
      </div>
      <input
        type="range"
        className="phil-slider"
        min={min}
        max={max}
        step={step}
        value={internal}
        disabled={disabled}
        style={sliderStyle}
        onChange={(e) => handle(Number(e.target.value))}
      />
      <div className="flex justify-between text-xs text-black/50 tabular-nums">
        <span>
          {unitPrefix}
          {compact(min)}
        </span>
        <span>
          {unitPrefix}
          {compact(max)}
        </span>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString();
  }
  return String(Math.round(n));
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
