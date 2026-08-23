/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — گزارشات (Reports)
   ------------------------------------------------------------
   • تقویم‌ها کاملاً شمسی (انتخابگر جلالی + فیلتر سال/ماه شمسی)
   • فیلترهای کامل و ترکیبی: بازه/سال/ماه/شیفت/گروه/تجهیز/
     تکنسین/نتیجه/محل خرابی/برند/منبع
   • هر تب = دو بخش جدا: «نمودار» (با تغییر نوع Chart) و «لیست»
   • خروجی Excel/CSV + چاپ/PDF با Permission
   ============================================================ */

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import type { DailyControl } from "../lib/types";
import { Icon, BarChart, LineChart, Donut, Seg, Empty, Logo, JalaliDatePicker } from "../components/ui";
import { cx, faNum, faOH, faTime, pdToday, pdShift, download, toCSV, J_MONTHS } from "../lib/utils";

type Tab = "controls" | "failures" | "oh";
type Range = "today" | "7d" | "30d" | "all" | "custom";
type Kind = "bar" | "line" | "donut";

const DONUT_COLORS = ["var(--acc)", "var(--info)", "var(--ok)", "var(--amber)", "var(--nok)", "#7e57c2", "#26a69a", "#8d6e63"];

/* ---------- سربرگ بخش (نمودار / لیست) ---------- */
function Section({ icon, title, sub, toolbar, children }: {
  icon: string; title: string; sub?: string; toolbar?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="card overflow-hidden fade-up">
      <header className="px-4 py-3 flex items-center gap-3 flex-wrap border-b panel2" style={{ borderColor: "var(--line)" }}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
          <Icon name={icon} size={16} />
        </span>
        <div className="flex-1 min-w-[120px]">
          <h3 className="font-bold text-[14px] leading-none">{title}</h3>
          {sub && <p className="text-[10.5px] font-semibold mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
        </div>
        {toolbar}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function Reports() {
  const { db, can } = useStore();
  const [tab, setTab] = useState<Tab>("controls");

  /* ---------- فیلترهای کامل ---------- */
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fYear, setFYear] = useState("all");
  const [fMonth, setFMonth] = useState("all");
  const [fShift, setFShift] = useState("all");
  const [fGroup, setFGroup] = useState("all");
  const [fEq, setFEq] = useState("all");
  const [fUser, setFUser] = useState("all");
  const [fResult, setFResult] = useState("all");
  const [fFailLoc, setFFailLoc] = useState("all");
  const [fBrand, setFBrand] = useState("all");
  const [fSource, setFSource] = useState("all");
  /* نوع نمودار هر تب — جدا نگهداری می‌شود */
  const [kControls, setKControls] = useState<Kind>("bar");
  const [kFail, setKFail] = useState<Kind>("bar");
  const [kOh, setKOh] = useState<Kind>("bar");
  const [metric, setMetric] = useState<"controls" | "nok" | "oh">("controls");
  const [expanded, setExpanded] = useState("");

  /* ---------- بازه زمانی (شمسی) ---------- */
  const [start, end] = useMemo((): [string, string] => {
    const t = pdToday();
    if (range === "today") return [t, t];
    if (range === "7d") return [pdShift(new Date(), -6), t];
    if (range === "30d") return [pdShift(new Date(), -29), t];
    if (range === "custom" && from && to) return [from, to];
    return ["0000/00/00", "9999/99/99"];
  }, [range, from, to]);

  const eqOf = (id: string) => db.equipment.find((e) => e.id === id);
  const eqName = (id: string) => eqOf(id)?.name ?? "—";
  const userName = (id: string) => { const u = db.users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : "—"; };
  const brands = useMemo(() => [...new Set(db.equipment.map((e) => e.brand).filter(Boolean))], [db.equipment]);
  /* سال‌ها و ماه‌های شمسی موجود در داده‌ها */
  const years = useMemo(() => [...new Set([...db.controls, ...db.ohHistory.map((h) => ({ date: h.date }))].map((c) => c.date.slice(0, 4)))].sort(), [db]);

  /* ---------- اعمال فیلترهای ترکیبی روی کنترل‌ها ---------- */
  const filtered = useMemo(() => db.controls.filter((c) => {
    if (c.status === "draft") return false;
    if (c.date < start || c.date > end) return false;
    const [cy, cm] = c.date.split("/");
    if (fYear !== "all" && cy !== fYear) return false;
    if (fMonth !== "all" && String(parseInt(cm)) !== fMonth) return false;
    if (fShift !== "all" && c.shiftId !== fShift) return false;
    if (fUser !== "all" && c.userId !== fUser) return false;
    const eq = eqOf(c.equipmentId);
    if (fGroup !== "all" && eq?.groupId !== fGroup) return false;
    if (fEq !== "all" && c.equipmentId !== fEq) return false;
    if (fBrand !== "all" && eq?.brand !== fBrand) return false;
    if (fResult === "healthy" && (c.nokCount > 0 || c.oorCount > 0)) return false;
    if (fResult === "nok" && c.nokCount === 0) return false;
    if (fResult === "oor" && c.oorCount === 0) return false;
    if (fFailLoc !== "all" && !c.answers.some((a) => a.failureLocationId === fFailLoc)) return false;
    return true;
  }), [db, start, end, fYear, fMonth, fShift, fGroup, fEq, fUser, fResult, fFailLoc, fBrand]); // eslint-disable-line

  /* ---------- داده خرابی‌ها ---------- */
  const failures = useMemo(() => {
    const list = filtered.flatMap((c) => c.answers.filter((a) => a.failureLocationId || a.result === "nok").map((a) => ({ c, a })));
    const byLoc = new Map<string, number>();
    const byEq = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const { c, a } of list) {
      if (a.failureLocationId) byLoc.set(a.failureLocationId, (byLoc.get(a.failureLocationId) ?? 0) + 1);
      byEq.set(c.equipmentId, (byEq.get(c.equipmentId) ?? 0) + 1);
      byDay.set(c.date, (byDay.get(c.date) ?? 0) + 1);
    }
    return { list, byLoc, byEq, byDay };
  }, [filtered]);

  /* ---------- ردیف‌های ساعت کارکرد (با فیلتر منبع) ---------- */
  const ohRows = useMemo(() => db.ohHistory.filter((h) => {
    if (h.date < start || h.date > end) return false;
    const [hy, hm] = h.date.split("/");
    if (fYear !== "all" && hy !== fYear) return false;
    if (fMonth !== "all" && String(parseInt(hm)) !== fMonth) return false;
    if (fEq !== "all" && h.equipmentId !== fEq) return false;
    if (fGroup !== "all" && eqOf(h.equipmentId)?.groupId !== fGroup) return false;
    if (fSource !== "all" && h.source !== fSource) return false;
    return true;
  }), [db.ohHistory, start, end, fYear, fMonth, fEq, fGroup, fSource]); // eslint-disable-line

  /* ---------- روزهای شمسی بازه (برای نمودارها) ---------- */
  const days = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < 400; i++) { const d = pdShift(new Date(), -i); if (d >= start && d <= end) set.add(d); if (d < start) break; }
    return [...set].sort().slice(-60);
  }, [start, end]);

  const metricVals = days.map((d) => {
    const cs = filtered.filter((c) => c.date === d);
    if (metric === "controls") return cs.length;
    if (metric === "nok") return cs.reduce((s, c) => s + c.nokCount, 0);
    return Math.round(cs.reduce((s, c) => s + (c.oh ? Math.max(0, c.oh.value - c.oh.previous) : 0), 0) * 10) / 10;
  });
  const donutByGroup = db.groups.map((g, gi) => ({
    label: g.name, value: filtered.filter((c) => eqOf(c.equipmentId)?.groupId === g.id).length, color: DONUT_COLORS[gi % 8],
  })).filter((x) => x.value > 0);
  const donutByLoc = [...failures.byLoc.entries()].map(([id, v], i) => ({
    label: db.failureLocations.find((f) => f.id === id)?.name ?? "—", value: v, color: DONUT_COLORS[i % 8],
  }));
  const donutBySrc = (["auto", "manual", "adjusted"] as const).map((s, i) => ({
    label: s === "auto" ? "Auto (دستگاه)" : s === "manual" ? "Manual (دستی)" : "Adjusted (اصلاح)",
    value: ohRows.filter((h) => h.source === s).length, color: DONUT_COLORS[i % 8],
  })).filter((x) => x.value > 0);

  const activeFilters = [range === "custom", fYear !== "all", fMonth !== "all", fShift !== "all", fGroup !== "all", fEq !== "all", fUser !== "all", fResult !== "all", fFailLoc !== "all", fBrand !== "all", fSource !== "all"].filter(Boolean).length;
  const clearAll = () => { setRange("7d"); setFrom(""); setTo(""); setFYear("all"); setFMonth("all"); setFShift("all"); setFGroup("all"); setFEq("all"); setFUser("all"); setFResult("all"); setFFailLoc("all"); setFBrand("all"); setFSource("all"); };

  const itemTitle = (clId: string, itemId: string) => {
    const cl = db.checklists.find((x) => x.id === clId);
    for (const s of cl?.sections ?? []) for (const i of s.items) if (i.id === itemId) return { t: i.title, unit: i.unit ?? "" };
    return { t: itemId, unit: "" };
  };
  const canExport = can("reports", "export");

  /* ---------- خروجی CSV هر تب ---------- */
  const exportTab = () => {
    if (tab === "controls") download("nipco-controls.csv", toCSV(
      ["تاریخ", "تجهیز", "گروه", "برند", "چک‌لیست", "شیفت", "تکنسین", "OK", "NOK", "خارج محدوده", "ساعت کارکرد"],
      filtered.map((c) => { const e = eqOf(c.equipmentId); return [c.date, e?.name ?? "", db.groups.find((g) => g.id === e?.groupId)?.name ?? "", e?.brand ?? "", db.checklists.find((x) => x.id === c.checklistId)?.name ?? "", db.shifts.find((s) => s.id === c.shiftId)?.name ?? "", userName(c.userId), c.answers.length - c.nokCount - c.oorCount, c.nokCount, c.oorCount, c.oh ? c.oh.value : ""]; })), "text/csv");
    else if (tab === "failures") download("nipco-failures.csv", toCSV(
      ["تاریخ", "تجهیز", "شرح", "محل خرابی", "تکنسین", "شیفت"],
      failures.list.map(({ c, a }) => [c.date, eqName(c.equipmentId), a.description, db.failureLocations.find((f) => f.id === a.failureLocationId)?.name ?? "—", userName(c.userId), db.shifts.find((s) => s.id === c.shiftId)?.name ?? ""])), "text/csv");
    else download("nipco-operating-hours.csv", toCSV(
      ["تاریخ", "زمان", "تجهیز", "قبلی", "جدید", "اختلاف", "منبع", "کاربر", "دلیل"],
      ohRows.map((h) => [h.date, h.time, eqName(h.equipmentId), h.previous, h.value, h.diff, h.source, db.users.find((u) => u.id === h.userId)?.username ?? "—", h.reason ?? ""])), "text/csv");
  };

  const selCls = "inp !w-auto !py-1.5 text-[12px]";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 no-print">
        <div>
          <h1 className="font-display text-[26px] leading-none">گزارشات</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            بازه {start === end ? start : `${start} تا ${end}`} • {faNum(filtered.length)} کنترل • {faNum(ohRows.length)} رکورد ساعت کارکرد
          </p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "controls", label: "کنترل‌ها", icon: "clipboard" },
          { v: "failures", label: "خرابی‌ها", icon: "alert" },
          { v: "oh", label: "ساعت کارکرد", icon: "gauge" },
        ]} />
      </div>

      {/* ================= فیلترهای کامل ================= */}
      <div className="card p-3.5 mb-4 space-y-2.5 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="filter" size={15} className="opacity-50" />
          <span className="text-[11.5px] font-bold" style={{ color: "var(--muted)" }}>بازه:</span>
          {([["today", "امروز"], ["7d", "۷ روز"], ["30d", "۳۰ روز"], ["all", "همه"], ["custom", "سفارشی"]] as [Range, string][]).map(([r, l]) => (
            <button key={r} onClick={() => setRange(r)} className={cx("badge !py-1.5 !px-2.5 cursor-pointer border", range === r ? "b-acc" : "b-mut")}>{l}</button>
          ))}
          {range === "custom" && (
            <span className="flex gap-1.5 items-center flex-wrap">
              <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>از</span>
              <JalaliDatePicker value={from} onChange={setFrom} className="w-[168px]" />
              <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>تا</span>
              <JalaliDatePicker value={to} onChange={setTo} className="w-[168px]" />
            </span>
          )}
          <button className="btn btn-ghost btn-sm mr-auto" onClick={clearAll} disabled={activeFilters === 0}>
            <Icon name="x" size={13} />پاک‌کردن فیلترها {activeFilters > 0 && <span className="badge b-acc !text-[9.5px] !px-1.5">{faNum(activeFilters)}</span>}
          </button>
        </div>
        {/* ردیف فیلترهای تفصیلی — همه قابل ترکیب */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <select className={selCls} value={fYear} onChange={(e) => setFYear(e.target.value)}>
            <option value="all">همه سال‌ها</option>{years.map((y) => <option key={y} value={y}>{faNum(y)}</option>)}
          </select>
          <select className={selCls} value={fMonth} onChange={(e) => setFMonth(e.target.value)}>
            <option value="all">همه ماه‌ها</option>{J_MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
          <select className={selCls} value={fShift} onChange={(e) => setFShift(e.target.value)}><option value="all">همه شیفت‌ها</option>{db.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className={selCls} value={fGroup} onChange={(e) => { setFGroup(e.target.value); setFEq("all"); }}><option value="all">همه گروه‌ها</option>{db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <select className={selCls} value={fEq} onChange={(e) => setFEq(e.target.value)}><option value="all">همه تجهیزات</option>{db.equipment.filter((e) => fGroup === "all" || e.groupId === fGroup).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select className={selCls} value={fUser} onChange={(e) => setFUser(e.target.value)}><option value="all">همه تکنسین‌ها</option>{db.users.filter((u) => !u.deleted).map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</select>
          {tab !== "oh" && (
            <>
              <select className={selCls} value={fResult} onChange={(e) => setFResult(e.target.value)}><option value="all">همه نتایج</option><option value="healthy">سالم</option><option value="nok">دارای NOK</option><option value="oor">خارج از محدوده</option></select>
              <select className={selCls} value={fFailLoc} onChange={(e) => setFFailLoc(e.target.value)}><option value="all">همه محل‌های خرابی</option>{db.failureLocations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <select className={selCls} value={fBrand} onChange={(e) => setFBrand(e.target.value)}><option value="all">همه برندها</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}</select>
            </>
          )}
          {tab === "oh" && (
            <select className={selCls} value={fSource} onChange={(e) => setFSource(e.target.value)}><option value="all">همه منابع</option><option value="auto">Auto (دستگاه)</option><option value="manual">Manual (دستی)</option><option value="adjusted">Adjusted (اصلاح)</option></select>
          )}
          <div className="mr-auto flex gap-1.5">
            <button className="btn btn-ghost btn-sm" disabled={!canExport} onClick={exportTab} title={canExport ? "خروجی Excel/CSV" : "Permission خروجی ندارید"}>
              <Icon name="download" size={13} />Excel
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon name="printer" size={13} />چاپ / PDF</button>
          </div>
        </div>
      </div>

      {/* سربرگ چاپ */}
      <div className="hidden print:flex items-center justify-between mb-4 pb-3 border-b">
        {db.settings.reportLogoDataUrl ? <img src={db.settings.reportLogoDataUrl} alt="لوگو" style={{ maxHeight: 40 }} /> : <Logo size={34} />}
        <p className="font-bold text-[13px]">{db.settings.brandNameFa} — گزارش {tab === "controls" ? "کنترل‌های روزانه" : tab === "failures" ? "خرابی‌ها" : "ساعت کارکرد"} ({start} تا {end})</p>
      </div>

      {/* ================= تب کنترل‌ها ================= */}
      {tab === "controls" && (
        <div className="space-y-4">
          <Section icon="chart" title="نمودار کنترل‌ها" sub={`روزهای بازه: ${faNum(days.length)} — نوع نمودار و معیار قابل تغییر است`}
            toolbar={
              <div className="flex gap-2 flex-wrap">
                <Seg size="sm" value={metric} onChange={setMetric} options={[{ v: "controls", label: "تعداد کنترل" }, { v: "nok", label: "موارد NOK" }, { v: "oh", label: "کارکرد (h)" }]} />
                <Seg size="sm" value={kControls} onChange={setKControls} options={[{ v: "bar", label: "ستونی", icon: "chart" }, { v: "line", label: "خطی", icon: "history" }, { v: "donut", label: "دایره‌ای", icon: "shield" }]} />
              </div>
            }>
            {kControls === "bar" && <BarChart h={200} data={days.map((d, i) => ({ label: d.slice(5), value: metricVals[i] }))} />}
            {kControls === "line" && <LineChart h={200} points={metricVals} labels={days.map((d) => d.slice(5))} suffix={metric === "oh" ? " h" : ""} />}
            {kControls === "donut" && (
              <div className="flex flex-wrap items-center justify-center gap-8 py-2">
                <Donut size={190} thick={24} centerLabel={<><span className="font-display text-[26px]">{faNum(filtered.length)}</span><span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>کنترل</span></>} parts={donutByGroup} />
                <div className="space-y-1.5">{donutByGroup.map((g) => <p key={g.label} className="flex items-center gap-2 text-[12px] font-bold"><i className="w-3 h-3 rounded-sm" style={{ background: g.color }} />{g.label}: {faNum(g.value)}</p>)}</div>
              </div>
            )}
            {days.length === 0 && <Empty icon="chart" title="داده‌ای در این بازه نیست" />}
          </Section>

          <Section icon="list" title="لیست کنترل‌ها" sub={`${faNum(filtered.length)} رکورد — برای جزئیات آیتم‌ها روی ردیف کلیک کنید`}
            toolbar={<span className="badge b-mut">آخرین {faNum(Math.min(60, filtered.length))} مورد</span>}>
            <div className="overflow-x-auto -mx-4 -mb-4 px-4 pb-1">
              <table className="tbl min-w-[840px]">
                <thead><tr><th></th><th>تاریخ</th><th>تجهیز</th><th>گروه</th><th>شیفت</th><th>تکنسین</th><th>نتیجه</th><th>ساعت کارکرد</th><th>ثبت</th></tr></thead>
                <tbody>
                  {filtered.slice(0, 60).map((c) => (
                    <Row key={c.id} c={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? "" : c.id)}
                      eqName={eqName(c.equipmentId)} groupName={db.groups.find((g) => g.id === eqOf(c.equipmentId)?.groupId)?.name ?? "—"}
                      shiftName={db.shifts.find((s) => s.id === c.shiftId)?.name ?? "—"}
                      userName={userName(c.userId)} itemTitle={itemTitle}
                      failLoc={(id?: string) => db.failureLocations.find((f) => f.id === id)?.name} />
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={9}><Empty icon="clipboard" title="گزارشی مطابق فیلترها نیست" sub="بازه یا فیلترها را تغییر دهید" /></td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* ================= تب خرابی‌ها ================= */}
      {tab === "failures" && (
        <div className="space-y-4">
          <Section icon="chart" title="نمودار خرابی‌ها" sub="تعداد، تجهیزات و محل‌های پرتکرار + روند روزانه"
            toolbar={<Seg size="sm" value={kFail} onChange={setKFail} options={[{ v: "bar", label: "به تفکیک محل", icon: "chart" }, { v: "line", label: "روند روزانه", icon: "history" }, { v: "donut", label: "سهم محل‌ها", icon: "shield" }]} />}>
            {kFail === "bar" && (failures.byLoc.size > 0
              ? <BarChart h={200} data={[...failures.byLoc.entries()].map(([id, v]) => ({ label: db.failureLocations.find((f) => f.id === id)?.name ?? "—", value: v, color: "var(--nok)" }))} />
              : <Empty icon="shield" title="خرابی ثبت‌شده‌ای نیست" />)}
            {kFail === "line" && <LineChart h={200} points={days.map((d) => failures.byDay.get(d) ?? 0)} labels={days.map((d) => d.slice(5))} />}
            {kFail === "donut" && (donutByLoc.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-8 py-2">
                <Donut size={190} thick={24} centerLabel={<><span className="font-display text-[26px]">{faNum(failures.list.length)}</span><span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>خرابی</span></>} parts={donutByLoc} />
                <div className="space-y-1.5">{donutByLoc.map((g) => <p key={g.label} className="flex items-center gap-2 text-[12px] font-bold"><i className="w-3 h-3 rounded-sm" style={{ background: g.color }} />{g.label}: {faNum(g.value)}</p>)}</div>
              </div>
            ) : <Empty icon="shield" title="خرابی ثبت‌شده‌ای نیست" />)}
          </Section>

          <Section icon="alert" title="لیست خرابی‌ها" sub={`${faNum(failures.list.length)} مورد NOK/خرابی در بازه انتخابی`}>
            <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
              {[
                { t: "کل خرابی‌ها", v: faNum(failures.list.length), c: "var(--nok)" },
                { t: "پرتکرارترین تجهیز", v: failures.byEq.size ? eqName([...failures.byEq.entries()].sort((a, b) => b[1] - a[1])[0][0]) : "—", c: "var(--amber)" },
                { t: "پرتکرارترین محل", v: failures.byLoc.size ? db.failureLocations.find((f) => f.id === [...failures.byLoc.entries()].sort((a, b) => b[1] - a[1])[0][0])?.name : "—", c: "var(--info)" },
              ].map((s) => (
                <div key={s.t} className="rounded-xl p-3.5 text-center panel2 border" style={{ borderColor: "var(--line)" }}>
                  <p className="font-display text-[18px] leading-tight truncate" style={{ color: s.c }}>{s.v}</p>
                  <p className="text-[10.5px] font-bold mt-0.5" style={{ color: "var(--muted)" }}>{s.t}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto -mx-4 -mb-4 px-4 pb-1">
              <table className="tbl min-w-[760px]">
                <thead><tr><th>تاریخ</th><th>تجهیز</th><th>شرح خرابی</th><th>محل خرابی</th><th>تکنسین</th><th>شیفت</th></tr></thead>
                <tbody>
                  {failures.list.map(({ c, a }, i) => (
                    <tr key={i}>
                      <td className="text-[12px]">{c.date}</td>
                      <td className="font-bold text-[12px]">{eqName(c.equipmentId)}</td>
                      <td className="text-[12px] max-w-[300px]"><span className="line-clamp-2">{a.description || "بدون شرح"}</span></td>
                      <td><span className="badge b-nok">{db.failureLocations.find((f) => f.id === a.failureLocationId)?.name ?? "نامشخص"}</span></td>
                      <td className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{userName(c.userId)}</td>
                      <td className="text-[11.5px]" style={{ color: "var(--muted)" }}>{db.shifts.find((s) => s.id === c.shiftId)?.name ?? "—"}</td>
                    </tr>
                  ))}
                  {failures.list.length === 0 && <tr><td colSpan={6}><Empty icon="shield" title="در این بازه خرابی ثبت نشده" /></td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* ================= تب ساعت کارکرد ================= */}
      {tab === "oh" && (
        <div className="space-y-4">
          <Section icon="chart" title="نمودار ساعت کارکرد" sub="کارکرد روزانه ناوگان + تفکیک منبع ثبت"
            toolbar={<Seg size="sm" value={kOh} onChange={setKOh} options={[{ v: "bar", label: "کارکرد روزانه", icon: "chart" }, { v: "line", label: "روند", icon: "history" }, { v: "donut", label: "به تفکیک منبع", icon: "shield" }]} />}>
            {kOh !== "donut" && (() => {
              const daily = days.map((d) => ({ label: d.slice(5), value: Math.round(ohRows.filter((h) => h.date === d).reduce((s, h) => s + Math.max(0, h.diff), 0) * 10) / 10 }));
              return kOh === "bar" ? <BarChart h={200} data={daily} /> : <LineChart h={200} points={daily.map((d) => d.value)} labels={daily.map((d) => d.label)} suffix=" h" />;
            })()}
            {kOh === "donut" && (donutBySrc.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-8 py-2">
                <Donut size={190} thick={24} centerLabel={<><span className="font-display text-[26px]">{faNum(ohRows.length)}</span><span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>رکورد</span></>} parts={donutBySrc} />
                <div className="space-y-1.5">{donutBySrc.map((g) => <p key={g.label} className="flex items-center gap-2 text-[12px] font-bold"><i className="w-3 h-3 rounded-sm" style={{ background: g.color }} />{g.label}: {faNum(g.value)}</p>)}</div>
              </div>
            ) : <Empty icon="gauge" title="رکوردی نیست" />)}
          </Section>

          <Section icon="list" title="لیست تغییرات ساعت کارکرد" sub={`${faNum(ohRows.length)} رکورد — منبع هر مقدار (Auto/Manual/Adjusted) مشخص است`}>
            <div className="overflow-x-auto -mx-4 -mb-4 px-4 pb-1">
              <table className="tbl min-w-[780px]">
                <thead><tr><th>تاریخ</th><th>زمان</th><th>تجهیز</th><th>قبلی</th><th>جدید</th><th>اختلاف</th><th>منبع</th><th>کاربر</th><th>دلیل</th></tr></thead>
                <tbody>
                  {ohRows.slice(0, 60).map((h) => (
                    <tr key={h.id}>
                      <td className="text-[12px]">{h.date}</td>
                      <td className="text-[12px] ltr inline-block">{h.time}</td>
                      <td className="font-bold text-[12px]">{eqName(h.equipmentId)}</td>
                      <td className="ltr text-[12px]">{faOH(h.previous)}</td>
                      <td className="ltr text-[12px] font-bold">{faOH(h.value)}</td>
                      <td><span className={cx("badge ltr", h.diff >= 0 ? "b-ok" : "b-nok")}>{h.diff >= 0 ? "+" : ""}{faOH(h.diff)} h</span></td>
                      <td>{h.source === "auto" ? <span className="badge b-ok">Auto</span> : h.source === "manual" ? <span className="badge b-info">Manual</span> : <span className="badge b-acc">Adjusted</span>}</td>
                      <td className="text-[11.5px]" style={{ color: "var(--muted)" }}>{userName(h.userId)}</td>
                      <td className="text-[11.5px] max-w-[200px] truncate" title={h.reason}>{h.reason ?? "—"}</td>
                    </tr>
                  ))}
                  {ohRows.length === 0 && <tr><td colSpan={9}><Empty icon="gauge" title="رکوردی مطابق فیلترها نیست" /></td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

/* ---------- ردیف کنترل با جزئیات بازشو ---------- */
function Row({ c, expanded, onToggle, eqName, groupName, shiftName, userName, itemTitle, failLoc }: {
  c: DailyControl; expanded: boolean; onToggle: () => void; eqName: string; groupName: string; shiftName: string; userName: string;
  itemTitle: (clId: string, itemId: string) => { t: string; unit: string };
  failLoc: (id?: string) => string | undefined;
}) {
  const healthy = c.nokCount === 0 && c.oorCount === 0;
  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td><Icon name="chevd" size={14} className={cx("transition-transform", expanded && "rotate-180")} /></td>
        <td className="text-[12px]">{c.date}</td>
        <td className="font-bold text-[12.5px]">{eqName}</td>
        <td className="text-[11.5px]" style={{ color: "var(--muted)" }}>{groupName}</td>
        <td className="text-[12px]">{shiftName}</td>
        <td className="text-[12px]">{userName}</td>
        <td>
          {healthy ? <span className="badge b-ok"><Icon name="check" size={10} />سالم</span> : (
            <span className="flex gap-1">
              {c.nokCount > 0 && <span className="badge b-nok">{faNum(c.nokCount)} NOK</span>}
              {c.oorCount > 0 && <span className="badge b-acc">{faNum(c.oorCount)} خارج محدوده</span>}
            </span>
          )}
        </td>
        <td className="ltr text-[12px] font-semibold">{c.oh ? faOH(c.oh.value) + " h" : "—"}</td>
        <td className="text-[11px]" style={{ color: "var(--muted)" }}>{c.submittedAt ? faTime(c.submittedAt) : ""}</td>
      </tr>
      {expanded && (
        <tr className="panel2">
          <td colSpan={9} className="!py-3">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 px-2">
              {c.answers.map((a) => {
                const it = itemTitle(c.checklistId, a.itemId);
                const bad = a.result === "nok" || a.result === "out-of-range";
                return (
                  <div key={a.itemId} className={cx("rounded-lg px-3 py-2 text-[12px] border", bad && "border-r-[3px]")}
                    style={{ borderColor: "var(--line)", borderRightColor: bad ? (a.result === "nok" ? "var(--nok)" : "var(--amber)") : undefined, background: "var(--panel)" }}>
                    <p className="font-bold flex items-center justify-between gap-2">
                      <span className="truncate">{it.t}</span>
                      <span className={cx("badge flex-shrink-0", a.result === "ok" || a.result === "in-range" ? "b-ok" : a.result === "nok" ? "b-nok" : "b-acc")}>
                        <span className="ltr">{a.value}{it.unit ? ` ${it.unit}` : ""}</span>
                      </span>
                    </p>
                    {a.description && <p className="mt-1 text-[11.5px]" style={{ color: "var(--nok)" }}>📝 {a.description}</p>}
                    {a.failureLocationId && <p className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted)" }}>محل خرابی: {failLoc(a.failureLocationId)}</p>}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
