/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — تنظیمات سامانه
   ------------------------------------------------------------
   تب‌ها: عمومی | برندینگ و لوگو | شیفت‌ها | سال و آرشیو |
   پشتیبان‌گیری | تم و ظاهر
   • لوگو Hard-Code نیست — Upload/Change/Delete با Validation
   • شیفت‌ها Dynamic + مدیریت شیفت شب (عبور از مرز روز)
   • بستن سال: Close → Archive → Backup → سال جدید
   ============================================================ */

import { useRef, useState } from "react";
import { useStore } from "../lib/store";
import type { Shift } from "../lib/types";
import { Icon, Modal, Seg, Switch, Logo } from "../components/ui";
import { cx, faNum, uid } from "../lib/utils";

type Tab = "general" | "brand" | "shifts" | "year" | "backup" | "theme";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">تنظیمات سامانه</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>همه‌چیز Configurable — بدون نیاز به تغییر Source Code</p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "general", label: "عمومی", icon: "cog" }, { v: "brand", label: "برندینگ و UI", icon: "camera" },
          { v: "shifts", label: "شیفت‌ها", icon: "clock" }, { v: "year", label: "سال و آرشیو", icon: "archive" },
          { v: "backup", label: "پشتیبان‌گیری", icon: "database" }, { v: "theme", label: "تم", icon: "sun" },
        ]} />
      </div>
      {tab === "general" && <GeneralTab />}
      {tab === "brand" && <BrandTab />}
      {tab === "shifts" && <ShiftsTab />}
      {tab === "year" && <YearTab />}
      {tab === "backup" && <BackupTab />}
      {tab === "theme" && <ThemeTab />}
    </div>
  );
}

