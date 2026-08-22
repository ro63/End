/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — پوسته اصلی (App Shell)
   طراح و تحلیلگر سیستم: محمد روشندل
   ------------------------------------------------------------
   • Routing سبک با Hash — مناسب PWA و رفرش روی تبلت
   • منوی مبتنی بر Permission (RBAC)
   • Header: ساعت زنده، شیفت فعلی، وضعیت Online/Offline،
     نشانگر Sync صف آفلاین، اعلان‌ها، تغییر رمز و خروج
   • PWA: ثبت Service Worker برای کار آفلاین
   • PM عمداً در هیچ‌جای سیستم وجود ندارد (خارج از Scope)
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import type { ModuleKey } from "./lib/types";
import { Icon, Logo, Modal, ToastHost } from "./components/ui";
import { cx, faNum, faTime, faDateLong, currentShift, faDate } from "./lib/utils";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DailyControl from "./pages/DailyControl";
import OperatingHours from "./pages/OperatingHours";
import EquipmentPage from "./pages/Equipment";
import Checklists from "./pages/Checklists";
import Reports from "./pages/Reports";
import { Notifications, ActivityLog } from "./pages/Ops";
import UsersPage from "./pages/UsersPage";
import Settings from "./pages/Settings";

/* ---------- مسیرها و ماژول متناظر برای بررسی دسترسی ---------- */
const NAV: { r: string; t: string; icon: string; m: ModuleKey }[] = [
  { r: "dashboard", t: "داشبورد", icon: "dashboard", m: "dashboard" },
  { r: "control", t: "کنترل روزانه", icon: "clipboard", m: "control" },
  { r: "ophours", t: "ساعت کارکرد", icon: "gauge", m: "ophours" },
  { r: "equipment", t: "تجهیزات", icon: "factory", m: "equipment" },
  { r: "checklists", t: "چک‌لیست‌ها", icon: "layers", m: "checklists" },
  { r: "reports", t: "گزارشات", icon: "chart", m: "reports" },
  { r: "notif", t: "اعلان‌ها", icon: "bell", m: "notifications" },
  { r: "logs", t: "Activity Log", icon: "list", m: "logs" },
  { r: "users", t: "کاربران و نقش‌ها", icon: "users", m: "users" },
  { r: "settings", t: "تنظیمات", icon: "cog", m: "settings" },
];

