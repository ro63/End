/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — داشبورد
   ------------------------------------------------------------
   ویجت‌ها: KPIها، تکمیل به تفکیک گروه، روند ۱۰ روزه، وضعیت
   شیفت‌ها، برترین ساعات کارکرد، فعالیت اخیر، اعلان‌ها.
   شخصی‌سازی: Add/Remove/Hide/Show + Save Layout + Reset
   ============================================================ */

import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Icon, BarChart, LineChart, Donut, Spark, Reveal, CountUp, ConnBadge } from "../components/ui";
import { cx, faNum, faOH, faDateLong, faTime, currentShift, shiftWorkDate, pdShift, timeAgo } from "../lib/utils";

const WIDGETS: { id: string; title: string; icon: string }[] = [
  { id: "completion", title: "تکمیل به تفکیک گروه", icon: "chart" },
  { id: "trend", title: "روند ۱۰ روز اخیر", icon: "history" },
  { id: "shift", title: "وضعیت شیفت‌ها", icon: "clock" },
  { id: "ohTop", title: "بالاترین ساعت کارکرد", icon: "gauge" },
  { id: "health", title: "سلامت تجهیزات", icon: "shield" },
  { id: "activity", title: "فعالیت اخیر", icon: "list" },
  { id: "notifs", title: "اعلان‌های اخیر", icon: "bell" },
];

