/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — کیت رابط کاربری
   ------------------------------------------------------------
   شامل: آیکون‌های SVG دست‌ساز، لوگوی NIPCO (بدون Hard-Code —
   با اولویت لوگوی آپلودی از Settings)، QR Code بصری، نمودارهای
   SVG سبک (Bar/Line/Donut/Spark)، مودال، سوئیچ، Toast و...
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { cx } from "../lib/utils";
import { useStore } from "../lib/store";
import type { ConnState } from "../lib/types";

/* ============================================================ آیکون‌ها */
const P: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>,
  clipboard: <><path d="M9 4h6M9 4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /><path d="m9 13.5 2 2 4-4.5" /></>,
  gauge: <><path d="M5 19a9 9 0 1 1 14 0" /><path d="m12 13 3.5-4.5" /><circle cx="12" cy="13" r="1.2" /></>,
  cog: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13.5 9 5 9-5" /></>,
  chart: <><path d="M5 20v-6M10 20V5M15 20v-9M20 20v-13" /><path d="M3 20h18" /></>,
  bell: <><path d="M6 9.5a6 6 0 1 1 12 0c0 4.5 1.8 5.8 1.8 5.8H4.2S6 14 6 9.5Z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>,
  list: <><path d="M8.5 6h12M8.5 12h12M8.5 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.4c2.4.7 4 2.7 4 5.6" /></>,
  sliders: <><path d="M6 21v-7M6 10V3M12 21v-9M12 8V3M18 21v-5M18 12V3" /><path d="M3.5 14h5M9.5 8h5M15.5 16h5" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20.5 14v.01M14 20.5v.01M17.5 17.5v.01M20.5 20.5v.01M20.5 17.5v.01M17.5 20.5v.01" /></>,
  scan: <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-3.8-3.8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <><path d="M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13" /><path d="M10 11v5.5M14 11v5.5" /></>,
  pen: <><path d="m4 20 1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1Z" /><path d="m14 7 3 3" /></>,
  download: <><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 21h16" /></>,
  printer: <><path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3" /><rect x="7" y="14" width="10" height="7" rx="1" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5L20 6.5" />,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  wifi: <><path d="M2.5 9.2a15 15 0 0 1 19 0M5.5 12.7a10.5 10.5 0 0 1 13 0M8.5 16.1a6 6 0 0 1 7 0" /><path d="M12 19.5v.01" /></>,
  wifioff: <><path d="m3 3 18 18M5.5 12.7a10.5 10.5 0 0 1 4.2-2.4M14.5 10.5c1.4.4 2.7 1.2 4 2.2M8.5 16.1a6 6 0 0 1 7 0M2.5 9.2a15 15 0 0 1 5.8-3.2M13.5 5.7a15 15 0 0 1 8 3.5" /><path d="M12 19.5v.01" /></>,
  refresh: <><path d="M20.5 11A8.6 8.6 0 1 0 21 14" /><path d="M21 4v7h-7" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.5 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  logout: <><path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" /><path d="M10 12h11m0 0-3.5-3.5M21 12l-3.5 3.5" /></>,
  key: <><circle cx="8" cy="15.5" r="4.5" /><path d="m11.5 12 8-8M18 5.5 20 7.5M15 8.5l2 2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="m3 3 18 18M10.5 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3 3.7M6.6 6.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  chevd: <path d="m6 9 6 6 6-6" />,
  chevs: <path d="m14 6-6 6 6 6" />,
  lock: <><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  factory: <><path d="M3 21V9.5l5.5 3.5V9.5l5.5 3.5V4h7v17H3Z" /><path d="M8 17.5h.01M12 17.5h.01M16 17.5h.01" /></>,
  zap: <path d="M13 2 4.5 13.5h6L9.5 22 19 10h-6l0-8Z" />,
  droplet: <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" />,
  thermo: <><path d="M10 4a2 2 0 0 1 4 0v9a4.5 4.5 0 1 1-4 0V4Z" /><path d="M12 9v7" /></>,
  filter: <path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />,
  shield: <><path d="M12 3 5 6v5.2c0 4.8 3.4 8.3 7 9.8 3.6-1.5 7-5 7-9.8V6l-7-3Z" /><path d="m9 12 2 2 4-4.5" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M9.5 13.5h5" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5v6.5c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V5.5M4 12v6.5c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V12" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></>,
  fan: <><circle cx="12" cy="12" r="1.6" /><path d="M12 10.4a4.2 4.2 0 0 0 4.2-4.2c0-1.7-1.9-2.7-3.4-1.6A4.2 4.2 0 0 0 12 10.4ZM13.6 12a4.2 4.2 0 0 0 4.2 4.2c1.7 0 2.7-1.9 1.6-3.4A4.2 4.2 0 0 0 13.6 12ZM12 13.6a4.2 4.2 0 0 0-4.2 4.2c0 1.7 1.9 2.7 3.4 1.6A4.2 4.2 0 0 0 12 13.6ZM10.4 12a4.2 4.2 0 0 0-4.2-4.2c-1.7 0-2.7 1.9-1.6 3.4A4.2 4.2 0 0 0 10.4 12Z" /></>,
  flame: <path d="M12 3s5.5 4.2 5.5 9.3a5.5 5.5 0 0 1-11 0c0-1.9.8-3.4 1.8-4.9.2 1.6 1 2.6 2.2 2.9-.6-2.3 0-5.3 1.5-7.3Z" />,
  press: <><path d="M4 21v-5h16v5M7 16v-3.5h10V16" /><path d="M12 12.5V9M8.5 9h7V4.5h-7V9Z" /></>,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" /><path d="M3.5 3.5v5h5M12 7.5v5l3.5 2" /></>,
  signal: <path d="M4.5 19.5v-3M9.5 19.5v-7M14.5 19.5V8M19.5 19.5V4.5" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7.5 9 6 9-6" /></>,
  message: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
  play: <path d="m7.5 4.5 12 7.5-12 7.5v-15Z" />,
  forklift: <><path d="M2.5 17V7.5H9l2 4.5h4v5" /><circle cx="6.5" cy="18.5" r="1.8" /><circle cx="13.5" cy="18.5" r="1.8" /><path d="M17.5 17V3.5h3V17M15 17h6" /></>,
  robot: <><rect x="5" y="8" width="14" height="10" rx="2" /><path d="M12 8V5.2M12 5.2a1.4 1.4 0 1 0-.01 0M9 12.2v.01M15 12.2v.01M9.5 15h5M3 11.5v3M21 11.5v3" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8Z" /><path d="M12 16.5V21" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.01" /></>,
};

