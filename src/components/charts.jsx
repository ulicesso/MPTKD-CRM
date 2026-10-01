/*
 * Small SVG charts. No chart library: these are a few dozen lines each and
 * follow the same look as the tuition dashboard. Colors come from the
 * validated --s1..--s3 categorical slots (see docs/DESIGN.md).
 */
import { useState } from "react";

/* ---------- tooltip ---------- */
export function useTip() {
  const [tip, setTip] = useState(null);
  const show = (html, e) => setTip({ html, x: e.clientX, y: e.clientY });
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 200), top: Math.max(8, tip.y + 14) }}>{tip.html}</div>
  ) : null;
  return { show, hide, node };
}

function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Grouped vertical bars, e.g. inquiries / prospects / signs per month.
 * series: [{ key, label, color }], rows: [{ label, [key]: number }]
 */
export function GroupedBars({ rows, series, height = 240, ariaLabel, format = (v) => v }) {
  const tip = useTip();
  const W = 720, H = height, L = 34, R = 8, T = 18, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] || 0))));
  const y = (v) => T + ih - (v / max) * ih;
  const step = iw / rows.length;
  const gap = 2;
  const bw = Math.min(16, (step * 0.72 - gap * (series.length - 1)) / series.length);
  const parts = max % 4 === 0 && max % 5 !== 0 ? 4 : 5; // keep tick labels whole numbers
  const ticks = Array.from({ length: parts + 1 }, (_, i) => (i / parts) * max);
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line className={i ? "grid" : "base"} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = L + step * i + step / 2;
          const groupW = series.length * bw + (series.length - 1) * gap;
          return (
            <g key={r.label}
              onMouseMove={(e) => tip.show(
                <>
                  <b>{r.full || r.label}</b>
                  {series.map((s) => <div className="rowx" key={s.key}><span><i className="sw" style={{ background: s.color }} /> {s.label}</span><b className="num">{format(r[s.key] || 0)}</b></div>)}
                </>, e)}
              onMouseLeave={tip.hide}>
              <rect x={cx - step / 2} y={T} width={step} height={ih} fill="transparent" />
              {series.map((s, j) => {
                const v = r[s.key] || 0;
                const x = cx - groupW / 2 + j * (bw + gap);
                const h = Math.max(0, y(0) - y(v));
                return h > 0 ? <path key={s.key} d={roundedTop(x, y(v), bw, h, Math.min(4, bw / 2, h))} fill={s.color} /> : null;
              })}
              <text x={cx} y={H - 9} textAnchor="middle">{r.label}</text>
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}

function roundedTop(x, y, w, h, r) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Horizontal bars with a value at the end. rows: [{ label, value, sub? }] */
export function HBars({ rows, color = "var(--s1)", format = (v) => v, max: maxIn, empty = "Nothing to show yet." }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const max = maxIn || Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbar">
      {rows.map((r) => (
        <div className="r" key={r.label}>
          <span title={r.sub}>{r.label}</span>
          <div className="track2" aria-hidden="true"><div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color || color }} /></div>
          <span className="v">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Inquiry → Lead → Prospect → Sign, with step conversion between bars. */
export function Funnel({ steps }) {
  const max = Math.max(1, steps[0]?.value || 1);
  return (
    <div className="funnel" role="img" aria-label={steps.map((s) => `${s.label}: ${s.value}`).join(", ")}>
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="step">
            <span className="name">{s.label}</span>
            <div className="bar" style={{ width: `${Math.max(8, (s.value / max) * 100)}%`, background: "var(--navy)", opacity: 1 - i * 0.16 }}>{s.value}</div>
          </div>
          {s.conv && <div className="step"><span /><span className="conv">{s.conv}</span></div>}
        </div>
      ))}
    </div>
  );
}

/** Stacked horizontal bar for a part-to-whole split (e.g. monthly vs PIF). */
export function SplitBar({ parts, height = 14 }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div style={{ display: "flex", gap: 2, height, borderRadius: 4, overflow: "hidden" }}>
      {parts.filter((p) => p.value).map((p) => (
        <div key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}