export default function Dashboard() {
  const { db, user, updateSettings } = useStore();
  const [editMode, setEditMode] = useState(false);
  const layout = db.settings.dashLayout;
  const show = (id: string) => layout[id] !== false;

  const shift = currentShift(db.shifts);
  const today = shiftWorkDate(shift);

  /* ---------- محاسبات KPI ---------- */
  const stats = useMemo(() => {
    const activeEq = db.equipment.filter((e) => e.status === "active");
    const todayCtrls = db.controls.filter((c) => c.date === today && c.status !== "draft");
    const doneEq = new Set(todayCtrls.map((c) => c.equipmentId));
    const pending = activeEq.filter((e) => !doneEq.has(e.id));
    const hour = new Date().getHours();
    const overdue = hour >= 12 ? pending : activeEq.filter((e) => !doneEq.has(e.id) && e.status === "maintenance");
    const nokToday = todayCtrls.reduce((s, c) => s + c.nokCount, 0);
    const week = db.controls.filter((c) => c.status !== "draft" && c.date >= pdShift(new Date(), -7));
    const failures = week.filter((c) => c.answers.some((a) => a.failureLocationId)).length;
    const totalOH = db.deviceState.reduce((s, d) => s + d.current, 0);
    return { activeEq, todayCtrls, doneEq, pending, overdue, nokToday, failures, totalOH, week };
  }, [db, today]);

  const kpis = [
    { t: "کل تجهیزات", v: db.equipment.length, icon: "factory", c: "var(--info)" },
    { t: "تجهیزات فعال", v: stats.activeEq.length, icon: "check", c: "var(--ok)" },
    { t: "کنترل‌های امروز", v: stats.todayCtrls.length, icon: "clipboard", c: "var(--acc)" },
    { t: "در انتظار / عقب‌افتاده", v: stats.pending.length, icon: "clock", c: "var(--amber)" },
    { t: "موارد NOK امروز", v: stats.nokToday, icon: "alert", c: "var(--nok)" },
    { t: "خرابی ۷ روز", v: stats.failures, icon: "factory", c: "var(--nok)" },
  ];

  /* ---------- داده نمودارها ---------- */
  const completionData = db.groups.filter((g) => g.active)
    .map((g) => {
      const gEq = db.equipment.filter((e) => e.groupId === g.id && e.status === "active");
      const done = gEq.filter((e) => stats.doneEq.has(e.id)).length;
      return { label: g.name.replace("پرس هیدرولیک", "پرس").replace("کمپرسور اسکرو", "کمپرسور"), value: gEq.length ? Math.round((done / gEq.length) * 100) : 0, count: gEq.length };
    })
    .filter((d) => d.count > 0)
    .map(({ label, value }) => ({ label, value }));

  const trendDays = Array.from({ length: 10 }, (_, i) => pdShift(new Date(), -(9 - i)));
  const trendVals = trendDays.map((d) => db.controls.filter((c) => c.date === d && c.status !== "draft").length);
  const trendNok = trendDays.map((d) => db.controls.filter((c) => c.date === d && c.status !== "draft").reduce((s, c) => s + c.nokCount, 0));

  const ohTop = [...db.deviceState].sort((a, b) => b.current - a.current).slice(0, 5);
  const sparkFor = (eqId: string) => db.ohHistory.filter((h) => h.equipmentId === eqId).slice(0, 8).reverse().map((h) => h.value);

  const notifs = db.notifications.slice(0, 4);
  const logs = db.logs.slice(0, 6);

  return (
    <div>
      {/* ---------- سربرگ داشبورد ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-[27px] leading-none">
            سلام، {user?.firstName} 👋
          </h1>
          <p className="text-[13px] font-semibold mt-1.5 flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
            {faDateLong(new Date())}
            <span className="badge b-acc"><Icon name="clock" size={11} />{shift?.name ?? "—"}</span>
            <span className="badge b-mut">سال کاری {faNum(db.settings.operationalYear)}</span>
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button className={cx("btn btn-sm", editMode ? "btn-acc" : "btn-ghost")} onClick={() => setEditMode(!editMode)}>
            <Icon name="sliders" size={14} />{editMode ? "پایان شخصی‌سازی" : "شخصی‌سازی داشبورد"}
          </button>
          {editMode && (
            <button className="btn btn-sm btn-ghost" onClick={() => { updateSettings({ dashLayout: { completion: true, trend: true, shift: true, ohTop: true, health: true, activity: true, notifs: true } }); }}>
              <Icon name="refresh" size={13} />Reset
            </button>
          )}
        </div>
      </div>

      {editMode && (
        <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center pop-in no-print">
          <span className="text-[12px] font-bold ml-1" style={{ color: "var(--muted)" }}>ویجت‌ها را روشن/خاموش کنید — چیدمان ذخیره می‌شود:</span>
          {WIDGETS.map((w) => (
            <button key={w.id} onClick={() => updateSettings({ dashLayout: { ...layout, [w.id]: !show(w.id) } })}
              className={cx("badge !py-1.5 !px-3 cursor-pointer border", show(w.id) ? "b-ok" : "b-mut")}>
              <Icon name={w.icon} size={12} />{w.title}
              <Icon name={show(w.id) ? "check" : "x"} size={11} />
            </button>
          ))}
        </div>
      )}

      {/* ---------- KPIها ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {kpis.map((k, i) => (
          <Reveal key={k.t} delay={i * 60}>
            <div className="card p-4 relative overflow-hidden group hover:-translate-y-0.5 transition-transform">
              <span className="absolute -left-3 -bottom-3 opacity-[0.07] group-hover:opacity-[0.13] transition-opacity" style={{ color: k.c }}>
                <Icon name={k.icon} size={72} />
              </span>
              <p className="kpi-num" style={{ color: k.c }}><CountUp value={k.v} /></p>
              <p className="text-[11.5px] font-bold mt-1" style={{ color: "var(--muted)" }}>{k.t}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* ---------- کارت ویژه ساعت کارکرد کل ---------- */}
      <Reveal>
        <div className="rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3 border text-white"
          style={{ background: "linear-gradient(115deg, var(--side), var(--side2) 65%, color-mix(in srgb, var(--acc) 24%, var(--side2)))", borderColor: "var(--side-line)" }}>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--acc)", color: "var(--acc-ink)" }}><Icon name="gauge" size={22} /></span>
            <div>
              <p className="text-[11px] font-bold text-white/55">مجموع ساعت کارکرد ناوگان — بدون سقف، با ردیابی منبع</p>
              <p className="font-display text-[30px] leading-none ltr inline-block"><CountUp value={stats.totalOH} frac={1} /> <span className="text-[14px] text-white/50">h</span></p>
            </div>
          </div>
          <div className="flex gap-4 text-[11.5px] font-bold text-white/65">
            <span className="flex items-center gap-1.5"><ConnBadge state="connected" />{faNum(db.deviceState.filter((d) => d.connection === "connected").length)} دستگاه متصل به Gateway</span>
            <span className="flex items-center gap-1.5"><Icon name="clock" size={13} />Polling هر {faNum(db.settings.gatewayPollSec)} ثانیه</span>
          </div>
        </div>
      </Reveal>

      {/* ---------- ویجت‌ها ---------- */}
      <div className="grid lg:grid-cols-3 gap-4">
        {show("completion") && (
          <Reveal className="lg:col-span-2"><Widget title="درصد تکمیل کنترل امروز به تفکیک گروه" icon="chart" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, completion: false } })}>
            <BarChart data={completionData} h={170} />
          </Widget></Reveal>
        )}
        {show("trend") && (
          <Reveal><Widget title="روند کنترل‌های روزانه (۱۰ روز)" icon="history" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, trend: false } })}>
            <LineChart points={trendVals} labels={trendDays.map((d) => d.slice(5))} h={150} />
            <p className="text-[10.5px] font-bold mt-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              <i className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--nok)" }} />مجموع NOK این بازه: {faNum(trendNok.reduce((a, b) => a + b, 0))}
            </p>
          </Widget></Reveal>
        )}
        {show("shift") && (
          <Reveal><Widget title="شیفت‌های کاری" icon="clock" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, shift: false } })}>
            <div className="space-y-2.5">
              {db.shifts.filter((s) => s.active).map((s) => {
                const isNow = s.id === shift?.id;
                return (
                  <div key={s.id} className={cx("rounded-lg px-3.5 py-2.5 flex items-center justify-between border transition-all", isNow && "shadow-md")}
                    style={isNow ? { borderColor: "var(--acc)", background: "var(--acc-soft)" } : { borderColor: "var(--line)" }}>
                    <div>
                      <p className="font-bold text-[13px] flex items-center gap-2">{s.name}{isNow && <span className="badge b-acc"><span className="w-1.5 h-1.5 rounded-full blink" style={{ background: "currentColor" }} />فعال</span>}</p>
                      <p className="text-[11px] font-semibold ltr inline-block" style={{ color: "var(--muted)" }}>{s.start} → {s.end}</p>
                    </div>
                    <p className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
                      {faNum(db.controls.filter((c) => c.date === today && c.shiftId === s.id && c.status !== "draft").length)} کنترل
                    </p>
                  </div>
                );
              })}
              <p className="text-[10.5px] font-semibold" style={{ color: "var(--muted)" }}>⚠ شیفت شب (۲۲:۰۰ تا ۰۶:۰۰) با عبور از مرز روز به‌درستی محاسبه می‌شود.</p>
            </div>
          </Widget></Reveal>
        )}
        {show("ohTop") && (
          <Reveal className="lg:col-span-2"><Widget title="بالاترین ساعت کارکرد تجهیزات" icon="gauge" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, ohTop: false } })}>
            <div className="space-y-2">
              {ohTop.map((d) => {
                const eq = db.equipment.find((e) => e.id === d.equipmentId);
                if (!eq) return null;
                return (
                  <div key={d.equipmentId} className="flex items-center gap-3 rounded-lg px-3 py-2 panel2 border" style={{ borderColor: "var(--line)" }}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}><Icon name="gauge" size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[12.5px] truncate">{eq.name}</p>
                      <p className="text-[10.5px] font-semibold ltr inline-block" style={{ color: "var(--muted)" }}>{eq.device.protocol.toUpperCase()} • {d.lastRead ? faTime(d.lastRead) : "دستی"}</p>
                    </div>
                    <Spark points={sparkFor(d.equipmentId).length > 1 ? sparkFor(d.equipmentId) : [d.current, d.current]} />
                    <p className="font-display text-[19px] ltr w-[92px] text-left">{faOH(d.current)}<span className="text-[11px] opacity-50"> h</span></p>
                  </div>
                );
              })}
            </div>
          </Widget></Reveal>
        )}
        {show("health") && (
          <Reveal><Widget title="سلامت تجهیزات امروز" icon="shield" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, health: false } })}>
            <div className="flex items-center justify-center gap-5 py-2">
              <Donut size={140} thick={18} centerLabel={<><span className="font-display text-[24px] leading-none">{faNum(Math.round((stats.doneEq.size / Math.max(1, stats.activeEq.length)) * 100))}٪</span><span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>پوشش امروز</span></>}
                parts={[
                  { value: stats.todayCtrls.filter((c) => c.nokCount === 0 && c.oorCount === 0).length, color: "var(--ok)", label: "سالم" },
                  { value: stats.todayCtrls.filter((c) => c.nokCount > 0 || c.oorCount > 0).length, color: "var(--nok)", label: "دارای مشکل" },
                  { value: Math.max(0, stats.activeEq.length - stats.todayCtrls.length), color: "var(--line2)", label: "کنترل‌نشده" },
                ]} />
              <div className="space-y-1.5 text-[11.5px] font-bold">
                <p className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--ok)" }} />سالم: {faNum(stats.todayCtrls.filter((c) => c.nokCount === 0 && c.oorCount === 0).length)}</p>
                <p className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--nok)" }} />دارای مشکل: {faNum(stats.todayCtrls.filter((c) => c.nokCount > 0 || c.oorCount > 0).length)}</p>
                <p className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--line2)" }} />کنترل‌نشده: {faNum(Math.max(0, stats.activeEq.length - stats.todayCtrls.length))}</p>
              </div>
            </div>
          </Widget></Reveal>
        )}
        {show("activity") && (
          <Reveal className="lg:col-span-2"><Widget title="فعالیت اخیر سامانه" icon="list" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, activity: false } })}>
            <div className="space-y-1.5">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 text-[12px] font-semibold rounded-lg px-3 py-2 transition-colors hover:bg-[var(--panel2)]">
                  <span className={cx("w-2 h-2 rounded-full flex-shrink-0")} style={{ background: l.result === "success" ? "var(--ok)" : l.result === "failed" ? "var(--nok)" : "var(--amber)" }} />
                  <span className="flex-1 truncate"><b>{l.username || "سیستم"}</b> — {l.action} <span style={{ color: "var(--muted)" }}>({l.entity})</span></span>
                  <span className="text-[10.5px] flex-shrink-0" style={{ color: "var(--muted)" }}>{timeAgo(l.at)}</span>
                </div>
              ))}
            </div>
          </Widget></Reveal>
        )}
        {show("notifs") && (
          <Reveal><Widget title="اعلان‌های اخیر" icon="bell" editMode={editMode} onHide={() => updateSettings({ dashLayout: { ...layout, notifs: false } })}>
            <div className="space-y-2">
              {notifs.map((n) => (
                <div key={n.id} className={cx("rounded-lg px-3 py-2.5 border text-[12px] font-semibold", !n.read && "border-r-[3px]")}
                  style={{ borderColor: "var(--line)", borderRightColor: !n.read ? "var(--acc)" : undefined }}>
                  <p className="font-bold truncate">{n.title}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{n.body}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(n.at)}</p>
                </div>
              ))}
            </div>
          </Widget></Reveal>
        )}
      </div>
    </div>
  );
}

function Widget({ title, icon, children, editMode, onHide }: { title: string; icon: string; children: React.ReactNode; editMode: boolean; onHide: () => void }) {
  return (
    <div className="card p-4 h-full relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[13.5px] flex items-center gap-2">
          <Icon name={icon} size={16} style={{ color: "var(--acc)" }} />{title}
        </h3>
        {editMode && <button className="btn btn-ghost btn-sm !px-2 no-print" onClick={onHide} title="پنهان کردن ویجت"><Icon name="x" size={14} /></button>}
      </div>
      {children}
    </div>
  );
}
