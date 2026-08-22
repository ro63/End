/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — گزارشات (Reports)
   ------------------------------------------------------------
   • بازه‌ها: امروز / ۷ روز / ۳۰ روز / سفارشی
   • فیلترهای ترکیبی: شیفت، گروه، تجهیز، تکنسین، نتیجه
   • گزارش خرابی: تعداد، تجهیزات پرتکرار، محل خرابی پرتکرار، روند
   • تب نمودار با تغییر نوع Chart (Bar/Line/Donut)
   • خروجی Excel/CSV + چاپ — با Permission
   ============================================================ */

import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { DailyControl } from "../lib/types";
import { Icon, BarChart, LineChart, Donut, Seg, Empty, Logo } from "../components/ui";
import { cx, faNum, faOH, faTime, pdToday, pdShift, download, toCSV } from "../lib/utils";

type Tab = "controls" | "failures" | "oh" | "charts";
type Range = "today" | "7d" | "30d" | "all" | "custom";

export default function Reports() {
  const { db, can } = useStore();
  const [tab, setTab] = useState<Tab>("controls");
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fShift, setFShift] = useState("all");
  const [fGroup, setFGroup] = useState("all");
  const [fEq, setFEq] = useState("all");
  const [fUser, setFUser] = useState("all");
  const [fResult, setFResult] = useState("all");
  const [expanded, setExpanded] = useState("");

  /* ---------- بازه زمانی ---------- */
  const [start, end] = useMemo((): [string, string] => {
    const t = pdToday();
    if (range === "today") return [t, t];
    if (range === "7d") return [pdShift(new Date(), -6), t];
    if (range === "30d") return [pdShift(new Date(), -29), t];
    if (range === "custom" && from && to) return [pdToday(new Date(from)), pdToday(new Date(to))];
    return ["0000/00/00", "9999/99/99"];
  }, [range, from, to]);

  /* ---------- اعمال فیلترها (قابل ترکیب) ---------- */
  const filtered = useMemo(() => db.controls.filter((c) => {
    if (c.status === "draft") return false;
    if (c.date < start || c.date > end) return false;
    if (fShift !== "all" && c.shiftId !== fShift) return false;
    if (fUser !== "all" && c.userId !== fUser) return false;
    const eq = db.equipment.find((e) => e.id === c.equipmentId);
    if (fGroup !== "all" && eq?.groupId !== fGroup) return false;
    if (fEq !== "all" && c.equipmentId !== fEq) return false;
    if (fResult === "healthy" && (c.nokCount > 0 || c.oorCount > 0)) return false;
    if (fResult === "nok" && c.nokCount === 0) return false;
    if (fResult === "oor" && c.oorCount === 0) return false;
    return true;
  }), [db, start, end, fShift, fGroup, fEq, fUser, fResult]);

  const eqName = (id: string) => db.equipment.find((e) => e.id === id)?.name ?? "—";
  const userName = (id: string) => { const u = db.users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : "—"; };
  const itemTitle = (clId: string, itemId: string) => {
    const cl = db.checklists.find((x) => x.id === clId);
    for (const s of cl?.sections ?? []) for (const i of s.items) if (i.id === itemId) return { t: i.title, unit: i.unit ?? "", s: s.name };
    return { t: itemId, unit: "", s: "" };
  };
  const canExport = can("reports", "export");

  /* ---------- داده خرابی‌ها ---------- */
  const failures = useMemo(() => {
    const list = filtered.flatMap((c) => c.answers.filter((a) => a.failureLocationId || a.result === "nok").map((a) => ({ c, a })));
    const byLoc = new Map<string, number>();
    const byEq = new Map<string, number>();
    for (const { c, a } of list) {
      if (a.failureLocationId) byLoc.set(a.failureLocationId, (byLoc.get(a.failureLocationId) ?? 0) + 1);
      byEq.set(c.equipmentId, (byEq.get(c.equipmentId) ?? 0) + 1);
    }
    return { list, byLoc, byEq };
  }, [filtered]);

  /* ---------- داده نمودارها ---------- */
  const [chartType, setChartType] = useState<"bar" | "line" | "donut">("bar");
  const [metric, setMetric] = useState<"controls" | "nok" | "oh">("controls");
  const days = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < 31; i++) { const d = pdShift(new Date(), -i); if (d >= start && d <= end) set.add(d); }
    return [...set].sort();
  }, [start, end]);
  const metricVals = days.map((d) => {
    const cs = filtered.filter((c) => c.date === d);
    if (metric === "controls") return cs.length;
    if (metric === "nok") return cs.reduce((s, c) => s + c.nokCount, 0);
    return Math.round(cs.reduce((s, c) => s + (c.oh ? Math.max(0, c.oh.value - c.oh.previous) : 0), 0) * 10) / 10;
  });
  const donutByGroup = db.groups.map((g) => ({
    label: g.name, value: filtered.filter((c) => db.equipment.find((e) => e.id === c.equipmentId)?.groupId === g.id).length,
    color: ["var(--acc)", "var(--info)", "var(--ok)", "var(--amber)", "var(--nok)", "#7e57c2", "#26a69a", "#8d6e63"][db.groups.indexOf(g) % 8],
  })).filter((x) => x.value > 0);

  const ohRows = useMemo(() => db.ohHistory.filter((h) => h.date >= start && h.date <= end && (fEq === "all" || h.equipmentId === fEq)), [db.ohHistory, start, end, fEq]);

  const exportTab = () => {
    if (tab === "controls") download("nipco-controls.csv", toCSV(
      ["تاریخ", "تجهیز", "چک‌لیست", "شیفت", "تکنسین", "OK", "NOK", "خارج محدوده", "ساعت کارکرد"],
      filtered.map((c) => [c.date, eqName(c.equipmentId), db.checklists.find((x) => x.id === c.checklistId)?.name ?? "", db.shifts.find((s) => s.id === c.shiftId)?.name ?? "", userName(c.userId), c.answers.length - c.nokCount - c.oorCount, c.nokCount, c.oorCount, c.oh ? c.oh.value : ""])), "text/csv");
    else if (tab === "failures") download("nipco-failures.csv", toCSV(
      ["تاریخ", "تجهیز", "شرح", "محل خرابی", "تکنسین"],
      failures.list.map(({ c, a }) => [c.date, eqName(c.equipmentId), a.description, db.failureLocations.find((f) => f.id === a.failureLocationId)?.name ?? "—", userName(c.userId)])), "text/csv");
    else download("nipco-oh.csv", toCSV(
      ["تاریخ", "تجهیز", "قبلی", "جدید", "اختلاف", "منبع"],
      ohRows.map((h) => [h.date, eqName(h.equipmentId), h.previous, h.value, h.diff, h.source])), "text/csv");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 no-print">
        <div>
          <h1 className="font-display text-[26px] leading-none">گزارشات</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            بازه {start === end ? start : `${start} تا ${end}`} • {faNum(filtered.length)} کنترل مطابق فیلترها
          </p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "controls", label: "کنترل‌ها", icon: "clipboard" },
          { v: "failures", label: "خرابی‌ها", icon: "alert" },
          { v: "oh", label: "ساعت کارکرد", icon: "gauge" },
          { v: "charts", label: "نمودارها", icon: "chart" },
        ]} />
      </div>

      {/* ---------- نوار فیلتر ---------- */}
      <div className="card p-3.5 mb-4 flex flex-wrap items-center gap-2 no-print">
        <Icon name="filter" size={15} className="opacity-50" />
        <div className="flex gap-1">
          {([["today", "امروز"], ["7d", "۷ روز"], ["30d", "۳۰ روز"], ["all", "همه"], ["custom", "سفارشی"]] as [Range, string][]).map(([r, l]) => (
            <button key={r} onClick={() => setRange(r)} className={cx("badge !py-1.5 !px-2.5 cursor-pointer border", range === r ? "b-acc" : "b-mut")}>{l}</button>
          ))}
        </div>
        {range === "custom" && (
          <span className="flex gap-1.5 items-center">
            <input type="date" className="inp !w-auto !py-1.5 ltr !text-[11.5px]" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>تا</span>
            <input type="date" className="inp !w-auto !py-1.5 ltr !text-[11.5px]" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
          </span>
        )}
        <select className="inp !w-auto !py-1.5 text-[12px]" value={fShift} onChange={(e) => setFShift(e.target.value)}><option value="all">همه شیفت‌ها</option>{db.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="inp !w-auto !py-1.5 text-[12px]" value={fGroup} onChange={(e) => { setFGroup(e.target.value); setFEq("all"); }}><option value="all">همه گروه‌ها</option>{db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <select className="inp !w-auto !py-1.5 text-[12px]" value={fEq} onChange={(e) => setFEq(e.target.value)}><option value="all">همه تجهیزات</option>{db.equipment.filter((e) => fGroup === "all" || e.groupId === fGroup).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select className="inp !w-auto !py-1.5 text-[12px]" value={fUser} onChange={(e) => setFUser(e.target.value)}><option value="all">همه تکنسین‌ها</option>{db.users.filter((u) => !u.deleted).map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</select>
        <select className="inp !w-auto !py-1.5 text-[12px]" value={fResult} onChange={(e) => setFResult(e.target.value)}><option value="all">همه نتایج</option><option value="healthy">سالم</option><option value="nok">دارای NOK</option><option value="oor">خارج از محدوده</option></select>
        <div className="mr-auto flex gap-1.5">
          {tab !== "charts" && <button className="btn btn-ghost btn-sm" disabled={!canExport} onClick={exportTab}><Icon name="download" size={13} />Excel</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon name="printer" size={13} />چاپ / PDF</button>
        </div>
      </div>

      {/* ---------- سربرگ چاپ ---------- */}
      <div className="hidden print:flex items-center justify-between mb-4 pb-3 border-b">
        <Logo size={34} /><p className="font-bold text-[13px]">گزارش کنترل روزانه تجهیزات — بازه {start} تا {end}</p>
      </div>

      {/* ================= تب کنترل‌ها ================= */}
      {tab === "controls" && (
        <div className="card overflow-x-auto fade-up">
          <table className="tbl min-w-[840px]">
            <thead><tr><th></th><th>تاریخ</th><th>تجهیز</th><th>شیفت</th><th>تکنسین</th><th>نتیجه</th><th>ساعت کارکرد</th><th>ثبت</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <Row key={c.id} c={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? "" : c.id)}
                  eqName={eqName(c.equipmentId)} shiftName={db.shifts.find((s) => s.id === c.shiftId)?.name ?? "—"}
                  userName={userName(c.userId)} itemTitle={itemTitle}
                  failLoc={(id?: string) => db.failureLocations.find((f) => f.id === id)?.name} />
              ))}
              {filtered.length === 0 && <tr><td colSpan={8}><Empty icon="clipboard" title="گزارشی مطابق فیلترها نیست" sub="بازه یا فیلترها را تغییر دهید" /></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= تب خرابی‌ها ================= */}
      {tab === "failures" && (
        <div className="space-y-4 fade-up">
          <div className="grid grid-cols-3 gap-3">
            {[
              { t: "کل موارد NOK/خرابی", v: failures.list.length, c: "var(--nok)", i: "alert" },
              { t: "پرتکرارترین تجهیز", v: [...failures.byEq.entries()].sort((a, b) => b[1] - a[1])[0] ? eqName([...failures.byEq.entries()].sort((a, b) => b[1] - a[1])[0][0]) : "—", c: "var(--amber)", i: "factory" },
              { t: "پرتکرارترین محل خرابی", v: [...failures.byLoc.entries()].sort((a, b) => b[1] - a[1])[0] ? db.failureLocations.find((f) => f.id === [...failures.byLoc.entries()].sort((a, b) => b[1] - a[1])[0][0])?.name : "—", c: "var(--info)", i: "box" },
            ].map((s) => (
              <div key={s.t} className="card p-4 text-center">
                <Icon name={s.i} size={20} className="mx-auto mb-1.5" style={{ color: s.c }} />
                <p className="font-display text-[19px] leading-tight" style={{ color: s.c }}>{typeof s.v === "number" ? faNum(s.v) : s.v}</p>
                <p className="text-[10.5px] font-bold mt-0.5" style={{ color: "var(--muted)" }}>{s.t}</p>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="font-bold text-[13.5px] mb-3">خرابی به تفکیک محل</h3>
              {failures.byLoc.size === 0 ? <Empty icon="shield" title="خرابی ثبت‌شده‌ای نیست" /> : (
                <BarChart h={160} data={[...failures.byLoc.entries()].map(([id, v]) => ({ label: db.failureLocations.find((f) => f.id === id)?.name ?? "—", value: v, color: "var(--nok)" }))} />
              )}
            </div>
            <div className="card p-4">
              <h3 className="font-bold text-[13.5px] mb-3">تجهیزات پرتکرار در خرابی‌ها</h3>
              {failures.byEq.size === 0 ? <Empty icon="shield" title="موردی نیست" /> : (
                <BarChart h={160} data={[...failures.byEq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([id, v]) => ({ label: eqName(id).split(" ").slice(0, 2).join(" "), value: v, color: "var(--amber)" }))} />
              )}
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="tbl min-w-[760px]">
              <thead><tr><th>تاریخ</th><th>تجهیز</th><th>شرح خرابی</th><th>محل خرابی</th><th>تکنسین</th></tr></thead>
              <tbody>
                {failures.list.map(({ c, a }, i) => (
                  <tr key={i}>
                    <td className="text-[12px]">{c.date}</td>
                    <td className="font-bold text-[12px]">{eqName(c.equipmentId)}</td>
                    <td className="text-[12px] max-w-[300px]"><span className="line-clamp-2">{a.description || "بدون شرح"}</span></td>
                    <td><span className="badge b-nok">{db.failureLocations.find((f) => f.id === a.failureLocationId)?.name ?? "نامشخص"}</span></td>
                    <td className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{userName(c.userId)}</td>
                  </tr>
                ))}
                {failures.list.length === 0 && <tr><td colSpan={5}><Empty icon="shield" title="در این بازه خرابی ثبت نشده" /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= تب ساعت کارکرد ================= */}
      {tab === "oh" && (
        <div className="card overflow-x-auto fade-up">
          <table className="tbl min-w-[760px]">
            <thead><tr><th>تاریخ</th><th>تجهیز</th><th>قبلی</th><th>جدید</th><th>کارکرد روز</th><th>منبع</th><th>کاربر</th></tr></thead>
            <tbody>
              {ohRows.map((h) => (
                <tr key={h.id}>
                  <td className="text-[12px]">{h.date}</td>
                  <td className="font-bold text-[12px]">{eqName(h.equipmentId)}</td>
                  <td className="ltr text-[12px]">{faOH(h.previous)}</td>
                  <td className="ltr text-[12px] font-bold">{faOH(h.value)}</td>
                  <td><span className={cx("badge ltr", h.diff >= 0 ? "b-ok" : "b-nok")}>{h.diff >= 0 ? "+" : ""}{faOH(h.diff)} h</span></td>
                  <td>{h.source === "auto" ? <span className="badge b-ok">Auto</span> : h.source === "manual" ? <span className="badge b-info">Manual</span> : <span className="badge b-acc">Adjusted</span>}</td>
                  <td className="text-[11.5px]" style={{ color: "var(--muted)" }}>{userName(h.userId)}</td>
                </tr>
              ))}
              {ohRows.length === 0 && <tr><td colSpan={7}><Empty icon="gauge" title="رکوردی نیست" /></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= تب نمودارها ================= */}
      {tab === "charts" && (
        <div className="card p-5 fade-up">
          <div className="flex flex-wrap items-center gap-3 mb-5 no-print">
            <Seg size="sm" value={chartType} onChange={setChartType} options={[
              { v: "bar", label: "ستونی", icon: "chart" }, { v: "line", label: "خطی", icon: "history" }, { v: "donut", label: "دایره‌ای", icon: "shield" },
            ]} />
            {chartType !== "donut" && (
              <Seg size="sm" value={metric} onChange={setMetric} options={[
                { v: "controls", label: "تعداد کنترل" }, { v: "nok", label: "موارد NOK" }, { v: "oh", label: "ساعت کارکرد" },
              ]} />
            )}
            <span className="text-[11.5px] font-bold mr-auto" style={{ color: "var(--muted)" }}>نوع نمودار و معیار قابل تغییر است</span>
          </div>
          {chartType === "bar" && <BarChart h={230} data={days.map((d, i) => ({ label: d.slice(5), value: metricVals[i] }))} />}
          {chartType === "line" && <LineChart h={230} points={metricVals} labels={days.map((d) => d.slice(5))} suffix={metric === "oh" ? " h" : ""} />}
          {chartType === "donut" && (
            <div className="flex flex-wrap items-center justify-center gap-8 py-4" dir="rtl">
              <Donut size={210} thick={26} centerLabel={<><span className="font-display text-[30px]">{faNum(filtered.length)}</span><span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>کنترل</span></>} parts={donutByGroup} />
              <div className="space-y-1.5">
                {donutByGroup.map((g) => (
                  <p key={g.label} className="flex items-center gap-2 text-[12.5px] font-bold">
                    <i className="w-3 h-3 rounded-sm" style={{ background: g.color }} />{g.label}: {faNum(g.value)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- ردیف کنترل با جزئیات بازشو ---------- */
function Row({ c, expanded, onToggle, eqName, shiftName, userName, itemTitle, failLoc }: {
  c: DailyControl; expanded: boolean; onToggle: () => void; eqName: string; shiftName: string; userName: string;
  itemTitle: (clId: string, itemId: string) => { t: string; unit: string; s: string };
  failLoc: (id?: string) => string | undefined;
}) {
  const healthy = c.nokCount === 0 && c.oorCount === 0;
  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td><Icon name="chevd" size={14} className={cx("transition-transform", expanded && "rotate-180")} /></td>
        <td className="text-[12px]">{c.date}</td>
        <td className="font-bold text-[12.5px]">{eqName}</td>
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
          <td colSpan={8} className="!py-3">
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
