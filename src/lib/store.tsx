/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — هسته مرکزی (Store)
   ------------------------------------------------------------
   نقش این فایل در نسخه Full-Stack معادل Backend + API Layer است:
   • Authentication (Login/Logout/Session Timeout/Rate Limiting)
   • Authorization (RBAC + Permission تا سطح ماژول/فرم/Section)
   • Offline-First: صف محلی + Sync خودکار + جلوگیری از Duplicate
   • شبیه‌سازی Industrial Gateway برای خواندن خودکار ساعت کارکرد
     (در Production این بخش یک Edge Service کنار PLC است)
   • ثبت Activity Log برای همه عملیات مهم
   • Backup / Restore / Archive سالانه
   کل داده‌ها در localStorage (معادل دیتابیس در دمو) ماندگارند.
   ============================================================ */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { DB, User, Session, ModuleKey, Perm, DailyControl, NotifType, Settings, QueueItem, OHRecord } from "./types";
import { makeSeed } from "./seed";
import { uid, hashPw, currentShift, shiftWorkDate, faNum } from "./utils";

const DB_KEY = "nipco-decs-db-v3";
const SES_KEY = "nipco-decs-session";
const ATT_KEY = "nipco-decs-attempts";

export interface Toast { id: string; msg: string; type: "ok" | "err" | "warn" | "info"; }

