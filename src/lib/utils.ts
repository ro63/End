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

/* ---------- تاریخ شمسی — الگوریتم تبدیل میلادی↔جلالی (بدون کتابخانه) ----------
   همه تقویم‌های سامانه (انتخابگر تاریخ، گزارش‌ها، فیلترها) با همین
   توابع کار می‌کنند تا تاریخ‌ها همیشه شمسی باشند. */
const idiv = (a: number, b: number) => ~~(a / b);
const imod = (a: number, b: number) => a - ~~(a / b) * b;
function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ += idiv(jump, 33) * 8 + idiv(imod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += idiv(n, 33) * 8 + idiv(imod(n, 33) + 3, 4);
  if (imod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = idiv(gy, 4) - idiv((idiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + idiv(jump + 4, 33) * 33;
  let leap = imod(imod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d = idiv((gy + idiv(gm - 8, 6) + 100100) * 1461, 4) + idiv(153 * imod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - idiv(idiv(gy + 100100 + idiv(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + idiv(idiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = idiv(imod(j, 1461), 4) * 5 + 308;
  const gd = idiv(imod(i, 153), 5) + 1;
  const gm = imod(idiv(i, 153), 12) + 1;
  const gy = idiv(j, 1461) - 100100 + idiv(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - idiv(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn: number) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + idiv(k, 31), jd: imod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + idiv(k, 30), jd: imod(k, 30) + 1 };
}
/* میلادی → شمسی */
export function g2j(date: Date): { jy: number; jm: number; jd: number } {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}
/* شمسی → میلادی */
export function j2g(jy: number, jm: number, jd: number): Date {
  const r = d2g(j2d(jy, jm, jd));
  return new Date(r.gy, r.gm - 1, r.gd);
}
export const J_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const J_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export function jDaysInMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 1 ? 30 : 29;
}
const jPad = (n: number) => String(n).padStart(2, "0");
export function jStr(jy: number, jm: number, jd: number): string { return `${jy}/${jPad(jm)}/${jPad(jd)}`; }
export function parseJ(s: string): { jy: number; jm: number; jd: number } | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (!m) return null;
  return { jy: +m[1], jm: +m[2], jd: +m[3] };
}

const dFmt = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
const dFmtLong = new Intl.DateTimeFormat("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const tFmt = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });

export function faDate(iso: string | Date): string { return dFmt.format(new Date(iso)); }
export function faDateLong(iso: string | Date): string { return dFmtLong.format(new Date(iso)); }
export function faTime(iso: string | Date): string { return tFmt.format(new Date(iso)); }

/* تاریخ شمسی امروز به‌صورت yyyy/mm/dd — مبنای گروه‌بندی کنترل‌های روزانه */
export function pdToday(d: Date = new Date()): string {
  const { jy, jm, jd } = g2j(d);
  return jStr(jy, jm, jd);
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