export function Icon({ name, size = 18, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      {P[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

/* ============================================================ لوگوی NIPCO
   لوگوی پیش‌فرض یک دارایی سیستمی SVG است؛ اگر مدیر از
   Settings → Branding لوگویی آپلود کند، همان نمایش داده می‌شود. */
export function Logo({ size = 40, withText = true, light = false }: { size?: number; withText?: boolean; light?: boolean }) {
  const { db } = useStore();
  const custom = db.settings.logoDataUrl;
  if (custom) return <img src={custom} alt="NIPCO" style={{ height: size, maxWidth: size * 3.2, objectFit: "contain" }} />;
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <path d="M32 4 56 18v28L32 60 8 46V18Z" fill="var(--acc)" />
        <path d="M32 10 51 21v22L32 54 13 43V21Z" fill="none" stroke="var(--acc-ink)" strokeOpacity="0.35" strokeWidth="2" />
        <path d="M21 44V21l11 14V21h11v23H32L21 30v14Z" fill="var(--acc-ink)" />
      </svg>
      {withText && (
        <span className="leading-none">
          <span className={cx("font-display block", light ? "text-white" : "")} style={{ fontSize: size * 0.62, color: light ? "#fff" : "var(--ink)" }}>NIPCO</span>
          <span className="block font-bold" style={{ fontSize: size * 0.21, color: light ? "rgba(255,255,255,.65)" : "var(--muted)" }}>کنترل روزانه تجهیزات</span>
        </span>
      )}
    </span>
  );
}

/* ============================================================ QR Code بصری
   ماتریس قطعی ۲۱×۲۱ از روی کد تجهیز — در نسخه Production با
   کتابخانه QR واقعی جایگزین می‌شود؛ الگو فعلاً برای چاپ لیبل کافی است. */
export function PseudoQR({ value, size = 120 }: { value: string; size?: number }) {
  const n = 21;
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  const cells: boolean[] = [];
  let x = h >>> 0;
  for (let i = 0; i < n * n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; cells.push(x % 100 < 46); }
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const finderOn = (r: number, c: number) => {
    const rr = r >= n - 7 ? r - (n - 7) : r, cc = c >= n - 7 ? c - (n - 7) : c;
    return rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
  };
  const s = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md bg-white" aria-label={`QR ${value}`}>
      {cells.map((on, i) => {
        const r = Math.floor(i / n), c = i % n;
        const v = finder(r, c) ? finderOn(r, c) : on;
        return v ? <rect key={i} x={c * s} y={r * s} width={s + 0.3} height={s + 0.3} fill="#10161f" /> : null;
      })}
    </svg>
  );
}

/* ============================================================ مودال */
export function Modal({ title, onClose, children, footer, w = 520, icon }: {
  title: ReactNode; onClose?: () => void; children: ReactNode; footer?: ReactNode; w?: number; icon?: string;
}) {
  return (
    <div className="modal-mask fade-in no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal-card pop-in" style={{ maxWidth: w }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--line)" }}>
          <h3 className="font-bold text-[15px] flex items-center gap-2">
            {icon && <Icon name={icon} size={18} className="opacity-70" />}{title}
          </h3>
          {onClose && <button className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="بستن"><Icon name="x" size={16} /></button>}
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t flex justify-end gap-2" style={{ borderColor: "var(--line)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ============================================================ سوئیچ و Segmented */
export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" className={cx("sw", on && "on")} disabled={disabled} onClick={() => onChange(!on)} role="switch" aria-checked={on} />;
}

export function Seg<T extends string>({ options, value, onChange, size = "md" }: {
  options: { v: T; label: ReactNode; icon?: string }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex p-1 rounded-[10px] gap-1 panel2 border" style={{ borderColor: "var(--line)" }}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cx("rounded-lg font-bold transition-all flex items-center gap-1.5",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
            value === o.v ? "shadow-sm" : "opacity-55 hover:opacity-90")}
          style={value === o.v ? { background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)" } : { border: "1px solid transparent" }}>
          {o.icon && <Icon name={o.icon} size={size === "sm" ? 13 : 15} />}{o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================ نمودارهای SVG سبک */
export function BarChart({ data, h = 150, color }: { data: { label: string; value: number; color?: string }[]; h?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 w-full" style={{ height: h }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end group" title={`${d.label}: ${d.value}`}>
          <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--muted)" }}>{d.value.toLocaleString("fa-IR")}</span>
          <div className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-80"
            style={{ height: `${Math.max(3, (d.value / max) * (h - 48))}px`, background: d.color ?? color ?? "var(--acc)", minHeight: 3 }} />
          <span className="text-[10px] font-semibold truncate w-full text-center" style={{ color: "var(--muted)" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ points, labels, h = 150, color = "var(--acc)", suffix = "" }: {
  points: number[]; labels?: string[]; h?: number; color?: string; suffix?: string;
}) {
  const w = 300;
  const max = Math.max(1, ...points), min = Math.min(0, ...points);
  const span = max - min || 1;
  const n = points.length || 1;
  /* در RTL قدیمی‌ترین نقطه سمت راست است */
  const X = (i: number) => w - 8 - (i / (n - 1 || 1)) * (w - 16);
  const Y = (v: number) => h - 18 - ((v - min) / span) * (h - 34);
  const path = points.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${X(n - 1).toFixed(1)},${h - 14} L${X(0).toFixed(1)},${h - 14} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="8" x2={w - 8} y1={14 + f * (h - 34)} y2={14 + f * (h - 34)} stroke="var(--line)" strokeDasharray="3 4" strokeWidth="1" />)}
        <path d={area} fill={color} opacity="0.12" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="3" fill="var(--panel)" stroke={color} strokeWidth="2"><title>{`${labels?.[i] ?? ""}: ${v.toLocaleString("fa-IR")}${suffix}`}</title></circle>)}
      </svg>
      {labels && (
        <div className="flex justify-between text-[10px] font-semibold px-1" style={{ color: "var(--muted)" }}>
          <span>{labels[labels.length - 1]}</span><span>{labels[Math.floor(labels.length / 2)]}</span><span>{labels[0]}</span>
        </div>
      )}
    </div>
  );
}

export function Donut({ parts, size = 130, thick = 16, centerLabel }: {
  parts: { value: number; color: string; label: string }[]; size?: number; thick?: number; centerLabel?: ReactNode;
}) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const r = (size - thick) / 2, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative inline-block">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel2)" strokeWidth={thick} />
        {parts.map((p, i) => {
          const len = (p.value / total) * C;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thick}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt">
              <title>{`${p.label}: ${p.value.toLocaleString("fa-IR")}`}</title>
            </circle>
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{centerLabel}</div>
    </div>
  );
}

export function Spark({ points, w = 90, h = 28, color = "var(--acc)" }: { points: number[]; w?: number; h?: number; color?: string }) {
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const span = max - min || 1;
  const d = points.map((v, i) => `${i ? "L" : "M"}${(w - (i / (points.length - 1 || 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} className="ltr"><path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

/* ============================================================ متفرقه */
export function Empty({ icon = "box", title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 panel2 border" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <Icon name={icon} size={26} />
      </div>
      <p className="font-bold text-[15px]">{title}</p>
      {sub && <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}

/* Scroll Reveal — نمایش تدریجی هنگام اسکرول */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); ob.disconnect(); } }, { threshold: 0.08 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return <div ref={ref} className={cx("reveal", vis && "vis", className)} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* نشان وضعیت اتصال دستگاه */
export function ConnBadge({ state }: { state: ConnState }) {
  const map: Record<ConnState, [string, string]> = {
    connected: ["b-ok", "متصل"], disconnected: ["b-mut", "قطع"], timeout: ["b-acc", "Timeout"],
    error: ["b-nok", "خطا"], unknown: ["b-mut", "نامشخص"],
  };
  const [cls, txt] = map[state];
  return <span className={cx("badge", cls)}><span className={cx("w-1.5 h-1.5 rounded-full", state === "connected" && "blink")} style={{ background: "currentColor" }} />{txt}</span>;
}

/* میزبان Toastها */
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const colors: Record<string, string> = { ok: "var(--ok)", err: "var(--nok)", warn: "var(--amber)", info: "var(--info)" };
  const icons: Record<string, string> = { ok: "check", err: "alert", warn: "alert", info: "info" };
  return (
    <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 max-w-[92vw] no-print" dir="rtl">
      {toasts.map((t) => (
        <div key={t.id} className="pop-in flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl border cursor-pointer text-[13px] font-semibold min-w-[260px]"
          style={{ background: "var(--panel)", borderColor: colors[t.type] }}
          onClick={() => dismissToast(t.id)}>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: colors[t.type], color: "#fff" }}>
            <Icon name={icons[t.type]} size={15} />
          </span>
          <span className="flex-1">{t.msg}</span>
          <span className="relative h-0.5 w-10 rounded overflow-hidden opacity-40" style={{ background: colors[t.type] }}>
            <i className="absolute inset-y-0 right-0 block" style={{ background: colors[t.type], animation: "toastBar 4.2s linear forwards" }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* کارت آمار داشبورد با انیمیشن شمارش */
export function CountUp({ value, frac = 0 }: { value: number; frac?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{v.toLocaleString("fa-IR", { maximumFractionDigits: frac })}</>;
}
