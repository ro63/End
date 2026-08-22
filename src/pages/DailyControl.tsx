/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — کنترل روزانه (Daily Control)
   ⭐ مهم‌ترین ماژول سیستم — UX با حداقل کلیک برای تبلت
   ------------------------------------------------------------
   چرخه: انتخاب تجهیز (اسکن/فهرست/جستجو) → انتخاب چک‌لیست →
   اجرای آیتم‌ها (OK/NOK + عددی با Range Validation) → توضیح
   اجباری برای NOK/Out of Range → ساعت کارکرد (خودکار از دستگاه
   یا دستی با مجوز) → Submit (آنلاین: ثبت / آفلاین: صف Sync)
   - دسترسی سطح Section: کاربر گروه برق فقط Sectionهای electrical
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import type { DailyControl as DC, Checklist, ChecklistItem, ChecklistSection, Equipment, ControlAnswer } from "../lib/types";
import { Icon, PseudoQR, Modal, ConnBadge, Empty, Seg } from "../components/ui";
import { cx, faNum, faOH, faTime, faDateLong, currentShift, shiftWorkDate, uid, clamp, timeAgo } from "../lib/utils";

type Stage = "select" | "review" | "execute" | "done";
type Answers = Record<string, { value: string; desc: string; failLoc?: string }>;

export default function DailyControl() {
  const { db } = useStore();
  const [stage, setStage] = useState<Stage>("select");
  const [eqId, setEqId] = useState("");
  const [clId, setClId] = useState("");
  const [doneCtrl, setDoneCtrl] = useState<DC | null>(null);

  const eq = db.equipment.find((e) => e.id === eqId);
  const cl = db.checklists.find((c) => c.id === clId);

  const steps = [
    { k: "select", t: "انتخاب تجهیز" }, { k: "review", t: "تجهیز و چک‌لیست" },
    { k: "execute", t: "اجرای کنترل" }, { k: "done", t: "پایان" },
  ];
  const idx = steps.findIndex((s) => s.k === stage);

  return (
    <div className="max-w-5xl mx-auto">
      {/* نوار مراحل */}
      {stage !== "select" && (
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto no-print">
          {steps.map((s, i) => (
            <div key={s.k} className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => { if (i < idx && stage !== "done") setStage(s.k as Stage); }}
                className={cx("flex items-center gap-2 rounded-full py-1.5 pr-2 pl-3.5 text-[12px] font-bold border transition-all", i <= idx ? "" : "opacity-40")}
                style={i === idx ? { background: "var(--acc)", color: "var(--acc-ink)", borderColor: "var(--acc)" } : { borderColor: "var(--line2)" }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                  style={{ background: i === idx ? "rgba(255,255,255,.25)" : "var(--panel2)" }}>
                  {i < idx ? <Icon name="check" size={11} /> : faNum(i + 1)}
                </span>
                {s.t}
              </button>
              {i < steps.length - 1 && <span className="w-5 h-px" style={{ background: "var(--line2)" }} />}
            </div>
          ))}
        </div>
      )}

      {stage === "select" && <SelectStage onPick={(id) => { setEqId(id); setClId(""); setStage("review"); }} />}
      {stage === "review" && eq && (
        <ReviewStage eq={eq} onBack={() => setStage("select")}
          onPick={(cid) => { setClId(cid); setStage("execute"); }} />
      )}
      {stage === "execute" && eq && cl && (
        <ExecuteStage eq={eq} cl={cl} onBack={() => setStage("review")}
          onDone={(c) => { setDoneCtrl(c); setStage("done"); }} />
      )}
      {stage === "done" && doneCtrl && (
        <DoneStage ctrl={doneCtrl}
          onNew={() => { setStage("select"); setEqId(""); setClId(""); setDoneCtrl(null); }}
          onAgain={() => { setClId(""); setStage("review"); setDoneCtrl(null); }} />
      )}
    </div>
  );
}

/* ============================================================ مرحله ۱ — انتخاب تجهیز */
function SelectStage({ onPick }: { onPick: (id: string) => void }) {
  const { db } = useStore();
  const [tab, setTab] = useState<"scan" | "list" | "search">("scan");
  const activeEq = db.equipment.filter((e) => e.status !== "inactive");

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">شروع کنترل روزانه</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            QR روی بدنه تجهیز را اسکن کنید یا از فهرست انتخاب کنید — {faNum(activeEq.length)} تجهیز فعال
          </p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "scan", label: "اسکن QR", icon: "scan" },
          { v: "list", label: "فهرست تجهیزات", icon: "list" },
          { v: "search", label: "جستجو", icon: "search" },
        ]} />
      </div>

      {tab === "scan" && <ScanTab onPick={onPick} />}
      {tab === "list" && <ListTab onPick={onPick} />}
      {tab === "search" && <SearchTab onPick={onPick} />}
    </div>
  );
}