/* ================= عمومی ================= */
function GeneralTab() {
  const { db, updateSettings } = useStore();
  const s = db.settings;
  return (
    <div className="grid md:grid-cols-2 gap-4 fade-up">
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-[14px] flex items-center gap-2"><Icon name="shield" size={16} style={{ color: "var(--acc)" }} />نشست و امنیت</h3>
        <div>
          <label className="lbl">Session Timeout (دقیقه — بعد از عدم فعالیت)</label>
          <input type="number" className="inp !w-32 ltr !text-left" dir="ltr" value={s.sessionTimeoutMin}
            onChange={(e) => updateSettings({ sessionTimeoutMin: Math.max(5, +e.target.value) }, "Session Timeout")} />
        </div>
        <p className="text-[11.5px] font-semibold rounded-lg p-3" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          ورود/خروج، تلاش‌های ناموفق و همه عملیات مهم در Activity Log ثبت می‌شود. Rate Limiting: ۵ تلاش ناموفق = ۶۰ ثانیه قفل.
        </p>
      </div>
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-[14px] flex items-center gap-2"><Icon name="plug" size={16} style={{ color: "var(--acc)" }} />Industrial Gateway</h3>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold">خواندن خودکار ساعت کارکرد</span>
          <Switch on={s.gatewayEnabled} onChange={(v) => updateSettings({ gatewayEnabled: v }, "Gateway Enabled")} />
        </div>
        <div>
          <label className="lbl">Polling Interval (ثانیه — هر چند وقت از دستگاه‌ها خوانده شود)</label>
          <input type="number" className="inp !w-32 ltr !text-left" dir="ltr" value={s.gatewayPollSec}
            onChange={(e) => updateSettings({ gatewayPollSec: Math.max(5, +e.target.value) }, "Polling Interval")} />
        </div>
        <p className="text-[11.5px] font-semibold rounded-lg p-3" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          در Production: Machine → Edge Gateway → Backend. تنظیمات پروتکل هر دستگاه در صفحه «ساعت کارکرد → تنظیمات دستگاه‌ها» است.
        </p>
      </div>
      <div className="card p-5 md:col-span-2 space-y-3">
        <h3 className="font-bold text-[14px] flex items-center gap-2"><Icon name="bell" size={16} style={{ color: "var(--acc)" }} />Ruleهای ارسال Email و SMS</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ["nokEmail", "ارسال Email هنگام ثبت NOK"],
            ["nokSms", "ارسال SMS هنگام ثبت NOK"],
            ["overdueEmail", "Email یادآوری کنترل انجام‌نشده"],
            ["failureSms", "SMS فوری هنگام ثبت خرابی"],
          ] as const).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg px-3.5 py-2.5 panel2 border" style={{ borderColor: "var(--line)" }}>
              <span className="text-[12.5px] font-bold flex items-center gap-2">
                <Icon name={k.includes("Email") ? "mail" : "message"} size={15} className="opacity-60" />{label}
              </span>
              <Switch on={s.notifRules[k]} onChange={(v) => updateSettings({ notifRules: { ...s.notifRules, [k]: v } }, `Notif Rule / ${k}`)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= برندینگ، لوگو و شخصی‌سازی کامل UI =================
   • سه جایگاه لوگو: اصلی (سربرگ/گزارش/چاپ) + صفحه ورود + گزارشات
   • نام شرکت (فارسی/انگلیسی) و شعار — در ورود، سربرگ و PDF
   • پس‌زمینه صفحه ورود: تصویر صنعتی / رنگ یکدست / الگوی فنی
   • ظاهر: شعاع کارت‌ها + تراکم رابط — همه بدون Hard-Code            */
const OK_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
type LogoKey = "logoDataUrl" | "loginLogoDataUrl" | "reportLogoDataUrl";

function BrandTab() {
  const { updateSettings, db, toast, log } = useStore();
  const s = db.settings;
  const refs = { logoDataUrl: useRef<HTMLInputElement>(null), loginLogoDataUrl: useRef<HTMLInputElement>(null), reportLogoDataUrl: useRef<HTMLInputElement>(null) };

  /* Validation فایل: نوع، حجم و نام امن — از فایل مخرب جلوگیری می‌شود */
  function handleFile(file: File | undefined, which: LogoKey) {
    if (!file) return;
    if (!OK_TYPES.includes(file.type)) { toast("فرمت مجاز نیست — فقط PNG / JPG / SVG / WEBP", "err"); return; }
    if (file.size > 400 * 1024) { toast("حجم لوگو باید کمتر از ۴۰۰KB باشد", "err"); return; }
    const r = new FileReader();
    r.onload = () => {
      updateSettings({ [which]: r.result as string } as never, "Logo Change");
      log(`تغییر لوگو (${which === "logoDataUrl" ? "اصلی" : which === "loginLogoDataUrl" ? "ورود" : "گزارشات"})`, "Branding");
      toast("لوگو با موفقیت به‌روزرسانی شد ✓", "ok");
    };
    r.readAsDataURL(file);
  }

  const slots: { key: LogoKey; title: string; desc: string; icon: string }[] = [
    { key: "logoDataUrl", title: "لوگوی اصلی", desc: "نمایش در Header، Sidebar و داشبورد", icon: "dashboard" },
    { key: "loginLogoDataUrl", title: "لوگوی صفحه ورود", desc: "نمایش اختصاصی در صفحه Login", icon: "users" },
    { key: "reportLogoDataUrl", title: "لوگوی گزارشات", desc: "در خروجی PDF، چاپ و سربرگ گزارش‌ها", icon: "printer" },
  ];

  const bgs: { k: "image" | "solid" | "pattern"; t: string; d: string }[] = [
    { k: "image", t: "تصویر صنعتی", d: "عکس خط تولید با نور صنعتی" },
    { k: "solid", t: "رنگ یکدست", d: "پس‌زمینه تیره ساده و سبک" },
    { k: "pattern", t: "الگوی فنی", d: "شبکه مهندسی + شیب صنعتی" },
  ];

  return (
    <div className="fade-up space-y-4">
      {/* ---------- لوگوها ---------- */}
      <div className="grid md:grid-cols-3 gap-4">
        {slots.map((slot) => (
          <div key={slot.key} className="card p-5">
            <h3 className="font-bold text-[14px] mb-1 flex items-center gap-2"><Icon name={slot.icon} size={15} style={{ color: "var(--acc)" }} />{slot.title}</h3>
            <p className="text-[11px] font-semibold mb-4" style={{ color: "var(--muted)" }}>{slot.desc}</p>
            <div className="rounded-xl border-2 border-dashed p-5 flex items-center justify-center mb-4 min-h-[104px]" style={{ borderColor: "var(--line2)", background: "var(--panel2)" }}>
              {s[slot.key] ? <img src={s[slot.key]!} alt="لوگو" style={{ maxHeight: 62, maxWidth: 200, objectFit: "contain" }} /> : <Logo size={40} />}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-acc btn-sm flex-1" onClick={() => refs[slot.key].current?.click()}>
                <Icon name="upload" size={14} />{s[slot.key] ? "تغییر" : "Upload"}
              </button>
              {s[slot.key] && (
                <button className="btn btn-ghost btn-sm" onClick={() => { updateSettings({ [slot.key]: null } as never, "Logo Delete"); log("حذف لوگو", "Branding", "warning"); toast("لوگو حذف شد — لوگوی پیش‌فرض نمایش داده می‌شود", "info"); }}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
            <input ref={refs[slot.key]} type="file" hidden accept={OK_TYPES.join(",")} onChange={(e) => { handleFile(e.target.files?.[0], slot.key); e.target.value = ""; }} />
          </div>
        ))}
      </div>

      {/* ---------- نام و شعار ---------- */}
      <div className="card p-5">
        <h3 className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="pen" size={15} style={{ color: "var(--acc)" }} />نام سازمان و شعار</h3>
        <div className="grid sm:grid-cols-3 gap-3.5">
          <div>
            <label className="lbl">نام شرکت (فارسی) — صفحه ورود و سربرگ چاپ</label>
            <input className="inp" value={s.brandNameFa} onChange={(e) => updateSettings({ brandNameFa: e.target.value }, "Brand Name FA")} />
          </div>
          <div>
            <label className="lbl">نام شرکت (انگلیسی) — لوگوی متنی</label>
            <input className="inp ltr !text-left" dir="ltr" value={s.brandNameEn} onChange={(e) => updateSettings({ brandNameEn: e.target.value }, "Brand Name EN")} />
          </div>
          <div>
            <label className="lbl">شعار زیر لوگو (صفحه ورود)</label>
            <input className="inp" value={s.tagline} onChange={(e) => updateSettings({ tagline: e.target.value }, "Tagline")} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ---------- پس‌زمینه صفحه ورود ---------- */}
        <div className="card p-5">
          <h3 className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="camera" size={15} style={{ color: "var(--acc)" }} />پس‌زمینه صفحه ورود</h3>
          <div className="space-y-2.5">
            {bgs.map((b) => (
              <button key={b.k} onClick={() => { updateSettings({ loginBg: b.k }, `Login Background → ${b.t}`); log("تغییر پس‌زمینه ورود", "Branding"); }}
                className={cx("w-full rounded-xl border-2 p-2.5 flex items-center gap-3 text-right transition-all", s.loginBg === b.k ? "" : "opacity-65 hover:opacity-100")}
                style={{ borderColor: s.loginBg === b.k ? "var(--acc)" : "var(--line)" }}>
                {/* پیش‌نمایش زنده هر پس‌زمینه */}
                <span className="w-20 h-12 rounded-lg flex-shrink-0 overflow-hidden relative" style={{ background: b.k === "solid" ? "#0d141d" : "linear-gradient(140deg,#0d141d,#1b2530)" }}>
                  {b.k === "image" && <span className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 70% 20%, rgba(232,89,12,.8), transparent 45%), radial-gradient(circle at 20% 80%, rgba(33,150,243,.35), transparent 40%)" }} />}
                  {b.k === "pattern" && <span className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "9px 9px" }} />}
                  <span className="absolute bottom-1 right-1.5 w-6 h-1 rounded bg-[var(--acc)]" />
                </span>
                <span className="flex-1">
                  <b className="text-[13px] block">{b.t}</b>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{b.d}</span>
                </span>
                {s.loginBg === b.k && <Icon name="check" size={17} style={{ color: "var(--acc)" }} />}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- ظاهر رابط کاربری ---------- */}
        <div className="card p-5">
          <h3 className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="sun" size={15} style={{ color: "var(--acc)" }} />ظاهر رابط کاربری (UI)</h3>
          <div className="mb-4">
            <label className="lbl flex items-center justify-between">
              <span>شعاع گوشه کارت‌ها و دکمه‌ها</span>
              <span className="badge b-acc ltr">{s.cardRadius}px</span>
            </label>
            <input type="range" min={0} max={22} step={1} value={s.cardRadius}
              onChange={(e) => updateSettings({ cardRadius: +e.target.value }, "Card Radius")}
              className="w-full" style={{ accentColor: "var(--acc)" }} />
            <div className="flex justify-between text-[9.5px] font-bold" style={{ color: "var(--muted)" }}><span>مربع (صنعتی)</span><span>گرد (مدرن)</span></div>
          </div>
          <div className="mb-4">
            <label className="lbl">تراکم رابط — مناسب تبلت یا مانیتور</label>
            <div className="flex gap-2">
              {([["comfortable", "راحت", "فضای بیشتر برای لمس"], ["compact", "فشرده", "اطلاعات بیشتر در صفحه"]] as const).map(([k, t, d]) => (
                <button key={k} onClick={() => { updateSettings({ density: k }, `Density → ${t}`); log("تغییر تراکم رابط", "Settings"); }}
                  className={cx("flex-1 rounded-xl border-2 p-3 text-right transition-all", s.density === k ? "" : "opacity-65 hover:opacity-100")}
                  style={{ borderColor: s.density === k ? "var(--acc)" : "var(--line)" }}>
                  <b className="text-[13px] flex items-center gap-1.5">{t}{s.density === k && <Icon name="check" size={13} style={{ color: "var(--acc)" }} />}</b>
                  <span className="text-[10.5px] font-semibold" style={{ color: "var(--muted)" }}>{d}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl p-3.5 border" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <p className="lbl !mb-2">پیش‌نمایش زنده</p>
            <div className="card p-3 mb-2 !m-0"><p className="font-bold text-[12.5px]">کارت نمونه</p><p className="text-[10.5px]" style={{ color: "var(--muted)" }}>تجهیز • پرس هیدرولیک ۱۵۰۰ تن</p></div>
            <div className="flex gap-2">
              <span className="btn btn-acc btn-sm pointer-events-none">دکمه اصلی</span>
              <span className="badge b-ok">OK</span><span className="badge b-nok">NOK</span><span className="badge b-acc">خارج محدوده</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <Icon name="shield" size={13} />File Type + Size Validation فعال است — لوگوها و تنظیمات ظاهری در Source Code هاردکد نیستند و در دیتابیس ذخیره می‌شوند.
      </p>
    </div>
  );
}

/* ================= شیفت‌ها ================= */
function ShiftsTab() {
  const { db, mutate, log, toast } = useStore();
  const [nf, setNf] = useState({ name: "", start: "08:00", end: "16:00" });
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 fade-up">
      <div className="space-y-3">
        {db.shifts.map((s) => {
          const overnight = s.start > s.end;
          return (
            <div key={s.id} className="card p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <input className="inp !font-bold !w-52" value={s.name} onChange={(e) => mutate((d) => { const x = d.shifts.find((y) => y.id === s.id); if (x) x.name = e.target.value; })} />
                <div className="flex items-center gap-2 mt-2">
                  <input type="time" className="inp !w-28 ltr !text-left" dir="ltr" value={s.start} onChange={(e) => mutate((d) => { const x = d.shifts.find((y) => y.id === s.id); if (x) x.start = e.target.value; })} />
                  <span className="font-bold" style={{ color: "var(--muted)" }}>تا</span>
                  <input type="time" className="inp !w-28 ltr !text-left" dir="ltr" value={s.end} onChange={(e) => mutate((d) => { const x = d.shifts.find((y) => y.id === s.id); if (x) x.end = e.target.value; })} />
                  {overnight && <span className="badge b-acc"><Icon name="moon" size={11} />شیفت شب — عبور از مرز روز مدیریت می‌شود</span>}
                </div>
              </div>
              <p className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{faNum(db.users.filter((u) => u.shiftId === s.id).length)} کاربر</p>
              <Switch on={s.active} onChange={(v) => { mutate((d) => { const x = d.shifts.find((y) => y.id === s.id); if (x) x.active = v; }); log(v ? "فعال‌سازی شیفت" : "غیرفعال‌سازی شیفت", `Shifts / ${s.name}`); }} />
              <button className="btn btn-ghost btn-sm !px-2 hover:!text-[var(--nok)]" onClick={() => {
                if (db.shifts.length <= 1) { toast("حداقل یک شیفت باید وجود داشته باشد", "err"); return; }
                mutate((d) => { d.shifts = d.shifts.filter((x) => x.id !== s.id); });
                log("حذف شیفت", `Shifts / ${s.name}`, "warning");
              }}><Icon name="trash" size={14} /></button>
            </div>
          );
        })}
      </div>
      <div className="card p-4 h-fit">
        <h3 className="font-bold text-[13.5px] mb-3 flex items-center gap-2"><Icon name="plus" size={15} style={{ color: "var(--acc)" }} />شیفت جدید</h3>
        <div className="space-y-2.5">
          <div><label className="lbl">نام شیفت</label><input className="inp" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="شیفت ۴ (ویژه)" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="lbl">شروع</label><input type="time" className="inp ltr !text-left" dir="ltr" value={nf.start} onChange={(e) => setNf({ ...nf, start: e.target.value })} /></div>
            <div><label className="lbl">پایان</label><input type="time" className="inp ltr !text-left" dir="ltr" value={nf.end} onChange={(e) => setNf({ ...nf, end: e.target.value })} /></div>
          </div>
          <button className="btn btn-acc w-full" onClick={() => {
            if (!nf.name.trim()) { toast("نام شیفت الزامی است", "err"); return; }
            const ns: Shift = { id: uid(), name: nf.name.trim(), start: nf.start, end: nf.end, active: true };
            mutate((d) => d.shifts.push(ns));
            log("ایجاد شیفت", `Shifts / ${ns.name}`);
            toast("شیفت جدید اضافه شد ✓", "ok"); setNf({ name: "", start: "08:00", end: "16:00" });
          }}><Icon name="check" size={15} />ثبت شیفت</button>
        </div>
        <p className="text-[10.5px] font-semibold mt-3" style={{ color: "var(--muted)" }}>اگر شروع بزرگ‌تر از پایان باشد، شیفت شب تلقی شده و تاریخ کاری به‌درستی محاسبه می‌شود.</p>
      </div>
    </div>
  );
}

/* ================= سال و آرشیو ================= */
function YearTab() {
  const { db, archiveYear } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid md:grid-cols-2 gap-4 fade-up">
      <div className="card p-5">
        <h3 className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="calendar" size={16} style={{ color: "var(--acc)" }} />سال کاری جاری</h3>
        <p className="font-display text-[64px] leading-none" style={{ color: "var(--acc)" }}>{faNum(db.settings.operationalYear)}</p>
        <p className="text-[12px] font-semibold mt-2" style={{ color: "var(--muted)" }}>
          {faNum(db.controls.length)} کنترل و {faNum(db.ohHistory.length)} رکورد ساعت کارکرد در سال جاری
        </p>
        <button className="btn btn-nok mt-5" onClick={() => setConfirm(true)} disabled={db.controls.length === 0}>
          <Icon name="archive" size={15} />بستن سال، آرشیو و شروع سال جدید
        </button>
        {db.controls.length === 0 && <p className="text-[11px] font-bold mt-2" style={{ color: "var(--muted)" }}>داده‌ای برای آرشیو وجود ندارد</p>}
      </div>
      <div className="card p-5">
        <h3 className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="database" size={16} style={{ color: "var(--info)" }} />آرشیو سال‌های قبل</h3>
        {db.archives.length === 0 && <p className="text-[12px] font-semibold py-6 text-center" style={{ color: "var(--muted)" }}>هنوز سالی بسته نشده — داده‌های سال‌های قبل اینجا نگهداری می‌شود</p>}
        <div className="space-y-2">
          {db.archives.map((a) => (
            <div key={a.year} className="flex items-center justify-between rounded-lg px-3.5 py-2.5 panel2 border" style={{ borderColor: "var(--line)" }}>
              <p className="font-bold text-[13px]">سال {faNum(a.year)}</p>
              <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{a.at.slice(0, 10)} • {faNum(a.size)}KB</p>
              <span className="badge b-ok"><Icon name="check" size={10} />آرشیو شد</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-semibold mt-3 rounded-lg p-3" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          ترتیب پایان سال: Close Year ← Archive ← Backup ← ایجاد سال جدید. دسترسی سالانه (Full/Read-Only/No Access) از ماتریس نقش‌ها اعمال می‌شود.
        </p>
      </div>
      {confirm && (
        <Modal title="بستن سال کاری" icon="archive" onClose={() => setConfirm(false)} w={460}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>انصراف</button>
            <button className="btn btn-nok" onClick={() => { archiveYear(); setConfirm(false); }}><Icon name="archive" size={15} />بستن و آرشیو سال</button>
          </>}>
          <p className="text-[13px] font-semibold leading-7">
            همه کنترل‌ها و سوابق ساعت کارکرد سال <b>{faNum(db.settings.operationalYear)}</b> به آرشیو منتقل و سال کاری <b>{faNum(db.settings.operationalYear + 1)}</b> شروع می‌شود.
            داده‌های آرشیوشده قابل بازیابی‌اند ولی در داشبورد و گزارش‌های جاری نمایش داده نمی‌شوند.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ================= پشتیبان‌گیری ================= */
function BackupTab() {
  const { db, updateSettings, backupExport, backupImport, resetAll, toast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="grid md:grid-cols-2 gap-4 fade-up">
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-[14px] flex items-center gap-2"><Icon name="download" size={16} style={{ color: "var(--acc)" }} />پشتیبان‌گیری</h3>
        <div>
          <label className="lbl">پشتیبان‌گیری خودکار</label>
          <select className="inp !w-56" value={db.settings.autoBackup} onChange={(e) => updateSettings({ autoBackup: e.target.value as never }, "Auto Backup")}>
            <option value="off">خاموش</option><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option>
          </select>
        </div>
        <button className="btn btn-acc" onClick={backupExport}><Icon name="download" size={15} />دانلود پشتیبان کامل (Database + تنظیمات)</button>
        <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>شامل: کاربران، تجهیزات، چک‌لیست‌ها، کنترل‌ها، ساعت کارکرد، تنظیمات و برندینگ</p>
      </div>
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-[14px] flex items-center gap-2"><Icon name="upload" size={16} style={{ color: "var(--info)" }} />بازیابی (Restore)</h3>
        <button className="btn btn-dark" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} />انتخاب فایل پشتیبان</button>
        <input ref={fileRef} type="file" hidden accept="application/json" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = new FileReader();
          r.onload = () => { if (!backupImport(String(r.result))) toast("فایل پشتیبان نامعتبر است", "err"); };
          r.readAsText(f); e.target.value = "";
        }} />
        <div className="pt-3 border-t" style={{ borderColor: "var(--line)" }}>
          <button className="btn btn-ghost hover:!text-[var(--nok)] !border-[var(--nok)]" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={15} />بازنشانی کامل داده‌ها (Reset)
          </button>
        </div>
      </div>
      {confirmReset && (
        <Modal title="بازنشانی داده‌ها" icon="alert" onClose={() => setConfirmReset(false)} w={420}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>انصراف</button>
            <button className="btn btn-nok" onClick={() => { resetAll(); setConfirmReset(false); }}>بله — بازنشانی کن</button>
          </>}>
          <p className="text-[13px] font-semibold leading-7">همه داده‌ها به حالت اولیه (Seed) برمی‌گردند. این عملیات غیرقابل بازگشت است — قبل از آن پشتیبان بگیرید.</p>
        </Modal>
      )}
    </div>
  );
}

/* ================= تم و ظاهر ================= */
function ThemeTab() {
  const { db, updateSettings } = useStore();
  const s = db.settings;
  const themes = [
    { k: "light" as const, t: "روشن", d: "پیش‌فرض اداری", bg: "#eef0ea", fg: "#16202b", acc: "#e8590c" },
    { k: "dark" as const, t: "تاریک", d: "اتاق کنترل", bg: "#0d131b", fg: "#e7edf4", acc: "#e8590c" },
    { k: "industrial" as const, t: "صنعتی", d: "کهربایی روی فولاد", bg: "#101820", fg: "#eaf0f5", acc: "#f5a623" },
  ];
  const accents = ["#e8590c", "#0e7490", "#17864d", "#c2410c", "#b91c1c", "#7e57c2"];
  return (
    <div className="grid md:grid-cols-2 gap-4 fade-up">
      <div className="card p-5">
        <h3 className="font-bold text-[14px] mb-3">تم سامانه</h3>
        <div className="space-y-2.5">
          {themes.map((t) => (
            <button key={t.k} onClick={() => { updateSettings({ theme: t.k, accent: t.k === "industrial" ? "#f5a623" : "#e8590c" }, `Theme → ${t.t}`); }}
              className={cx("w-full rounded-xl border-2 p-3.5 flex items-center gap-3.5 transition-all text-right", s.theme === t.k ? "" : "opacity-70 hover:opacity-100")}
              style={{ borderColor: s.theme === t.k ? "var(--acc)" : "var(--line)" }}>
              <span className="w-14 h-10 rounded-lg flex-shrink-0 flex items-center justify-center gap-1" style={{ background: t.bg, border: "1px solid rgba(128,128,128,.25)" }}>
                <i className="w-2 h-6 rounded-sm" style={{ background: t.acc }} /><i className="w-6 h-6 rounded-sm" style={{ background: t.fg, opacity: 0.25 }} />
              </span>
              <span className="flex-1">
                <b className="text-[13.5px] block">{t.t}</b>
                <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{t.d}</span>
              </span>
              {s.theme === t.k && <Icon name="check" size={18} style={{ color: "var(--acc)" }} />}
            </button>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <h3 className="font-bold text-[14px] mb-3">رنگ سازمانی (Accent)</h3>
        <div className="flex gap-2.5 flex-wrap">
          {accents.map((c) => (
            <button key={c} onClick={() => updateSettings({ accent: c }, "Accent Color")}
              className={cx("w-11 h-11 rounded-xl transition-transform hover:scale-110", s.accent === c && "scale-110 ring-2 ring-offset-2")}
              style={{ background: c, ["--tw-ring-color" as never]: c }} aria-label={c}>
              {s.accent === c && <Icon name="check" size={18} className="mx-auto text-white" />}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-semibold mt-4 rounded-lg p-3" style={{ background: "var(--panel2)" }}>
          تم و رنگ در Settings ذخیره می‌شود (Hard-Code نیست) و بلافاصله روی همه صفحات اعمال می‌شود.
        </p>
        <div className="mt-4 rounded-xl p-4 border" style={{ borderColor: "var(--line)" }}>
          <p className="lbl !mb-2">پیش‌نمایش</p>
          <div className="flex gap-2">
            <span className="btn btn-acc btn-sm pointer-events-none">دکمه اصلی</span>
            <span className="btn btn-ghost btn-sm pointer-events-none">دکمه فرعی</span>
            <span className="badge b-ok">OK</span><span className="badge b-nok">NOK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
