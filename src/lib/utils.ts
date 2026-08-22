/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — توابع کمکی
   ------------------------------------------------------------
   شامل: شناسه یکتا، اعداد و تاریخ فارسی (شمسی)، تشخیص شیفت
   فعلی با مدیریت شیفت شب (عبور از مرز روز)، هش رمز عبور،
   خروجی CSV/فایل و RNG قطعی برای داده‌های نمونه.
   ============================================================ */

import type { Shift } from "./types";

/* شناسه یکتا — سمت کلاینت تولید می‌شود تا در Sync آفلاین،
   از ثبت تکراری (Duplicate) جلوگیری شود. */
export function uid(): string {
  try { return crypto.randomUUID(); }
  catch { return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/* ---------- اعداد فارسی ---------- */
const FA = "۰۱۲۳۴۵۶۷۸۹";
export function faDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => FA[+d]);
}
export function faNum(n: number | string, maxFrac = 0): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "—";
  return faDigits(num.toLocaleString("en-US", { maximumFractionDigits: maxFrac }));
}
/* ساعت کارکرد — همیشه با ۱ رقم اعشار، بدون سقف */
export function faOH(n: number): string { return faNum(n, 1); }

/* ---------- تاریخ شمسی با Intl (بدون کتابخانه) ---------- */
const dFmt = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
const dFmtLong = new Intl.DateTimeFormat("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const tFmt = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" });

export function faDate(iso: string | Date): string { return dFmt.format(new Date(iso)); }
export function faDateLong(iso: string | Date): string { return dFmtLong.format(new Date(iso)); }
export function faTime(iso: string | Date): string { return tFmt.format(new Date(iso)); }

/* تاریخ شمسی امروز به‌صورت yyyy/mm/dd — مبنای گروه‌بندی کنترل‌های روزانه */
export function pdToday(d: Date = new Date()): string {
  const parts: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) parts[p.type] = p.value;
  return `${parts.year}/${parts.month}/${parts.day}`;
}
export function pdShift(d: Date, offsetDays: number): string {
  const x = new Date(d); x.setDate(x.getDate() + offsetDays); return pdToday(x);
}
export function pdParts(pdate: string): { y: number; m: number; d: number } {
  const [y, m, d] = pdate.split("/").map(Number); return { y, m, d };
}

/* ---------- زمان و شیفت ---------- */
export function hmNow(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toMin(hm: string): number { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }

/* تشخیص شیفت فعلی — شیفت شب (22:00 تا 06:00) از مرز روز عبور می‌کند
   و با شرط «شروع > پایان» به‌درستی مدیریت می‌شود. */
export function currentShift(shifts: Shift[], d: Date = new Date()): Shift | undefined {
  const now = toMin(hmNow(d));
  const active = shifts.filter((s) => s.active);
  for (const s of active) {
    const st = toMin(s.start), en = toMin(s.end);
    const overnight = st > en;
    if (!overnight ? now >= st && now < en : now >= st || now < en) return s;
  }
  return active[0];
}
/* برای شیفت شب که از مرز روز عبور می‌کند، تاریخ کاری = روز شروع شیفت */
export function shiftWorkDate(shift: Shift | undefined, d: Date = new Date()): string {
  if (shift && toMin(shift.start) > toMin(shift.end) && d.getHours() < 12) return pdShift(d, -1);
  return pdToday(d);
}

/* زمان نسبی فارسی — «۵ دقیقه پیش» */
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "همین حالا";
  if (s < 3600) return `${faNum(Math.round(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${faNum(Math.round(s / 3600))} ساعت پیش`;
  return `${faNum(Math.round(s / 86400))} روز پیش`;
}

/* ---------- امنیت ----------
   هش نمایشی سمت کلاینت (Salted). در نسخه Production این عملیات
   فقط در Backend با bcrypt/Argon2 انجام می‌شود؛ اینجا صرفاً برای
   دموی کامل چرخه Login است. */
export function hashPw(username: string, pw: string): string {
  let h = 5381;
  const s = `${username}§nipco§${pw}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "h" + (h >>> 0).toString(36) + "." + s.length.toString(36);
}

/* ---------- خروجی فایل / CSV ---------- */
export function download(name: string, content: string, mime = "text/plain"): void {
  const blob = new Blob(["\uFEFF" + content], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

/* ---------- RNG قطعی برای داده‌های نمونه ---------- */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick<T>(r: () => number, arr: T[]): T { return arr[Math.floor(r() * arr.length)]; }

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(" ");

export function clamp(n: number, min?: number, max?: number): boolean {
  if (min !== undefined && n < min) return false;
  if (max !== undefined && n > max) return false;
  return true;
}