/* تب اسکن — شبیه‌ساز دوربین صنعتی + ورود کد دستی + تجهیزات اخیر */
function ScanTab({ onPick }: { onPick: (id: string) => void }) {
  const { db, toast, user } = useStore();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const recent = useMemo(() => {
    const ids = db.controls.filter((c) => c.userId === user?.id).slice(0, 4).map((c) => c.equipmentId);
    return [...new Set(ids)].map((id) => db.equipment.find((e) => e.id === id)).filter(Boolean) as Equipment[];
  }, [db, user]);

  function simulate() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      const pool = db.equipment.filter((e) => e.status === "active");
      const eq = pool[Math.floor(Math.random() * pool.length)];
      toast(`تجهیز شناسایی شد: ${eq.code}`, "ok");
      onPick(eq.id);
    }, 1600);
  }
  function byCode() {
    const eq = db.equipment.find((e) => e.code.toLowerCase() === code.trim().toLowerCase());
    if (!eq) { toast("تجهیزی با این کد یافت نشد", "err"); return; }
    onPick(eq.id);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        {/* نمای دوربین */}
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center"
          style={{ background: "linear-gradient(150deg,#0d141d,#131c28)" }}>
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 30% 40%, rgba(232,89,12,.25), transparent 55%)" }} />
          {/* گوشه‌های کادر اسکن */}
          {["top-4 right-4 border-t-2 border-r-2", "top-4 left-4 border-t-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2", "bottom-4 left-4 border-b-2 border-l-2"].map((c) => (
            <span key={c} className={cx("absolute w-8 h-8 rounded-sm", c)} style={{ borderColor: "var(--acc)" }} />
          ))}
          {scanning && <span className="scanline" />}
          <div className="text-center text-white/85 z-10 px-6">
            <Icon name="scan" size={44} className="mx-auto mb-3 opacity-90" />
            <p className="font-bold text-[14px]">{scanning ? "در حال خواندن کد تجهیز…" : "دوربین را روی QR تجهیز بگیرید"}</p>
            <p className="text-[11.5px] text-white/50 mt-1">در دمو، اسکن با شبیه‌ساز انجام می‌شود — در Production از کتابخانه دوربین (BarcodeDetector) استفاده می‌شود</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-acc flex-1" onClick={simulate} disabled={scanning}>
            <Icon name="camera" size={16} />{scanning ? "در حال اسکن…" : "شبیه‌سازی اسکن"}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <input className="inp ltr !text-left" dir="ltr" placeholder="ورود دستی کد — مثل PRS-1500"
            value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && byCode()} />
          <button className="btn btn-ghost" onClick={byCode}><Icon name="check" size={15} /></button>
        </div>
      </div>

      <div className="card p-5">
        <p className="lbl !mb-3 flex items-center gap-1.5"><Icon name="history" size={14} />تجهیزات اخیر شما — شروع با یک لمس</p>
        <div className="grid grid-cols-2 gap-2.5">
          {recent.map((e) => <EqTile key={e.id} eq={e} onPick={onPick} />)}
          {recent.length === 0 && <p className="col-span-2 text-[12.5px] py-6 text-center" style={{ color: "var(--muted)" }}>هنوز کنترلی ثبت نکرده‌اید — از اسکن یا فهرست شروع کنید</p>}
        </div>
        <div className="mt-4 rounded-lg p-3 text-[12px] font-semibold flex gap-2 items-start" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          <Icon name="info" size={15} className="flex-shrink-0 mt-0.5" />
          هر تجهیز QR اختصاصی دارد؛ چاپ لیبل از «مدیریت تجهیزات → QR» انجام می‌شود.
        </div>
      </div>
    </div>
  );
}

function EqTile({ eq, onPick, sub }: { eq: Equipment; onPick: (id: string) => void; sub?: string }) {
  const { db } = useStore();
  const g = db.groups.find((x) => x.id === eq.groupId);
  const st: Record<string, [string, string]> = { active: ["b-ok", "فعال"], idle: ["b-mut", "آماده‌به‌کار"], maintenance: ["b-nok", "تعمیرات"] };
  const [cls, txt] = st[eq.status] ?? st.idle;
  return (
    <button onClick={() => onPick(eq.id)}
      className="text-right rounded-xl border p-3 transition-all hover:-translate-y-0.5 active:scale-[0.98] group"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="badge b-mut ltr !text-[10px]">{eq.code}</span>
        <span className={cx("badge", cls)}>{txt}</span>
      </div>
      <p className="font-bold text-[13px] leading-5 group-hover:text-[var(--acc)] transition-colors">{eq.name}</p>
      <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--muted)" }}>{sub ?? g?.name}</p>
    </button>
  );
}