function useRoute(): [string, (r: string) => void] {
  const [route, setRoute] = useState(() => window.location.hash.replace("#/", "") || "dashboard");
  useEffect(() => {
    const fn = () => setRoute(window.location.hash.replace("#/", "") || "dashboard");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const nav = (r: string) => { window.location.hash = "/" + r; };
  return [route, nav];
}

/* ---------- ساعت زنده (ایزوله برای جلوگیری از رندر کل برنامه) ---------- */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  return (
    <div className="text-left leading-tight hidden sm:block">
      <p className="font-display text-[17px] ltr">{faTime(now)}</p>
      <p className="text-[9.5px] font-bold" style={{ color: "var(--muted)" }}>{faDate(now)}</p>
    </div>
  );
}

function Shell() {
  const { db, user, can, logout, online, simOffline, setSimOffline, syncingCount, changePassword, toast } = useStore();
  const [route, nav] = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [pw, setPw] = useState({ old: "", n1: "", n2: "" });
  const [pwErr, setPwErr] = useState("");

  const unread = db.notifications.filter((n) => !n.read).length;
  const queuePending = db.queue.filter((q) => q.status === "pending" || q.status === "syncing").length;
  const shift = currentShift(db.shifts);

  const visibleNav = useMemo(() => NAV.filter((n) => can(n.m, "view")), [can]);
  const routeOk = NAV.find((n) => n.r === route);
  const allowed = routeOk ? can(routeOk.m, "view") : true;

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />, control: <DailyControl />, ophours: <OperatingHours />,
    equipment: <EquipmentPage />, checklists: <Checklists />, reports: <Reports />,
    notif: <Notifications />, logs: <ActivityLog />, users: <UsersPage />, settings: <Settings />,
  };
  const current = NAV.find((n) => n.r === route) ?? NAV[0];

  /* ثبت PWA — نصب روی تبلت و Add to Home Screen */
  useEffect(() => {
    const prod = (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD ?? true;
    if ("serviceWorker" in navigator && prod) navigator.serviceWorker.register("/sw.js").catch(() => { });
  }, []);

  if (!user) return <Login />;

  const SideNav = (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {visibleNav.map((n) => (
        <button key={n.r} className={cx("nav-item", route === n.r && "on")}
          onClick={() => { nav(n.r); setMenuOpen(false); }}>
          <Icon name={n.icon} size={17} />
          <span className="flex-1 text-right">{n.t}</span>
          {n.r === "notif" && unread > 0 && <span className="badge b-nok !text-[9.5px] !px-1.5">{faNum(unread)}</span>}
          {n.r === "control" && queuePending > 0 && <span className="badge b-acc !text-[9.5px] !px-1.5">{faNum(queuePending)} در صف</span>}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* ================= Sidebar دسکتاپ ================= */}
      <aside className="w-[236px] flex-shrink-0 hidden lg:flex flex-col sticky top-0 h-screen no-print" style={{ background: "var(--side)", borderInlineEnd: "1px solid var(--side-line)" }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--side-line)" }}>
          <Logo size={38} light />
        </div>
        <div className="hazard" />
        <div className="px-4 pt-4 pb-1">
          <p className="text-[10px] font-bold tracking-wide" style={{ color: "var(--side-dim)" }}>منوی اصلی</p>
        </div>
        {SideNav}
        <div className="p-3 border-t" style={{ borderColor: "var(--side-line)" }}>
          <div className="rounded-xl p-3" style={{ background: "var(--side2)" }}>
            <p className="text-[11px] font-bold text-white flex items-center gap-1.5"><Icon name="shield" size={13} className="text-[var(--acc)]" />NIPCO DECS v1.0</p>
            <p className="text-[9.5px] font-semibold mt-1" style={{ color: "var(--side-dim)" }}>طراح سیستم: محمد روشندل • سال {faNum(db.settings.operationalYear)}</p>
          </div>
        </div>
      </aside>

      {/* ================= Sidebar موبایل (کشویی) ================= */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden no-print" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/55 fade-in" />
          <aside className="absolute inset-y-0 right-0 w-[250px] flex flex-col slide-start" onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--side)" }}>
            <div className="px-5 py-5 flex items-center justify-between border-b" style={{ borderColor: "var(--side-line)" }}>
              <Logo size={34} light />
              <button className="text-white/70" onClick={() => setMenuOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="hazard" />
            <div className="pt-3">{SideNav}</div>
          </aside>
        </div>
      )}

      {/* ================= محتوای اصلی ================= */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* ---------- Header ---------- */}
        <header className="sticky top-0 z-40 no-print" style={{ background: "color-mix(in srgb, var(--panel) 88%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-2.5 px-4 lg:px-6 py-2.5">
            <button className="btn btn-ghost btn-sm !px-2 lg:hidden" onClick={() => setMenuOpen(true)}><Icon name="menu" size={18} /></button>
            <div className="lg:hidden"><Logo size={30} withText={false} /></div>
            <div className="min-w-0">
              <h2 className="font-display text-[19px] leading-none truncate">{current.t}</h2>
              <p className="text-[10px] font-bold hidden md:block" style={{ color: "var(--muted)" }}>{shift?.name ?? ""} • {faDateLong(new Date())}</p>
            </div>

            <div className="mr-auto flex items-center gap-2">
              {/* وضعیت اتصال — کلیک = شبیه‌سازی قطع شبکه برای تست Offline */}
              <button
                className={cx("badge !py-1.5 !px-2.5 cursor-pointer border", online ? "b-ok" : "b-nok")}
                onClick={() => { setSimOffline(!simOffline); toast(simOffline ? "اتصال دوباره برقرار شد — Sync شروع می‌شود" : "شبکه قطع شد (شبیه‌سازی) — حالت آفلاین فعال است", simOffline ? "ok" : "warn"); }}
                title="برای تست حالت آفلاین کلیک کنید">
                <Icon name={online ? "wifi" : "wifioff"} size={12} />{online ? "آنلاین" : "آفلاین"}
              </button>
              {(syncingCount > 0 || queuePending > 0) && (
                <span className="badge b-acc !py-1.5"><Icon name="refresh" size={11} className={syncingCount > 0 ? "spin" : ""} />
                  {syncingCount > 0 ? `در حال Sync ${faNum(syncingCount)} مورد` : `${faNum(queuePending)} مورد در صف`}
                </span>
              )}

              <LiveClock />

              {/* اعلان‌ها */}
              <button className="btn btn-ghost btn-sm !px-2.5 relative" onClick={() => nav("notif")} aria-label="اعلان‌ها">
                <Icon name="bell" size={17} />
                {unread > 0 && <span className="absolute -top-1 -left-1 min-w-[17px] h-[17px] rounded-full text-[9.5px] font-bold flex items-center justify-center px-1" style={{ background: "var(--nok)", color: "#fff" }}>{faNum(unread)}</span>}
              </button>

              {/* تم سریع */}
              <button className="btn btn-ghost btn-sm !px-2.5 hidden sm:block" aria-label="تغییر تم"
                onClick={() => {
                  const order = ["light", "dark", "industrial"] as const;
                  const next = order[(order.indexOf(db.settings.theme) + 1) % 3];
                  useStoreTheme(next);
                }}>
                <Icon name={db.settings.theme === "light" ? "sun" : db.settings.theme === "dark" ? "moon" : "factory"} size={16} />
              </button>

              {/* منوی کاربر */}
              <div className="flex items-center gap-2 rounded-xl border py-1 pr-1 pl-2.5" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-[14px]" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                  {user.firstName[0]}{user.lastName[0]}
                </span>
                <div className="hidden md:block leading-tight">
                  <p className="text-[11.5px] font-bold">{user.firstName} {user.lastName}</p>
                  <p className="text-[9.5px] font-semibold" style={{ color: "var(--muted)" }}>{db.roles.find((r) => r.id === user.roleId)?.name}</p>
                </div>
                <button className="opacity-55 hover:opacity-100" onClick={() => setPwModal(true)} title="تغییر رمز عبور"><Icon name="key" size={15} /></button>
                <button className="opacity-55 hover:opacity-100 hover:text-[var(--nok)]" onClick={() => logout()} title="خروج"><Icon name="logout" size={15} /></button>
              </div>
            </div>
          </div>
          <div className="hazard !h-[3px]" />
        </header>

        {/* ---------- بنر آفلاین ---------- */}
        {!online && (
          <div className="flex items-center justify-center gap-2.5 px-4 py-2 text-[12px] font-bold text-white no-print" style={{ background: "var(--nok)" }}>
            <Icon name="wifioff" size={15} />
            اتصال شبکه قطع است — همه ثبت‌ها در صف محلی ذخیره و به‌محض اتصال، خودکار Sync می‌شوند. هیچ داده‌ای از بین نمی‌رود.
          </div>
        )}

        {/* ---------- صفحه ---------- */}
        <main className="flex-1 px-4 lg:px-6 py-5 pb-24 print-area">
          {!allowed ? (
            <div className="card p-10 text-center max-w-md mx-auto mt-10">
              <Icon name="lock" size={40} className="mx-auto mb-3 opacity-40" />
              <h3 className="font-display text-[22px]">دسترسی مجاز نیست</h3>
              <p className="text-[12.5px] font-semibold mt-1" style={{ color: "var(--muted)" }}>نقش شما Permission این ماژول را ندارد — در صورت نیاز با مدیر سیستم هماهنگ کنید.</p>
              <button className="btn btn-acc mt-4" onClick={() => nav("dashboard")}>بازگشت به داشبورد</button>
            </div>
          ) : (pages[current.r] ?? <Dashboard />)}
        </main>
      </div>

      {/* ---------- Bottom Nav موبایل ---------- */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex no-print" style={{ background: "var(--panel)", borderTop: "1px solid var(--line)" }}>
        {visibleNav.slice(0, 5).map((n) => (
          <button key={n.r} onClick={() => nav(n.r)}
            className={cx("flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9.5px] font-bold transition-colors")}
            style={{ color: route === n.r ? "var(--acc)" : "var(--muted)" }}>
            <Icon name={n.icon} size={19} />{n.t}
          </button>
        ))}
      </nav>

      {/* ---------- مودال تغییر رمز ---------- */}
      {pwModal && (
        <Modal title="تغییر رمز عبور" icon="key" onClose={() => { setPwModal(false); setPw({ old: "", n1: "", n2: "" }); setPwErr(""); }} w={400}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setPwModal(false)}>انصراف</button>
            <button className="btn btn-acc" onClick={() => {
              if (pw.n1 !== pw.n2) { setPwErr("تکرار رمز جدید یکسان نیست"); return; }
              const r = changePassword(pw.old, pw.n1);
              if (!r.ok) { setPwErr(r.error!); return; }
              setPwModal(false); setPw({ old: "", n1: "", n2: "" }); setPwErr("");
            }}><Icon name="check" size={15} />تغییر رمز</button>
          </>}>
          <div className="space-y-3">
            <div><label className="lbl">رمز فعلی</label><input type="password" className="inp ltr !text-left" dir="ltr" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></div>
            <div><label className="lbl">رمز جدید (حداقل ۶ کاراکتر)</label><input type="password" className="inp ltr !text-left" dir="ltr" value={pw.n1} onChange={(e) => setPw({ ...pw, n1: e.target.value })} /></div>
            <div><label className="lbl">تکرار رمز جدید</label><input type="password" className="inp ltr !text-left" dir="ltr" value={pw.n2} onChange={(e) => setPw({ ...pw, n2: e.target.value })} /></div>
            {pwErr && <p className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: "var(--nok)" }}><Icon name="alert" size={13} />{pwErr}</p>}
          </div>
        </Modal>
      )}

      <ToastHost />
    </div>
  );

  /* تغییر تم سریع — wrapper برای دسترسی به store در scope */
  function useStoreTheme(next: "light" | "dark" | "industrial") {
    updateTheme(next);
  }
}

/* کامپوننت ریشه — اتصال Store و تغییر تم */
function ThemeBridge({ children }: { children: React.ReactNode }) { return <>{children}</>; }
function updateTheme(next: "light" | "dark" | "industrial") {
  /* از طریق event به provider اطلاع می‌دهیم */
  window.dispatchEvent(new CustomEvent("nipco-theme", { detail: next }));
}

function Root() {
  return (
    <StoreProvider>
      <ThemeWatcher />
      <Shell />
    </StoreProvider>
  );
}
function ThemeWatcher() {
  const { updateSettings } = useStore();
  useEffect(() => {
    const fn = (e: Event) => updateSettings({ theme: (e as CustomEvent).detail }, "Theme Change");
    window.addEventListener("nipco-theme", fn);
    return () => window.removeEventListener("nipco-theme", fn);
  }, [updateSettings]);
  return null;
}

export default function App() {
  return <Root />;
}
