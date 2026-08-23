/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — صفحه ورود (Login)
   ------------------------------------------------------------
   • لوگوی شرکت (آپلودی از Branding یا دارایی پیش‌فرض سیستم)
   • نمایش/پنهان‌سازی رمز، Enter برای ورود، حالت Loading
   • Rate Limiting (۵ تلاش ناموفق → قفل ۶۰ ثانیه‌ای)
   • Remember Me امن + مدیریت نشست با Timeout قابل تنظیم
   • حساب‌های دمو برای ارزیابی سریع نقش‌ها
   ============================================================ */

import { useState } from "react";
import { useStore } from "../lib/store";
import { Icon, Logo } from "../components/ui";
import { cx, faNum, faDateLong } from "../lib/utils";

const LOGIN_BG = "https://image.qwenlm.ai/generated-images/25f0b5f9-03e4-4047-a815-ba0dfe6911b5/_result.png";

const demoAccounts = [
  { u: "admin", p: "admin1405", label: "مدیر سیستم", icon: "shield" },
  { u: "takhti", p: "123456", label: "سرپرست نت", icon: "clipboard" },
  { u: "esfandiyari", p: "123456", label: "تکنسین برق", icon: "zap" },
  { u: "fardin", p: "123456", label: "تکنسین مکانیک", icon: "gauge" },
  { u: "viewer", p: "123456", label: "ناظر", icon: "eye" },
];