/* تب فهرست — گروه‌بندی‌شده با وضعیت کنترل امروز */
function ListTab({ onPick }: { onPick: (id: string) => void }) {
  const { db } = useStore();
  const [gid, setGid] = useState("all");
  const today = shiftWorkDate(currentShift(db.shifts));
  const doneToday = (id: string) => db.controls.some((c) => c.equipmentId === id && c.date === today && c.status !== "draft");
  const groups = db.groups.filter((g) => g.active);
  const list = db.equipment.filter((e) => (gid === "all" || e.groupId === gid) && e.status !== "inactive");

  return (
    <div className="card p-4">
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button className={cx("badge !py-1.5 !px-3 cursor-pointer border", gid === "all" ? "b-acc" : "b-mut")} onClick={() => setGid("all")}>همه ({faNum(list.length)})</button>
        {groups.map((g) => (
          <button key={g.id} className={cx("badge !py-1.5 !px-3 cursor-pointer border", gid === g.id ? "b-acc" : "b-mut")} onClick={() => setGid(g.id)}>
            {g.name} ({faNum(db.equipment.filter((e) => e.groupId === g.id).length)})
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {list.map((e) => (
          <div key={e.id} className="relative">
            {doneToday(e.id) && (
              <span className="absolute -top-2 -left-2 z-10 badge b-ok !text-[10px] shadow"><Icon name="check" size={10} />انجام شد</span>
            )}
            <EqTile eq={e} onPick={onPick} />
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full"><Empty title="تجهیزی در این گروه نیست" /></div>}
      </div>
    </div>
  );
}

/* تب جستجو — فازی روی نام/کد/برند/محل */
function SearchTab({ onPick }: { onPick: (id: string) => void }) {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const loc = (id: string) => { const l = db.locations.find((x) => x.id === id); return l ? `${l.hall} / ${l.line}` : ""; };
  const res = db.equipment.filter((e) => {
    if (!q.trim()) return false;
    const s = `${e.name} ${e.code} ${e.brand} ${e.model} ${e.serial} ${loc(e.locationId)}`.toLowerCase();
    return q.trim().toLowerCase().split(/\s+/).every((w) => s.includes(w));
  });
  return (
    <div className="card p-4">
      <div className="relative mb-4">
        <input className="inp !pr-10 !py-3 !text-[15px]" autoFocus placeholder="نام، کد، برند، سریال یا محل تجهیز…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <Icon name="search" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-45" />
      </div>
      {q.trim() === "" && <Empty icon="search" title="عبارتی تایپ کنید" sub="مثلاً: پرس ۱۵۰۰ یا ABB یا Atlas" />}
      {q.trim() !== "" && res.length === 0 && <Empty icon="search" title="نتیجه‌ای یافت نشد" sub="املای عبارت یا کد تجهیز را بررسی کنید" />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {res.map((e) => <EqTile key={e.id} eq={e} onPick={onPick} sub={loc(e.locationId)} />)}
      </div>
    </div>
  );
}

/* ============================================================ مرحله ۲ — مشخصات تجهیز و انتخاب چک‌لیست */
function ReviewStage({ eq, onBack, onPick }: { eq: Equipment; onBack: () => void; onPick: (clId: string) => void }) {
  const { db, can } = useStore();
  const canSubmit = can("control", "submit");
  const g = db.groups.find((x) => x.id === eq.groupId);
  const l = db.locations.find((x) => x.id === eq.locationId);
  const ds = db.deviceState.find((x) => x.equipmentId === eq.id);
  /* چک‌لیست‌های قابل اجرا: Group + Equipment Specific */
  const cls = db.checklists.filter((c) => c.active &&
    ((c.scope === "group" && c.targetId === eq.groupId) || (c.scope === "equipment" && c.targetId === eq.id)));
  const today = shiftWorkDate(currentShift(db.shifts));
  const doneToday = db.controls.filter((c) => c.equipmentId === eq.id && c.date === today && c.status !== "draft");
  const history = db.controls.filter((c) => c.equipmentId === eq.id && c.status !== "draft").slice(0, 3);

  return (
    <div className="grid lg:grid-cols-[1.15fr_1fr] gap-4 fade-up">
      <div className="card p-5">
        <button className="btn btn-ghost btn-sm mb-3" onClick={onBack}><Icon name="chevs" size={14} />تغییر تجهیز</button>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
            <Icon name={g?.icon === "press" ? "press" : g?.icon === "robot" ? "robot" : g?.icon === "compressor" ? "fan" : g?.icon === "forklift" ? "forklift" : g?.icon === "boiler" ? "flame" : g?.icon === "zap" ? "zap" : g?.icon === "fan" ? "fan" : "box"} size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[24px] leading-tight">{eq.name}</h2>
            <p className="text-[12px] font-bold ltr inline-block" style={{ color: "var(--muted)" }}>{eq.code} • {eq.brand} {eq.model}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5 text-[12px] font-semibold">
          {[
            ["گروه", g?.name ?? "—"], ["محل", l ? `${l.hall} / ${l.line} / ${l.area}` : "—"],
            ["ظرفیت", eq.capacity], ["سریال", eq.serial], ["راه‌اندازی", eq.commissionDate],
            ["وضعیت", eq.status === "active" ? "فعال" : eq.status === "maintenance" ? "تعمیرات" : "آماده‌به‌کار"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg p-2.5 panel2 border" style={{ borderColor: "var(--line)" }}>
              <p className="text-[10.5px] mb-0.5" style={{ color: "var(--muted)" }}>{k}</p>
              <p className="truncate">{v}</p>
            </div>
          ))}
        </div>

        {/* ساعت کارکرد زنده */}
        <div className="mt-4 rounded-xl p-4 flex items-center justify-between gap-3 border"
          style={{ background: "linear-gradient(120deg, var(--side) 0%, var(--side2) 100%)", borderColor: "var(--side-line)" }}>
          <div>
            <p className="text-[11px] font-bold text-white/55 flex items-center gap-1.5"><Icon name="gauge" size={13} />ساعت کارکرد فعلی</p>
            <p className="font-display text-[30px] text-white leading-none mt-1 ltr inline-block">{faOH(ds?.current ?? 0)} <span className="text-[14px] text-white/50">h</span></p>
            <p className="text-[10.5px] text-white/45 font-semibold mt-1">
              {ds?.lastRead ? `آخرین خواندن: ${faTime(ds.lastRead)} — منبع: ${eq.device.protocol.toUpperCase()}` : "خواندنی انجام نشده"}
            </p>
          </div>
          <div className="text-left"><ConnBadge state={ds?.connection ?? "unknown"} /></div>
        </div>

        {doneToday.length > 0 && (
          <div className="mt-4 rounded-lg p-3 text-[12px] font-bold flex items-center gap-2" style={{ background: "var(--amber)" , color: "#1c1502" }}>
            <Icon name="alert" size={15} />برای این تجهیز امروز {faNum(doneToday.length)} کنترل ثبت شده — ثبت مجدد فقط با تأیید سرپرست مجاز است.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <p className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="clipboard" size={16} />چک‌لیست‌های قابل اجرا</p>
          {cls.length === 0 && <Empty icon="clipboard" title="چک‌لیست فعالی نیست" sub="مدیر باید از Checklist Builder چک‌لیست تخصیص دهد" />}
          <div className="space-y-2.5">
            {cls.map((c) => {
              const items = c.sections.reduce((s, x) => s + x.items.length, 0);
              return (
                <button key={c.id} onClick={() => canSubmit && onPick(c.id)} disabled={!canSubmit}
                  className="w-full text-right rounded-xl border p-3.5 transition-all group flex items-center justify-between gap-3 disabled:opacity-60"
                  style={{ borderColor: "var(--line2)" }}>
                  <div>
                    <p className="font-bold text-[13.5px] group-hover:text-[var(--acc)] transition-colors">{c.name}</p>
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--muted)" }}>
                      {faNum(c.sections.length)} بخش • {faNum(items)} آیتم • {c.scope === "group" ? "گروه تجهیز" : "اختصاصی تجهیز"}
                    </p>
                  </div>
                  {canSubmit
                    ? <span className="btn btn-acc btn-sm flex-shrink-0"><Icon name="play" size={13} />شروع</span>
                    : <span className="badge b-mut flex-shrink-0"><Icon name="eye" size={11} />فقط مشاهده — Permission ثبت ندارید</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-bold text-[14px] mb-3 flex items-center gap-2"><Icon name="history" size={16} />آخرین کنترل‌ها</p>
          {history.length === 0 && <p className="text-[12px]" style={{ color: "var(--muted)" }}>سابقه‌ای ثبت نشده</p>}
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-[12px] font-semibold panel2 border" style={{ borderColor: "var(--line)" }}>
                <span>{h.date} — {db.shifts.find((s) => s.id === h.shiftId)?.name ?? ""}</span>
                <span className="flex gap-1.5">
                  {h.nokCount > 0 && <span className="badge b-nok">{faNum(h.nokCount)} NOK</span>}
                  {h.nokCount === 0 && h.oorCount === 0 && <span className="badge b-ok"><Icon name="check" size={10} />سالم</span>}
                  {h.oorCount > 0 && <span className="badge b-acc">{faNum(h.oorCount)} خارج محدوده</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ مرحله ۳ — اجرای چک‌لیست */
function ExecuteStage({ eq, cl, onBack, onDone }: { eq: Equipment; cl: Checklist; onBack: () => void; onDone: (c: DC) => void }) {
  const { db, user, submitControl, recordOH, can, readDeviceNow, toast } = useStore();
  const shift = currentShift(db.shifts);
  const date = shiftWorkDate(shift);
  const ds = db.deviceState.find((x) => x.equipmentId === eq.id);
  const draftKey = `nipco-draft-${eq.id}-${cl.id}-${date}-${shift?.id}`;

  const [answers, setAnswers] = useState<Answers>(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}"); } catch { return {}; }
  });
  const [ohMode, setOhMode] = useState<"auto" | "manual">(eq.device.enabled && eq.device.protocol !== "manual" ? "auto" : "manual");
  const [ohManual, setOhManual] = useState("");
  const [ohReason, setOhReason] = useState("");
  const [reading, setReading] = useState(false);
  const [errModal, setErrModal] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(new Date().toISOString());
  const topRef = useRef<HTMLDivElement>(null);

  /* ذخیره خودکار Draft — در قطعی برق/شبکه هم داده از بین نمی‌رود */
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(answers)), 300);
    return () => clearTimeout(t);
  }, [answers, draftKey]);

  /* دسترسی سطح Section — مثال: گروه برق فقط electrical */
  const unlocked = (s: ChecklistSection) => !user?.sectionScope || user.sectionScope.includes(s.category);

  const allItems = useMemo(() => cl.sections.flatMap((s) => (unlocked(s) ? s.items : [])).map((it) => ({ it, sec: sOf(cl, it.id)! })), [cl, user]); // eslint-disable-line

  const resultOf = (it: ChecklistItem, a?: Answers[string]): ControlAnswer["result"] | null => {
    if (!a || a.value === "") return null;
    if (it.kind === "numeric") {
      const v = parseFloat(a.value);
      if (Number.isNaN(v)) return null;
      return clamp(v, it.min, it.max) ? "in-range" : "out-of-range";
    }
    return a.value === "NOK" ? "nok" : "ok";
  };

  const answered = allItems.filter(({ it }) => answers[it.id] && answers[it.id].value !== "").length;
  const nokCount = allItems.filter(({ it }) => resultOf(it, answers[it.id]) === "nok").length;
  const oorCount = allItems.filter(({ it }) => resultOf(it, answers[it.id]) === "out-of-range").length;
  const pct = allItems.length ? Math.round((answered / allItems.length) * 100) : 0;

  function setAns(id: string, patch: Partial<Answers[string]>) {
    setAnswers((prev) => {
      const cur = prev[id] ?? { value: "", desc: "" };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  /* ---------- Validation کامل قبل از Submit ---------- */
  function validate(): string[] {
    const errs: string[] = [];
    for (const { it, sec } of allItems) {
      const a = answers[it.id];
      if (!a || a.value === "") { if (it.required) errs.push(`«${it.title}» در بخش ${sec.name} پاسخ داده نشده`); continue; }
      if (it.kind === "numeric") {
        const v = parseFloat(a.value);
        if (Number.isNaN(v)) { errs.push(`«${it.title}» مقدار عددی نامعتبر است`); continue; }
        if ((a.desc ?? "").trim() === "" && !clamp(v, it.min, it.max)) errs.push(`«${it.title}» خارج از محدوده است — توضیح اجباری است`);
      } else if (a.value === "NOK" && (a.desc ?? "").trim() === "") {
        errs.push(`«${it.title}» نتیجه NOK دارد — توضیح اجباری است`);
      }
    }
    /* ساعت کارکرد */
    if (ohMode === "manual") {
      const v = parseFloat(ohManual);
      if (ohManual === "" || Number.isNaN(v)) errs.push("ساعت کارکرد را وارد کنید (یا از خواندن خودکار استفاده کنید)");
      else if (v < (ds?.current ?? 0) && !can("ophours", "approve")) errs.push(`ساعت واردشده کمتر از مقدار فعلی است — مجوز Adjustment ندارید`);
      else if (v < (ds?.current ?? 0) && ohReason.trim() === "") errs.push("برای کاهش ساعت کارکرد، ثبت دلیل (Adjustment) اجباری است");
    }
    return errs;
  }

  function doSubmit() {
    const errs = validate();
    if (errs.length) { setErrModal(errs); topRef.current?.scrollIntoView({ behavior: "smooth" }); return; }
    setSubmitting(true);
    setTimeout(() => {
      /* ساخت رکورد کنترل روزانه */
      const finalAnswers: ControlAnswer[] = allItems.map(({ it }) => {
        const a = answers[it.id];
        return {
          itemId: it.id, value: a?.value ?? "", result: resultOf(it, a) ?? "ok",
          description: (a?.desc ?? "").trim(), failureLocationId: a?.failLoc || undefined,
        };
      });
      let ohPayload: DC["oh"];
      if (ohMode === "auto") ohPayload = { value: Math.round((ds?.current ?? 0) * 10) / 10, source: "auto", previous: ds?.current ?? 0 };
      else {
        const v = parseFloat(ohManual);
        if (v < (ds?.current ?? 0)) {
          /* کاهش → فقط به‌صورت Adjustment با دلیل و مجوز approve */
          recordOH(eq.id, v, "adjusted", ohReason.trim());
        } else {
          ohPayload = { value: v, source: "manual", previous: ds?.current ?? 0 };
        }
      }
      const ctrl: DC = {
        id: uid(), equipmentId: eq.id, checklistId: cl.id, userId: user!.id,
        shiftId: shift?.id ?? "sh1", date, startedAt: startedAt.current,
        submittedAt: new Date().toISOString(), status: "submitted",
        answers: finalAnswers, nokCount, oorCount, oh: ohPayload,
      };
      const res = submitControl(ctrl);
      setSubmitting(false);
      if (!res.ok) { setErrModal([res.error ?? "خطا در ثبت"]); return; }
      localStorage.removeItem(draftKey);
      onDone(ctrl);
    }, 500);
  }

  async function readNow() {
    setReading(true);
    const r = await readDeviceNow(eq.id);
    setReading(false);
    if (!r.ok) toast(r.error ?? "خطا در خواندن", "err");
    else toast(`خواندن موفق از دستگاه: ${faOH(r.value!)} ساعت`, "ok");
  }

  return (
    <div ref={topRef}>
      {/* هدر چسبان پیشرفت */}
      <div className="sticky top-[64px] z-30 card !rounded-xl p-3.5 mb-4 flex items-center gap-4 flex-wrap no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevs" size={14} />بازگشت</button>
        <div className="min-w-0">
          <p className="font-bold text-[13.5px] truncate">{eq.name} — {cl.name}</p>
          <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{date} • {shift?.name} • {faNum(allItems.length)} آیتم</p>
        </div>
        <div className="flex-1 min-w-[140px]">
          <div className="flex justify-between text-[10.5px] font-bold mb-1" style={{ color: "var(--muted)" }}>
            <span>{faNum(answered)} از {faNum(allItems.length)} پاسخ</span><span>{faNum(pct)}٪</span>
          </div>
          <div className="prog"><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="flex gap-1.5">
          {nokCount > 0 && <span className="badge b-nok pulse-nok">{faNum(nokCount)} NOK</span>}
          {oorCount > 0 && <span className="badge b-acc">{faNum(oorCount)} خارج محدوده</span>}
          {nokCount === 0 && oorCount === 0 && answered > 0 && <span className="badge b-ok">همه سالم</span>}
        </div>
      </div>

      {/* ---------- بخش‌های چک‌لیست ---------- */}
      <div className="space-y-4">
        {cl.sections.map((sec) => {
          const isOpen = unlocked(sec);
          return (
            <section key={sec.id} className={cx("card overflow-hidden", !isOpen && "opacity-70")}>
              <header className="px-4 py-3 flex items-center justify-between panel2 border-b" style={{ borderColor: "var(--line)" }}>
                <h3 className="font-bold text-[14px] flex items-center gap-2">
                  <Icon name={sec.category === "electrical" ? "zap" : sec.category === "safety" ? "shield" : sec.category === "utilities" ? "droplet" : sec.category === "operator" ? "users" : "cog"} size={16} style={{ color: "var(--acc)" }} />
                  {sec.name}
                  <span className="badge b-mut !text-[10px]">{catFa(sec.category)}</span>
                </h3>
                {!isOpen && <span className="badge b-info"><Icon name="lock" size={10} />خارج از محدوده دسترسی شما</span>}
              </header>
              {!isOpen ? (
                <p className="p-4 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                  این بخش فقط مشاهده می‌شود — بر اساس Permission سطح Section، ثبت آن بر عهده گروه تخصصی مربوط است.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--line)" }}>
                  {sec.items.map((it) => (
                    <ItemRow key={it.id} it={it} a={answers[it.id]} result={resultOf(it, answers[it.id])}
                      failLocs={db.failureLocations}
                      onChange={(patch) => setAns(it.id, patch)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* ---------- ساعت کارکرد ---------- */}
      <section className="card p-4 mt-4" style={{ borderColor: "var(--acc)", borderWidth: 1.5 }}>
        <h3 className="font-bold text-[14px] flex items-center gap-2 mb-3">
          <Icon name="gauge" size={17} style={{ color: "var(--acc)" }} />ثبت ساعت کارکرد
          <span className="badge b-mut !text-[10px]">بدون سقف — DECIMAL(18,4)</span>
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-white" style={{ background: "linear-gradient(120deg,var(--side),var(--side2))" }}>
            <p className="text-[11px] font-bold text-white/55">مقدار فعلی دستگاه {ds?.lastRead && `— خوانده‌شده در ${faTime(ds.lastRead)}`}</p>
            <p className="font-display text-[32px] leading-none mt-1 ltr inline-block">{faOH(ds?.current ?? 0)} <span className="text-[15px] text-white/50">h</span></p>
            <div className="flex items-center gap-2 mt-3">
              <ConnBadge state={ds?.connection ?? "unknown"} />
              <button className="btn btn-sm !bg-white/10 !text-white !border-white/20" onClick={readNow}
                disabled={reading || !eq.device.enabled || eq.device.protocol === "manual"}>
                <Icon name="refresh" size={13} className={reading ? "spin" : ""} />{reading ? "در حال خواندن…" : "خواندن از دستگاه"}
              </button>
            </div>
          </div>
          <div>
            <div className="flex gap-1.5 mb-2.5">
              <Seg size="sm" value={ohMode} onChange={setOhMode} options={[
                { v: "auto", label: "خودکار (از دستگاه)" },
                { v: "manual", label: "دستی (Manual Fallback)" },
              ]} />
            </div>
            {ohMode === "auto" ? (
              <div className="rounded-lg p-3 text-[12px] font-semibold flex items-start gap-2" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                <Icon name="check" size={15} className="mt-0.5" />
                مقدار خوانده‌شده از دستگاه ({eq.device.protocol.toUpperCase()}) به‌همراه منبع Auto ثبت می‌شود.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="number" step="0.1" className="inp ltr !text-left" dir="ltr" placeholder="مثلاً 12596.5"
                    value={ohManual} onChange={(e) => setOhManual(e.target.value)} />
                  <span className="btn btn-ghost !cursor-default">ساعت</span>
                </div>
                {ohManual !== "" && parseFloat(ohManual) < (ds?.current ?? 0) && (
                  <div className="rounded-lg p-3 text-[12px] font-semibold space-y-2" style={{ background: "var(--nok-soft)", color: "var(--nok)" }}>
                    <p className="flex gap-1.5 items-center"><Icon name="alert" size={14} />مقدار کمتر از ساعت فعلی است — فقط با Adjustment و مجوز سرپرست قابل ثبت است.</p>
                    {can("ophours", "approve") && (
                      <input className="inp !bg-transparent" placeholder="دلیل اصلاح — مثلاً: تعویض کنترلر و ریست شمارنده (اجباری)"
                        value={ohReason} onChange={(e) => setOhReason(e.target.value)} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Submit ---------- */}
      <div className="sticky bottom-3 z-30 mt-4 card !rounded-xl p-3 flex items-center justify-between gap-3 no-print">
        <p className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>
          {answered < allItems.length ? `${faNum(allItems.length - answered)} آیتم بی‌پاسخ` : "آماده ثبت ✓"}
        </p>
        <button className="btn btn-acc btn-lg min-w-[190px]" onClick={doSubmit} disabled={submitting}>
          {submitting ? <><span className="spin inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent" />در حال ثبت…</> : <><Icon name="check" size={18} />ثبت نهایی کنترل</>}
        </button>
      </div>

      {errModal && (
        <Modal title="ثبت امکان‌پذیر نیست" icon="alert" onClose={() => setErrModal(null)} w={500}
          footer={<button className="btn btn-acc" onClick={() => setErrModal(null)}>متوجه شدم — اصلاح می‌کنم</button>}>
          <p className="text-[12.5px] font-bold mb-3" style={{ color: "var(--nok)" }}>{faNum(errModal.length)} مورد باید برطرف شود:</p>
          <ul className="space-y-1.5 text-[12.5px] font-semibold">
            {errModal.map((e, i) => (
              <li key={i} className="flex gap-2 items-start rounded-lg px-3 py-2" style={{ background: "var(--nok-soft)" }}>
                <span className="text-[var(--nok)] mt-0.5"><Icon name="x" size={13} /></span>{e}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function sOf(cl: Checklist, itemId: string): ChecklistSection | undefined {
  return cl.sections.find((s) => s.items.some((i) => i.id === itemId));
}
const catFa = (c: string) => ({ mechanical: "مکانیک", electrical: "برق", utilities: "تأسیسات", operator: "اپراتوری", safety: "ایمنی" } as Record<string, string>)[c] ?? c;

/* ---------- ردیف آیتم — OK/NOK لمسی یا ورودی عددی با Range ---------- */
function ItemRow({ it, a, result, onChange, failLocs }: {
  it: ChecklistItem; a?: { value: string; desc: string; failLoc?: string };
  result: ControlAnswer["result"] | null; onChange: (p: Partial<{ value: string; desc: string; failLoc?: string }>) => void;
  failLocs: { id: string; name: string }[];
}) {
  const needsDesc = result === "nok" || result === "out-of-range";
  const v = a?.value ?? "";
  const num = it.kind === "numeric" ? parseFloat(v) : NaN;
  const span = (it.max! - it.min!) || 1;
  const pos = it.kind === "numeric" && !Number.isNaN(num) ? Math.min(100, Math.max(0, ((num - it.min!) / span) * 100)) : 0;

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[13.5px] flex items-center gap-2">
            {it.title}
            {it.kind === "numeric" && <span className="badge b-info ltr">{faNum(it.min!, it.decimals ?? 1)} – {faNum(it.max!, it.decimals ?? 1)} {it.unit}</span>}
          </p>
          {result && (
            <span className={cx("badge mt-1", result === "ok" || result === "in-range" ? "b-ok" : result === "nok" ? "b-nok" : "b-acc")}>
              {result === "ok" && "OK — سالم"}{result === "in-range" && "در محدوده مجاز ✓"}
              {result === "nok" && "NOK — خراب"}{result === "out-of-range" && "خارج از محدوده ⚠"}
            </span>
          )}
        </div>

        {it.kind === "oknok" ? (
          <div className="flex gap-2 sm:w-[220px]">
            {it.options.map((opt) => (
              <button key={opt} type="button"
                onClick={() => onChange({ value: opt === v ? "" : opt })}
                className={cx("touch-btn", opt === "NOK" ? "touch-nok" : opt === "OK" ? "touch-ok" : "touch-opt", v === opt && "on")}>
                {opt === "OK" ? <Icon name="check" size={17} /> : opt === "NOK" ? <Icon name="x" size={17} /> : null}
                <span className="ltr">{opt}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sm:w-[260px]">
            <div className="relative">
              <input type="number" step={Math.pow(10, -(it.decimals ?? 1))} inputMode="decimal"
                className={cx("inp ltr !text-left !py-2.5 !text-[15px] font-bold", result === "out-of-range" && "!border-[var(--nok)]")}
                dir="ltr" placeholder="—" value={v}
                onChange={(e) => onChange({ value: e.target.value })} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold" style={{ color: "var(--muted)" }}>{it.unit}</span>
            </div>
            {/* نوار محدوده مجاز */}
            <div className="relative h-1.5 rounded-full mt-2" style={{ background: "var(--ok-soft)" }}>
              <i className="absolute inset-y-0 rounded-full transition-all" style={{ width: "100%", background: "linear-gradient(90deg,var(--nok),var(--ok) 18%,var(--ok) 82%,var(--nok))", opacity: 0.5 }} />
              {v !== "" && <i className="absolute -top-[3px] w-3 h-3 rounded-full border-2 transition-all"
                style={{ left: `calc(${pos}% - 6px)`, background: result === "out-of-range" ? "var(--nok)" : "var(--ok)", borderColor: "var(--panel)" }} />}
            </div>
          </div>
        )}
      </div>

      {/* توضیح اجباری برای NOK / Out of Range + محل خرابی */}
      {needsDesc && (
        <div className="mt-3 rounded-lg p-3 space-y-2 pop-in border" style={{ borderColor: result === "nok" ? "var(--nok)" : "var(--amber)", background: result === "nok" ? "var(--nok-soft)" : "var(--acc-soft)" }}>
          <p className="text-[11.5px] font-bold flex items-center gap-1.5" style={{ color: result === "nok" ? "var(--nok)" : "var(--acc)" }}>
            <Icon name="alert" size={13} />ثبت توضیح برای این نتیجه الزامی است — بدون آن Submit انجام نمی‌شود
          </p>
          <textarea className="inp !min-h-[54px]" placeholder="شرح مشکل، اقدام انجام‌شده یا مورد نیاز…"
            value={a?.desc ?? ""} onChange={(e) => onChange({ desc: e.target.value })} />
          {result === "nok" && (
            <div>
              <label className="lbl !mb-1">محل خرابی (اختیاری — برای گزارش خرابی‌ها)</label>
              <select className="inp" value={a?.failLoc ?? ""} onChange={(e) => onChange({ failLoc: e.target.value })}>
                <option value="">— انتخاب محل خرابی —</option>
                {failLocs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================ مرحله ۴ — پایان */
function DoneStage({ ctrl, onNew, onAgain }: { ctrl: DC; onNew: () => void; onAgain: () => void }) {
  const { db, online } = useStore();
  const eq = db.equipment.find((e) => e.id === ctrl.equipmentId);
  const healthy = ctrl.nokCount === 0 && ctrl.oorCount === 0;
  return (
    <div className="max-w-xl mx-auto text-center fade-up">
      <div className="card p-8">
        <div className={cx("w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 pop-in", healthy ? "" : "pulse-nok")}
          style={{ background: healthy ? "var(--ok-soft)" : "var(--nok-soft)", color: healthy ? "var(--ok)" : "var(--nok)" }}>
          <Icon name={healthy ? "check" : "alert"} size={38} />
        </div>
        <h2 className="font-display text-[28px]">{healthy ? "تجهیز سالم است — کنترل ثبت شد" : "کنترل ثبت شد — نیاز به پیگیری دارد"}</h2>
        <p className="text-[13px] font-semibold mt-1" style={{ color: "var(--muted)" }}>
          {eq?.name} • {ctrl.date} • {faTime(ctrl.submittedAt ?? new Date().toISOString())}
        </p>
        {!online && <p className="badge b-acc mx-auto mt-3"><Icon name="wifioff" size={12} />در صف Sync آفلاین — به‌محض اتصال ارسال می‌شود</p>}

        <div className="grid grid-cols-3 gap-2.5 mt-6">
          {[
            { t: "پاسخ‌های OK", v: ctrl.answers.filter((x) => x.result === "ok" || x.result === "in-range").length, c: "var(--ok)" },
            { t: "موارد NOK", v: ctrl.nokCount, c: "var(--nok)" },
            { t: "خارج از محدوده", v: ctrl.oorCount, c: "var(--amber)" },
          ].map((s) => (
            <div key={s.t} className="rounded-xl p-3.5 panel2 border" style={{ borderColor: "var(--line)" }}>
              <p className="font-display text-[26px]" style={{ color: s.c }}>{faNum(s.v)}</p>
              <p className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{s.t}</p>
            </div>
          ))}
        </div>

        {ctrl.oh && (
          <div className="mt-4 rounded-xl p-3.5 flex items-center justify-between text-[12.5px] font-bold panel2 border" style={{ borderColor: "var(--line)" }}>
            <span className="flex items-center gap-2"><Icon name="gauge" size={16} style={{ color: "var(--acc)" }} />ساعت کارکرد ثبت‌شده</span>
            <span className="ltr">{faOH(ctrl.oh.previous)} → {faOH(ctrl.oh.value)} h <span className="badge b-ok mr-2">+{faOH(ctrl.oh.value - ctrl.oh.previous)}</span></span>
          </div>
        )}

        <div className="flex gap-2.5 mt-7 justify-center">
          <button className="btn btn-acc btn-lg" onClick={onNew}><Icon name="scan" size={17} />کنترل تجهیز بعدی</button>
          <button className="btn btn-ghost btn-lg" onClick={onAgain}><Icon name="refresh" size={16} />چک‌لیست دیگر همین تجهیز</button>
        </div>
      </div>
      <p className="text-[11px] font-semibold mt-4" style={{ color: "var(--muted)" }}>شناسه رکورد: <span className="ltr">{ctrl.id.slice(0, 8)}</span> — ثبت در Activity Log انجام شد</p>
    </div>
  );
}