interface StoreApi {
  db: DB;
  user: User | null;
  online: boolean;
  simOffline: boolean;
  setSimOffline: (b: boolean) => void;
  syncingCount: number;
  toasts: Toast[];
  toast: (msg: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
  login: (username: string, pw: string, remember: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: (silent?: boolean) => void;
  changePassword: (oldPw: string, newPw: string) => { ok: boolean; error?: string };
  can: (module: ModuleKey, perm?: Perm) => boolean;
  mutate: (fn: (d: DB) => void) => void;
  log: (action: string, entity: string, result?: "success" | "failed" | "warning") => void;
  submitControl: (c: DailyControl) => { ok: boolean; queued: boolean; error?: string };
  recordOH: (eqId: string, value: number, source: "manual" | "auto" | "adjusted", reason?: string) => { ok: boolean; error?: string };
  readDeviceNow: (eqId: string) => Promise<{ ok: boolean; value?: number; error?: string }>;
  addNotif: (type: NotifType, title: string, body: string) => void;
  updateSettings: (patch: Partial<Settings>, logLabel?: string) => void;
  backupExport: () => void;
  backupImport: (json: string) => boolean;
  archiveYear: () => void;
  resetAll: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

/* ---------- بارگذاری/ذخیره دیتابیس محلی ---------- */
function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const d = JSON.parse(raw) as DB;
      /* Migration: ادغام کلیدهای جدید Settings با نسخه‌های ذخیره‌شده قدیمی */
      if (d.v === 3) return { ...d, settings: { ...makeSeed().settings, ...d.settings } };
    }
  } catch { /* داده خراب → Seed مجدد */ }
  return makeSeed();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem(SES_KEY) || "null"); } catch { return null; }
  });
  const [simOffline, setSimOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncingCount, setSyncingCount] = useState(0);
  const lastActivity = useRef(Date.now());
  const syncingRef = useRef(false);

  const online = browserOnline && !simOffline;
  const dbRef = useRef(db);
  dbRef.current = db;

  /* ---------- ماندگاری دیتابیس ---------- */
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(DB_KEY, JSON.stringify(db)), 150);
    return () => clearTimeout(t);
  }, [db]);

  /* ---------- رویدادهای اتصال شبکه ---------- */
  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* ---------- اعمال تم و رنگ سازمانی ----------
     تم و Accent در Source Code هاردکد نیست؛ از Settings می‌آید. */
  useEffect(() => {
    document.documentElement.dataset.theme = db.settings.theme;
    document.documentElement.style.setProperty("--acc", db.settings.accent);
  }, [db.settings.theme, db.settings.accent]);

  /* ---------- Toast ---------- */
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((msg: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, msg, type }]);
    setTimeout(() => dismissToast(id), 4200);
  }, [dismissToast]);

  /* ---------- Activity Log ---------- */
  const pushLog = useCallback((userId: string, username: string, action: string, entity: string, result: "success" | "failed" | "warning") => {
    setDb((d) => ({
      ...d,
      logs: [{ id: uid(), userId, username, action, entity, result, at: new Date().toISOString(), ip: "192.168.1." + (15 + (new Date().getMinutes() % 40)) }, ...d.logs].slice(0, 400),
    }));
  }, []);

  const user = useMemo(() => (session ? db.users.find((u) => u.id === session.userId && !u.deleted) ?? null : null), [session, db.users]);

  const log = useCallback((action: string, entity: string, result: "success" | "failed" | "warning" = "success") => {
    if (user) pushLog(user.id, user.username, action, entity, result);
  }, [user, pushLog]);

  /* ============================================================
     Authentication
     ============================================================ */
  const login = useCallback(async (username: string, pw: string, remember: boolean) => {
    /* تأخیر شبکه واقعی برای نمایش حالت Loading */
    await new Promise((r) => setTimeout(r, 650));
    const uname = username.trim().toLowerCase();
    /* Rate Limiting — محافظت در برابر Brute Force */
    let attempts: Record<string, { n: number; until: number }> = {};
    try { attempts = JSON.parse(localStorage.getItem(ATT_KEY) || "{}"); } catch { /* ignore */ }
    const a = attempts[uname];
    if (a && a.until > Date.now()) {
      const sec = Math.ceil((a.until - Date.now()) / 1000);
      pushLog("", uname, "ورود مسدودشده (Rate Limit)", "Auth", "failed");
      return { ok: false, error: `به‌دلیل تلاش‌های ناموفق متعدد، ورود موقتاً مسدود است — ${faNum(sec)} ثانیه دیگر تلاش کنید` };
    }
    const u = dbRef.current.users.find((x) => x.username.toLowerCase() === uname && !x.deleted);
    if (!u || u.passHash !== hashPw(u.username, pw)) {
      const n = (a?.n ?? 0) + 1;
      attempts[uname] = { n, until: n >= 5 ? Date.now() + 60_000 : 0 };
      localStorage.setItem(ATT_KEY, JSON.stringify(attempts));
      pushLog("", uname || "(نامشخص)", "تلاش ناموفق ورود", "Auth", "failed");
      return { ok: false, error: n >= 5 ? "۵ بار تلاش ناموفق — حساب ۶۰ ثانیه قفل شد" : "نام کاربری یا رمز عبور اشتباه است" };
    }
    if (!u.active) { pushLog(u.id, u.username, "ورود کاربر غیرفعال", "Auth", "failed"); return { ok: false, error: "حساب شما توسط مدیر غیرفعال شده است" }; }
    attempts[uname] = { n: 0, until: 0 };
    localStorage.setItem(ATT_KEY, JSON.stringify(attempts));
    const ses: Session = { userId: u.id, at: Date.now(), remember };
    setSession(ses);
    localStorage.setItem(SES_KEY, JSON.stringify(ses));
    lastActivity.current = Date.now();
    pushLog(u.id, u.username, "ورود به سامانه", "Auth", "success");
    toast(`خوش آمدید، ${u.firstName} ${u.lastName} 👋`, "ok");
    return { ok: true };
  }, [pushLog, toast]);

  const logout = useCallback((silent = false) => {
    if (user) pushLog(user.id, user.username, "خروج از سامانه", "Auth", "success");
    setSession(null);
    localStorage.removeItem(SES_KEY);
    if (!silent) toast("از سامانه خارج شدید", "info");
  }, [user, pushLog, toast]);

  /* ---------- Session Timeout — قابل تنظیم ---------- */
  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now(); };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const iv = setInterval(() => {
      if (!session) return;
      const limit = dbRef.current.settings.sessionTimeoutMin * 60_000;
      if (Date.now() - lastActivity.current > limit) {
        setSession(null); localStorage.removeItem(SES_KEY);
        toast("نشست به‌دلیل عدم فعالیت به پایان رسید — دوباره وارد شوید", "warn");
      }
    }, 20_000);
    return () => { clearInterval(iv); window.removeEventListener("pointerdown", bump); window.removeEventListener("keydown", bump); };
  }, [session, toast]);

  const changePassword = useCallback((oldPw: string, newPw: string) => {
    if (!user) return { ok: false, error: "نشست فعال نیست" };
    if (user.passHash !== hashPw(user.username, oldPw)) return { ok: false, error: "رمز فعلی اشتباه است" };
    if (newPw.length < 6) return { ok: false, error: "رمز جدید باید حداقل ۶ کاراکتر باشد" };
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, passHash: hashPw(u.username, newPw) } : u)) }));
    log("تغییر رمز عبور", "Users / " + user.username);
    toast("رمز عبور با موفقیت تغییر کرد", "ok");
    return { ok: true };
  }, [user, log, toast]);

  /* ============================================================
     Authorization — RBAC + Permission
     ============================================================ */
  const can = useCallback((module: ModuleKey, perm: Perm = "view") => {
    if (!user) return false;
    const role = dbRef.current.roles.find((r) => r.id === user.roleId);
    if (!role) return false;
    const perms = role.permissions[module] ?? [];
    return perms.includes("manage") || perms.includes(perm);
  }, [user]);

  /* ---------- Mutate عمومی (معادل API های CRUD) ---------- */
  const mutate = useCallback((fn: (d: DB) => void) => {
    setDb((prev) => { const next: DB = structuredClone(prev); fn(next); return next; });
  }, []);

  /* ============================================================
     اعلان‌ها
     ============================================================ */
  const addNotif = useCallback((type: NotifType, title: string, body: string) => {
    setDb((d) => ({
      ...d,
      notifications: [{ id: uid(), type, title, body, at: new Date().toISOString(), read: false, email: true, sms: type === "failure" }, ...d.notifications].slice(0, 80),
    }));
  }, []);

  /* ============================================================
     ثبت کنترل روزانه — قلب چرخه سیستم
     در حالت آفلاین → صف محلی (Queue) و Sync خودکار هنگام اتصال
     ============================================================ */
  const applyControlSideEffects = (d: DB, c: DailyControl) => {
    const eq = d.equipment.find((e) => e.id === c.equipmentId);
    const usr = d.users.find((u) => u.id === c.userId);
    const who = usr ? `${usr.firstName} ${usr.lastName}` : "کاربر";
    /* ثبت ساعت کارکرد همراه کنترل */
    if (c.oh) {
      const ds = d.deviceState.find((x) => x.equipmentId === c.equipmentId);
      d.ohHistory.unshift({
        id: uid(), equipmentId: c.equipmentId, date: c.date,
        time: new Date(c.submittedAt || new Date()).toLocaleTimeString("fa-IR-u-nu-latn", { hour12: false }),
        shiftId: c.shiftId, previous: c.oh.previous, value: c.oh.value,
        diff: Math.round((c.oh.value - c.oh.previous) * 10) / 10,
        source: c.oh.source === "auto" ? "auto" : "manual", protocol: eq?.device.protocol, userId: c.userId,
      });
      if (ds) { ds.current = c.oh.value; ds.lastRead = new Date().toISOString(); }
    }
    /* اعلان‌های NOK / خرابی / خارج از محدوده */
    const nokAns = c.answers.filter((a) => a.result === "nok");
    if (nokAns.length && eq) addNotif("nok", `ثبت NOK در ${eq.name}`, `${nokAns[0].description || "بدون توضیح"} — ${who}`);
    if (c.oorCount > 0 && eq) addNotif("oor", `مقدار خارج از محدوده — ${eq.name}`, `تعداد ${faNum(c.oorCount)} قلم خارج از محدوده مجاز — ${who}`);
    const fail = c.answers.find((a) => a.failureLocationId);
    if (fail && eq) {
      const fl = d.failureLocations.find((f) => f.id === fail.failureLocationId);
      addNotif("failure", `خرابی در ${eq.name}`, `محل خرابی: ${fl?.name ?? "—"} — ${who}`);
    }
  };

  const submitControl = useCallback((c: DailyControl) => {
    const d = dbRef.current;
    /* جلوگیری از ثبت تکراری (Duplicate Prevention) */
    const dup = d.controls.find((x) => x.id === c.id ||
      (x.status !== "draft" && x.equipmentId === c.equipmentId && x.checklistId === c.checklistId && x.date === c.date && x.shiftId === c.shiftId));
    if (dup) return { ok: false, queued: false, error: "این کنترل قبلاً برای همین تجهیز/شیفت ثبت شده است" };

    if (!online) {
      /* ---------- حالت آفلاین: ذخیره محلی + صف Sync ---------- */
      const q: QueueItem = { id: uid(), kind: "control", payload: { ...c, status: "queued", pendingSync: true }, createdAt: new Date().toISOString(), status: "pending", attempts: 0 };
      setDb((prev) => ({
        ...prev,
        controls: [{ ...c, status: "queued", pendingSync: true }, ...prev.controls],
        queue: [...prev.queue, q],
      }));
      log("ثبت کنترل روزانه (آفلاین → صف)", `DailyControl / ${c.equipmentId}`);
      toast("اتصال قطع است — کنترل در صف ذخیره شد و به‌محض اتصال Sync می‌شود", "warn");
      return { ok: true, queued: true };
    }
    /* ---------- حالت آنلاین: ثبت قطعی + عوارض جانبی ---------- */
    setDb((prev) => {
      const next = structuredClone(prev);
      next.controls.unshift({ ...c, status: "submitted" });
      applyControlSideEffects(next, c);
      return next;
    });
    log("ثبت کنترل روزانه", `DailyControl / ${c.equipmentId}`);
    toast("کنترل روزانه با موفقیت ثبت شد ✓", "ok");
    return { ok: true, queued: false };
  }, [online, log, toast, addNotif]);

  /* ============================================================
     Sync خودکار صف آفلاین
     هنگام بازگشت اتصال، آیتم‌ها یکی‌یکی با سرور Sync می‌شوند؛
     Duplicate Prevention با شناسه یکتای سمت کلاینت انجام می‌شود.
     ============================================================ */
  useEffect(() => {
    if (!online || syncingRef.current) return;
    const pending = db.queue.filter((q) => q.status === "pending");
    if (!pending.length) return;
    syncingRef.current = true;
    let i = 0;
    const step = () => {
      if (i >= pending.length) {
        syncingRef.current = false; setSyncingCount(0);
        toast(`Sync انجام شد — ${faNum(pending.length)} مورد با سرور همگام‌سازی شد`, "ok");
        return;
      }
      const item = pending[i];
      setSyncingCount(pending.length - i);
      setDb((prev) => ({ ...prev, queue: prev.queue.map((q) => (q.id === item.id ? { ...q, status: "syncing", attempts: q.attempts + 1 } : q)) }));
      setTimeout(() => {
        setDb((prev) => {
          const next = structuredClone(prev);
          const q = next.queue.find((x) => x.id === item.id);
          if (q) q.status = "synced";
          if (item.kind === "control") {
            const c = item.payload as DailyControl;
            const ctrl = next.controls.find((x) => x.id === c.id);
            if (ctrl) { ctrl.status = "submitted"; ctrl.pendingSync = false; }
            else next.controls.unshift({ ...c, status: "submitted" });
            applyControlSideEffects(next, c);
          }
          return next;
        });
        i++;
        setTimeout(step, 500);
      }, 800);
    };
    step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  /* ============================================================
     شبیه‌سازی Industrial Gateway — خواندن خودکار ساعت کارکرد
     ------------------------------------------------------------
     در Production: ماشین/PLC → Edge Gateway → این لایه.
     اینجا هر gatewayPollSec ثانیه، تجهیزات متصل مقدارشان را
     (شتاب‌یافته برای نمایش) به‌روزرسانی می‌کنند. سقف مصنوعی وجود ندارد.
     ============================================================ */
  useEffect(() => {
    if (!db.settings.gatewayEnabled) return;
    const pollMs = Math.max(5, db.settings.gatewayPollSec) * 1000;
    const iv = setInterval(() => {
      setDb((prev) => {
        const next = { ...prev, deviceState: prev.deviceState.map((s) => ({ ...s })) };
        const eqs = next.deviceState.map((s) => next.equipment.find((e) => e.id === s.equipmentId)).filter(Boolean);
        for (const s of next.deviceState) {
          const eq = eqs.find((e) => e!.id === s.equipmentId)!;
          if (!eq || !eq.device.enabled || eq.device.protocol === "manual" || eq.status === "inactive") continue;
          /* شبیه‌سازی: ۳ برابر زمان واقعی تا تغییرات در دمو محسوس باشد */
          s.current = Math.round((s.current + (pollMs / 3_600_000) * 3) * 1000) / 1000;
          s.lastRead = new Date().toISOString();
          s.connection = Math.random() < 0.04 ? "timeout" : "connected";
        }
        return next;
      });
    }, pollMs);
    return () => clearInterval(iv);
  }, [db.settings.gatewayEnabled, db.settings.gatewayPollSec]);

  /* ---------- خواندن لحظه‌ای از دستگاه (دکمه Refresh) ---------- */
  const readDeviceNow = useCallback(async (eqId: string) => {
    const eq = dbRef.current.equipment.find((e) => e.id === eqId);
    if (!eq) return { ok: false, error: "تجهیز یافت نشد" };
    if (!eq.device.enabled || eq.device.protocol === "manual") return { ok: false, error: "ارتباط با دستگاه برای این تجهیز فعال نیست — از ثبت دستی استفاده کنید" };
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    if (Math.random() < 0.12) return { ok: false, error: `خطا در ارتباط با دستگاه (Timeout بعد از ${faNum(eq.device.retryCount)} تلاش)` };
    const s = dbRef.current.deviceState.find((x) => x.equipmentId === eqId);
    const val = Math.round(((s?.current ?? 0) + 0.1) * 10) / 10;
    setDb((prev) => ({
      ...prev,
      deviceState: prev.deviceState.map((x) => (x.equipmentId === eqId ? { ...x, current: val, lastRead: new Date().toISOString(), connection: "connected" } : x)),
    }));
    return { ok: true, value: val };
  }, []);

  /* ============================================================
     ساعت کارکرد — Manual Fallback + Adjustment + Validation
     قانون: مقدار جدید < مقدار قبلی ❌ مگر Adjustment با دلیل و مجوز
     ============================================================ */
  const recordOH = useCallback((eqId: string, value: number, source: "manual" | "auto" | "adjusted", reason?: string) => {
    if (!user) return { ok: false, error: "نشست فعال نیست" };
    const d = dbRef.current;
    const ds = d.deviceState.find((x) => x.equipmentId === eqId);
    const prev = ds?.current ?? 0;
    if (value < prev && source !== "adjusted") {
      return { ok: false, error: `مقدار جدید (${faNum(value, 1)}) کمتر از مقدار فعلی (${faNum(prev, 1)}) است — فقط از طریق «اصلاح/Adjustment» با ثبت دلیل امکان‌پذیر است` };
    }
    if (source === "adjusted" && !can("ophours", "approve")) {
      return { ok: false, error: "شما مجوز اصلاح ساعت کارکرد (Adjustment) را ندارید" };
    }
    const shift = currentShift(d.shifts);
    const rec: OHRecord = {
      id: uid(), equipmentId: eqId, date: shiftWorkDate(shift),
      time: new Date().toLocaleTimeString("fa-IR-u-nu-latn", { hour12: false }),
      shiftId: shift?.id ?? "sh1", previous: prev, value, diff: Math.round((value - prev) * 10) / 10,
      source, protocol: d.equipment.find((e) => e.id === eqId)?.device.protocol, userId: user.id,
      reason: reason || undefined,
    };
    setDb((p) => {
      const next = structuredClone(p);
      next.ohHistory.unshift(rec);
      const s = next.deviceState.find((x) => x.equipmentId === eqId);
      if (s) { s.current = value; s.lastRead = new Date().toISOString(); s.connection = source === "manual" ? s.connection : "connected"; }
      return next;
    });
    log(source === "adjusted" ? "اصلاح ساعت کارکرد (Adjustment)" : "ثبت ساعت کارکرد دستی", `OperatingHours / ${eqId} — ${reason || ""}`, source === "adjusted" ? "warning" : "success");
    toast(source === "adjusted" ? "اصلاح ساعت کارکرد با ثبت دلیل ذخیره شد" : "ساعت کارکرد ثبت شد ✓", "ok");
    return { ok: true };
  }, [user, can, log, toast]);

  /* ============================================================
     Settings / Backup / Restore / Archive / Reset
     ============================================================ */
  const updateSettings = useCallback((patch: Partial<Settings>, logLabel?: string) => {
    setDb((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
    if (logLabel && user) pushLog(user.id, user.username, "تغییر تنظیمات سامانه", "Settings / " + logLabel, "success");
  }, [user, pushLog]);

  const backupExport = useCallback(() => {
    const json = JSON.stringify(dbRef.current, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nipco-backup-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    log("پشتیبان‌گیری دستی", "Backup", "success");
    addNotif("backup", "پشتیبان‌گیری دستی انجام شد", "فایل پشتیبان کامل دیتابیس دانلود شد");
    toast("فایل پشتیبان دانلود شد ✓", "ok");
  }, [log, addNotif, toast]);

  const backupImport = useCallback((json: string) => {
    try {
      const d = JSON.parse(json) as DB;
      if (!d.v || !Array.isArray(d.users) || !Array.isArray(d.equipment)) return false;
      setDb(d);
      localStorage.setItem(DB_KEY, json);
      log("بازیابی پشتیبان (Restore)", "Backup", "warning");
      toast("پشتیبان با موفقیت بازیابی شد ✓", "ok");
      return true;
    } catch { return false; }
  }, [log, toast]);

  /* ---------- بستن سال و آرشیو (Year Close / Archive) ---------- */
  const archiveYear = useCallback(() => {
    const d = dbRef.current;
    const year = d.settings.operationalYear;
    const key = `nipco-archive-${year}`;
    const payload = { year, controls: d.controls, ohHistory: d.ohHistory, at: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(payload));
    setDb((p) => ({
      ...p,
      controls: [], ohHistory: [],
      archives: [{ year, at: new Date().toISOString(), size: Math.round(JSON.stringify(payload).length / 1024) }, ...p.archives],
      settings: { ...p.settings, operationalYear: year + 1 },
    }));
    log("بستن سال و آرشیو", `Years / ${year} → ${year + 1}`, "warning");
    addNotif("system", `سال ${faNum(year)} بسته و آرشیو شد`, `سال کاری جدید: ${faNum(year + 1)} — داده‌های سال قبل در آرشیو محفوظ است`);
    toast(`سال ${faNum(year)} آرشیو شد — سال کاری جدید شروع شد`, "ok");
  }, [log, addNotif, toast]);

  const resetAll = useCallback(() => {
    localStorage.removeItem(DB_KEY);
    setDb(makeSeed());
    toast("داده‌های سامانه به حالت اولیه بازگشت", "info");
  }, [toast]);

  const api: StoreApi = {
    db, user, online, simOffline, setSimOffline, syncingCount, toasts, toast, dismissToast,
    login, logout, changePassword, can, mutate, log, submitControl, recordOH, readDeviceNow,
    addNotif, updateSettings, backupExport, backupImport, archiveYear, resetAll,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore باید داخل StoreProvider استفاده شود");
  return ctx;
}