export default function Login() {
  const { login, db } = useStore();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imgOk, setImgOk] = useState(true);
  const [customLoginLogo] = useState(db.settings.loginLogoDataUrl);

  async function doLogin() {
    if (loading) return;
    if (!username.trim() || !pw) { setError("نام کاربری و رمز عبور را وارد کنید"); return; }
    setLoading(true); setError("");
    const res = await login(username, pw, remember);
    setLoading(false);
    if (!res.ok) setError(res.error ?? "خطا در ورود");
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--side)" }}>
      {/* ---------- پنل صنعتی — پس‌زمینه از تنظیمات برندینگ انتخاب می‌شود ---------- */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(140deg,#101823,#0b1119 60%,#0d1520)" }} />
        {db.settings.loginBg === "image" && imgOk && (
          <img src={LOGIN_BG} alt="" onError={() => setImgOk(false)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
            style={{ maskImage: "linear-gradient(105deg, black 55%, transparent 95%)" }} />
        )}
        {/* الگوی فنی — گرید مهندسی */}
        {db.settings.loginBg === "pattern" && (
          <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        )}
        <div className="absolute inset-0" style={{ background: db.settings.loginBg === "image" ? "linear-gradient(90deg, rgba(11,17,25,0.25), rgba(11,17,25,0.9))" : "radial-gradient(circle at 75% 15%, color-mix(in srgb, var(--acc) 26%, transparent), transparent 42%)" }} />
        <div className="hazard absolute top-0 inset-x-0" />

        <div className="relative z-10 p-10">
          <Logo size={52} light />
        </div>

        <div className="relative z-10 px-10 pb-10 text-white max-w-xl">
          <p className="font-display text-[42px] leading-[1.25] fade-up">
            سامانه کنترل و بازدید<br />روزانه تجهیزات
          </p>
          <p className="text-[13px] font-bold mt-3 fade-up" style={{ color: "var(--acc)", animationDelay: "80ms" }}>
            {db.settings.brandNameFa} — {db.settings.tagline}
          </p>
          <p className="text-white/65 text-[13.5px] mt-2 leading-7 fade-up" style={{ animationDelay: "120ms" }}>
            از اسکن QR روی بدنه دستگاه تا ثبت نتیجه، ساعت کارکرد و Sync خودکار —
            همه در یک چرخه سریع و آفلاین‌اول برای تبلت‌های صنعتی.
          </p>
          <div className="flex gap-3 mt-7 fade-up" style={{ animationDelay: "220ms" }}>
            {[
              { icon: "scan", t: "اسکن و شروع فوری" },
              { icon: "wifioff", t: "کار در حالت آفلاین" },
              { icon: "plug", t: "خواندن ساعت از PLC" },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold border"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)" }}>
                <Icon name={f.icon} size={15} className="text-[var(--acc)]" />{f.t}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-10 pb-8 flex items-center justify-between text-white/45 text-[11.5px] font-semibold">
          <span>{faDateLong(new Date())}</span>
          <span dir="auto">{db.settings.brandNameEn} DECS v1.0.0</span>
        </div>
      </div>

      {/* ---------- فرم ورود ---------- */}
      <div className="flex-1 flex items-center justify-center p-5 relative" style={{ background: "var(--bg)" }}>
        <div className="hazard absolute top-0 inset-x-0 lg:hidden" />
        <div className="w-full max-w-[420px] fade-up">
          <div className="lg:hidden mb-7 flex justify-center"><Logo size={46} /></div>

          <div className="card p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.06] pointer-events-none"><Icon name="factory" size={96} /></div>
            <h1 className="font-display text-[26px]">ورود به سامانه</h1>
            <p className="text-[12.5px] font-semibold mb-6" style={{ color: "var(--muted)" }}>
              شرکت قطعه‌سازی خودرو NIPCO — دسترسی بدون ورود مجاز نیست
            </p>

            {error && (
              <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 mb-4 text-[12.5px] font-bold pop-in"
                style={{ background: "var(--nok-soft)", color: "var(--nok)" }}>
                <Icon name="alert" size={16} />{error}
              </div>
            )}

            <label className="lbl">نام کاربری</label>
            <div className="relative mb-4">
              <input className="inp !pr-10 ltr !text-left" dir="ltr" value={username} autoFocus
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
                placeholder="admin" />
              <Icon name="users" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-45" />
            </div>

            <label className="lbl">رمز عبور</label>
            <div className="relative mb-3">
              <input className="inp !pr-10 !pl-10 ltr !text-left" dir="ltr" type={show ? "text" : "password"}
                value={pw} onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
                placeholder="••••••••" />
              <Icon name="lock" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-45" />
              <button type="button" onClick={() => setShow(!show)} aria-label="نمایش رمز"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-90 transition-opacity">
                <Icon name={show ? "eyeoff" : "eye"} size={17} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-5 text-[12px] font-semibold">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => setRemember(!remember)} aria-label="مرا به خاطر بسپار"
                  className={cx("w-[17px] h-[17px] rounded-[5px] border flex items-center justify-center transition-colors")}
                  style={remember ? { background: "var(--acc)", borderColor: "var(--acc)", color: "var(--acc-ink)" } : { borderColor: "var(--line2)" }}>
                  {remember && <Icon name="check" size={11} />}
                </button>
                <span style={{ color: "var(--muted)" }}>مرا به خاطر بسپار</span>
              </label>
              <span className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Icon name="shield" size={13} />رمزگذاری bcrypt در سرور
              </span>
            </div>

            <button className="btn btn-acc btn-lg w-full" onClick={doLogin} disabled={loading}>
              {loading ? (<><span className="spin inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent" />در حال اعتبارسنجی…</>) : (<><Icon name="logout" size={17} />ورود به سامانه</>)}
            </button>

            <div className="mt-6">
              <p className="lbl !mb-2 flex items-center gap-1.5"><Icon name="key" size={13} />حساب‌های دمو — برای لمس هر نقش:</p>
              <div className="flex flex-wrap gap-1.5">
                {demoAccounts.map((d) => (
                  <button key={d.u} type="button"
                    onClick={() => { setUsername(d.u); setPw(d.p); setError(""); }}
                    className={cx("badge !py-1.5 !px-2.5 cursor-pointer border transition-all hover:scale-[1.03]",
                      username === d.u ? "b-acc" : "b-mut")}>
                    <Icon name={d.icon} size={12} />{d.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-2.5 font-semibold" style={{ color: "var(--muted)" }}>
                رمز همه حساب‌های دمو به‌جز مدیر: <b className="ltr inline-block">123456</b> — بعد از ۵ تلاش اشتباه، ۶۰ ثانیه قفل می‌شود.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-5 text-[11px] font-bold" style={{ color: "var(--muted)" }}>
            <span>طراح و تحلیلگر سیستم: محمد روشندل</span>
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--line2)" }} />
            <span>نسخه {faNum(1)}.{faNum(0)}.{faNum(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
