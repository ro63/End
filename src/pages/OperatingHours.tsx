/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — ساعت کارکرد (Operating Hours)
   ⚠️ قلب فنی سیستم
   ------------------------------------------------------------
   • خواندن خودکار از Industrial Gateway (PLC/HMI/OPC UA/Modbus)
   • Manual Fallback با ثبت منبع (Auto / Manual / Adjusted)
   • قانون طلایی: مقدار جدید < قبلی ❌ مگر Adjustment با دلیل+مجوز
   • تاریخچه کامل + بدون سقف مصنوعی (DECIMAL(18,4))
   • تنظیمات ارتباط دستگاه — فقط فیلدهای Protocol انتخابی نمایش
   ============================================================ */

import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Equipment, OHSource } from "../lib/types";
import { Icon, Modal, ConnBadge, Spark, Seg, Empty } from "../components/ui";
import { cx, faNum, faOH, faTime, faDate, uid, download, toCSV } from "../lib/utils";

const protocols: { v: OHSource; label: string }[] = [
  { v: "manual", label: "دستی (Manual)" }, { v: "plc", label: "PLC" }, { v: "hmi", label: "HMI" },
  { v: "opcua", label: "OPC UA" }, { v: "modbus-tcp", label: "Modbus TCP" }, { v: "modbus-rtu", label: "Modbus RTU" },
  { v: "api", label: "API" }, { v: "gateway", label: "Industrial Gateway" },
];

export default function OperatingHours() {
  const { db, can, recordOH, readDeviceNow, mutate, toast, log } = useStore();
  const [tab, setTab] = useState<"live" | "history" | "device">("live");
  const [fEq, setFEq] = useState("all");
  const [fSrc, setFSrc] = useState("all");
  const [selEq, setSelEq] = useState<string>(db.equipment[0]?.id ?? "");
  const [manualFor, setManualFor] = useState<Equipment | null>(null);
  const [adjustFor, setAdjustFor] = useState<Equipment | null>(null);
  const [reading, setReading] = useState("");

  const eqName = (id: string) => db.equipment.find((e) => e.id === id)?.name ?? "—";

  const history = useMemo(() => db.ohHistory
    .filter((h) => (fEq === "all" || h.equipmentId === fEq) && (fSrc === "all" || h.source === fSrc))
    .slice(0, 60), [db.ohHistory, fEq, fSrc]);

  /* نمودار تغییرات روزانه — مجموع diff به تفکیک روز */
  const days = [...new Set(db.ohHistory.map((h) => h.date))].sort().slice(-10);
  const daily = days.map((d) => ({ label: d.slice(5), value: Math.round(db.ohHistory.filter((h) => h.date === d).reduce((s, h) => s + Math.max(0, h.diff), 0) * 10) / 10 }));

  async function readNow(eq: Equipment) {
    setReading(eq.id);
    const r = await readDeviceNow(eq.id);
    setReading("");
    if (!r.ok) toast(r.error ?? "خطا در خواندن", "err");
    else toast(`خواندن موفق از ${eq.device.protocol.toUpperCase()}: ${faOH(r.value!)} h`, "ok");
  }

  /* ---------- ذخیره تنظیمات ارتباط دستگاه ---------- */
  function saveDevice(eq: Equipment, patch: Partial<Equipment["device"]>) {
    mutate((d) => {
      const e = d.equipment.find((x) => x.id === eq.id);
      if (e) e.device = { ...e.device, ...patch };
    });
  }

  const srcBadge = (s: string) => s === "auto" ? <span className="badge b-ok">Auto</span> : s === "manual" ? <span className="badge b-info">Manual</span> : <span className="badge b-acc">Adjusted</span>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">ساعت کارکرد تجهیزات</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            خواندن خودکار از دستگاه • Manual Fallback • تاریخچه و ردیابی منبع — بدون سقف مصنوعی
          </p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "live", label: "وضعیت زنده", icon: "signal" },
          { v: "history", label: "تاریخچه و گزارش", icon: "history" },
          { v: "device", label: "تنظیمات دستگاه‌ها", icon: "plug" },
        ]} />
      </div>

      {/* ================= وضعیت زنده ================= */}
      {tab === "live" && (
        <div className="space-y-4 fade-up">
          <div className="card overflow-x-auto">
            <table className="tbl min-w-[820px]">
              <thead><tr>
                <th>تجهیز</th><th>ساعت کارکرد فعلی</th><th>اتصال</th><th>آخرین خواندن</th><th>منبع/پروتکل</th><th>روند</th><th>عملیات</th>
              </tr></thead>
              <tbody>
                {db.equipment.filter((e) => e.status !== "inactive").map((eq) => {
                  const ds = db.deviceState.find((d) => d.equipmentId === eq.id);
                  const spark = db.ohHistory.filter((h) => h.equipmentId === eq.id).slice(0, 10).reverse().map((h) => h.value);
                  return (
                    <tr key={eq.id}>
                      <td>
                        <p className="font-bold text-[12.5px]">{eq.name}</p>
                        <p className="text-[10.5px] ltr inline-block" style={{ color: "var(--muted)" }}>{eq.code}</p>
                      </td>
                      <td>
                        <span className="font-display text-[19px] ltr inline-block">{faOH(ds?.current ?? 0)}</span>
                        <span className="text-[10.5px] font-bold opacity-50"> h</span>
                      </td>
                      <td><ConnBadge state={ds?.connection ?? "unknown"} /></td>
                      <td className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{ds?.lastRead ? faTime(ds.lastRead) : "—"}</td>
                      <td>{eq.device.enabled ? <span className="badge b-info ltr">{eq.device.protocol.toUpperCase()}</span> : <span className="badge b-mut">دستی</span>}</td>
                      <td>{spark.length > 1 ? <Spark points={spark} w={80} /> : <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td>
                        <div className="flex gap-1.5">
                          <button className="btn btn-ghost btn-sm" title="خواندن از دستگاه" onClick={() => readNow(eq)}
                            disabled={reading === eq.id || !eq.device.enabled || eq.device.protocol === "manual"}>
                            <Icon name="refresh" size={13} className={reading === eq.id ? "spin" : ""} />
                          </button>
                          {can("ophours", "create") && <button className="btn btn-ghost btn-sm" title="ثبت دستی" onClick={() => setManualFor(eq)}><Icon name="pen" size={13} /></button>}
                          {can("ophours", "approve") && <button className="btn btn-ghost btn-sm" title="اصلاح (Adjustment)" onClick={() => setAdjustFor(eq)}><Icon name="sliders" size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="font-bold text-[13.5px] mb-3 flex items-center gap-2"><Icon name="chart" size={16} style={{ color: "var(--acc)" }} />مجموع کارکرد روزانه ناوگان (۱۰ روز)</h3>
              <div className="flex items-end gap-1.5 h-[120px]">
                {daily.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 justify-end group" title={`${d.label}: ${d.value} ساعت`}>
                    <span className="text-[9.5px] font-bold opacity-0 group-hover:opacity-100">{faOH(d.value)}</span>
                    <div className="w-full rounded-t transition-all" style={{ height: `${Math.max(4, (d.value / Math.max(1, ...daily.map((x) => x.value))) * 85)}px`, background: "var(--acc)" }} />
                    <span className="text-[9.5px] font-semibold" style={{ color: "var(--muted)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4 text-[12.5px] font-semibold space-y-2.5">
              <h3 className="font-bold text-[13.5px] flex items-center gap-2"><Icon name="info" size={16} style={{ color: "var(--info)" }} />معماری یکپارچه‌سازی صنعتی</h3>
              {[
                ["۱", "Machine / PLC / HMI — منبع داده روی دستگاه"],
                ["۲", "Industrial Gateway / Edge Service — پروتکل‌های OPC UA، Modbus و…"],
                ["۳", "NIPCO Backend / API — ذخیره، Validation و تاریخچه"],
                ["۴", "Tablet / Dashboard — نمایش زنده و گزارش"],
              ].map(([n, t]) => (
                <p key={n} className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-display flex-shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>{n}</span>{t}
                </p>
              ))}
              <p className="text-[11px] rounded-lg p-2.5" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                ارتباط مستقیم وب‌اپ با PLC ممنوع است — همه‌چیز از Gateway امن عبور می‌کند و Modulare؛ افزودن منبع جدید بدون بازنویسی سیستم.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= تاریخچه و گزارش ================= */}
      {tab === "history" && (
        <div className="space-y-3 fade-up">
          <div className="card p-3.5 flex flex-wrap items-center gap-2.5">
            <Icon name="filter" size={16} className="opacity-50" />
            <select className="inp !w-auto !py-1.5 text-[12.5px]" value={fEq} onChange={(e) => setFEq(e.target.value)}>
              <option value="all">همه تجهیزات</option>
              {db.equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="inp !w-auto !py-1.5 text-[12.5px]" value={fSrc} onChange={(e) => setFSrc(e.target.value)}>
              <option value="all">همه منابع</option><option value="auto">Auto</option><option value="manual">Manual</option><option value="adjusted">Adjusted</option>
            </select>
            <span className="text-[11.5px] font-bold" style={{ color: "var(--muted)" }}>{faNum(history.length)} رکورد</span>
            <button className="btn btn-ghost btn-sm mr-auto" disabled={!can("reports", "export")}
              onClick={() => download("nipco-operating-hours.csv", toCSV(
                ["تجهیز", "تاریخ", "ساعت", "قبلی", "جدید", "اختلاف", "منبع", "کاربر", "دلیل"],
                history.map((h) => [eqName(h.equipmentId), h.date, h.time, h.previous, h.value, h.diff, h.source, db.users.find((u) => u.id === h.userId)?.username ?? "—", h.reason ?? ""])), "text/csv")}>
              <Icon name="download" size={13} />خروجی Excel/CSV
            </button>
          </div>

          <div className="card overflow-x-auto">
            <table className="tbl min-w-[860px]">
              <thead><tr><th>تجهیز</th><th>تاریخ</th><th>زمان</th><th>قبلی</th><th>جدید</th><th>اختلاف</th><th>منبع</th><th>کاربر</th><th>دلیل/توضیح</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="font-bold text-[12px]">{eqName(h.equipmentId)}</td>
                    <td className="text-[12px]">{h.date}</td>
                    <td className="text-[12px] ltr inline-block">{h.time}</td>
                    <td className="ltr text-[12px] font-semibold">{faOH(h.previous)}</td>
                    <td className="ltr text-[12px] font-bold">{faOH(h.value)}</td>
                    <td><span className={cx("badge ltr", h.diff >= 0 ? "b-ok" : "b-nok")}>{h.diff >= 0 ? "+" : ""}{faOH(h.diff)}</span></td>
                    <td>{srcBadge(h.source)}</td>
                    <td className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{db.users.find((u) => u.id === h.userId)?.username ?? "—"}</td>
                    <td className="text-[11.5px] max-w-[220px] truncate" title={h.reason}>{h.reason ?? "—"}</td>
                  </tr>
                ))}
                {history.length === 0 && <tr><td colSpan={9}><Empty icon="history" title="رکوردی مطابق فیلتر نیست" /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= تنظیمات ارتباط دستگاه ================= */}
      {tab === "device" && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 fade-up">
          <div className="card p-2 h-fit max-h-[520px] overflow-auto">
            {db.equipment.filter((e) => e.status !== "inactive").map((eq) => (
              <button key={eq.id} onClick={() => setSelEq(eq.id)}
                className={cx("w-full text-right rounded-lg px-3 py-2.5 mb-1 text-[12.5px] font-bold transition-all flex items-center justify-between", selEq === eq.id ? "" : "opacity-60 hover:opacity-100")}
                style={selEq === eq.id ? { background: "var(--acc-soft)", color: "var(--acc)" } : {}}>
                <span className="truncate">{eq.name}</span>
                {eq.device.enabled ? <span className="w-2 h-2 rounded-full blink" style={{ background: "var(--ok)" }} /> : <span className="w-2 h-2 rounded-full" style={{ background: "var(--line2)" }} />}
              </button>
            ))}
          </div>

          {(() => {
            const eq = db.equipment.find((e) => e.id === selEq);
            if (!eq) return null;
            const d = eq.device;
            const proto = d.protocol;
            const needIp = ["plc", "hmi", "opcua", "modbus-tcp", "api", "gateway"].includes(proto);
            const needReg = ["plc", "modbus-tcp", "modbus-rtu", "opcua"].includes(proto);
            return (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[15px] flex items-center gap-2"><Icon name="plug" size={17} style={{ color: "var(--acc)" }} />{eq.name}</h3>
                  <ConnBadge state={db.deviceState.find((x) => x.equipmentId === eq.id)?.connection ?? "unknown"} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg px-3.5 py-2.5 panel2 border" style={{ borderColor: "var(--line)" }}>
                    <span className="text-[12.5px] font-bold">خواندن خودکار ساعت کارکرد از دستگاه</span>
                    <label className="flex items-center gap-3">
                      <span className="badge" style={{ background: d.enabled ? "var(--ok-soft)" : "var(--panel2)", color: d.enabled ? "var(--ok)" : "var(--muted)" }}>{d.enabled ? "Enabled" : "Disabled"}</span>
                      <button className={cx("sw", d.enabled && "on")} onClick={() => { saveDevice(eq, { enabled: !d.enabled }); log("تغییر وضعیت خواندن خودکار", `DeviceIntegration / ${eq.code}`); }} />
                    </label>
                  </div>

                  <div>
                    <label className="lbl">پروتکل ارتباطی (Operating Hours Source)</label>
                    <select className="inp" value={d.protocol} onChange={(e) => saveDevice(eq, { protocol: e.target.value as OHSource, enabled: e.target.value !== "manual" ? d.enabled : false })}>
                      {protocols.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                    </select>
                  </div>
                  {needIp && (
                    <>
                      <div><label className="lbl">IP Address</label><input className="inp ltr !text-left" dir="ltr" value={d.ip ?? ""} onChange={(e) => saveDevice(eq, { ip: e.target.value })} placeholder="192.168.1.10" /></div>
                      <div><label className="lbl">Port</label><input type="number" className="inp ltr !text-left" dir="ltr" value={d.port ?? ""} onChange={(e) => saveDevice(eq, { port: +e.target.value })} /></div>
                      <div><label className="lbl">Device ID</label><input className="inp ltr !text-left" dir="ltr" value={d.deviceId ?? ""} onChange={(e) => saveDevice(eq, { deviceId: e.target.value })} /></div>
                    </>
                  )}
                  {needReg && (
                    <>
                      <div><label className="lbl">{proto === "opcua" ? "Node ID" : "Register / PLC Address"}</label><input className="inp ltr !text-left" dir="ltr" value={proto === "opcua" ? d.deviceId : d.register} onChange={(e) => saveDevice(eq, proto === "opcua" ? { deviceId: e.target.value } : { register: e.target.value })} placeholder={proto === "opcua" ? "ns=2;s=Hours" : "HR40001"} /></div>
                      <div><label className="lbl">Data Type</label>
                        <select className="inp" value={d.dataType ?? "Float32"} onChange={(e) => saveDevice(eq, { dataType: e.target.value })}>
                          {["Float32", "Float64", "UInt32", "Int32"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {proto === "modbus-rtu" && <div><label className="lbl">PLC Address (Station)</label><input className="inp ltr !text-left" dir="ltr" value={d.plcAddress ?? ""} onChange={(e) => saveDevice(eq, { plcAddress: e.target.value })} /></div>}
                  <div><label className="lbl">Polling Interval (ثانیه)</label><input type="number" className="inp ltr !text-left" dir="ltr" value={d.pollingSec} onChange={(e) => saveDevice(eq, { pollingSec: Math.max(5, +e.target.value) })} /></div>
                  <div><label className="lbl">Timeout (ms)</label><input type="number" className="inp ltr !text-left" dir="ltr" value={d.timeoutMs} onChange={(e) => saveDevice(eq, { timeoutMs: +e.target.value })} /></div>
                  <div><label className="lbl">Retry Count</label><input type="number" className="inp ltr !text-left" dir="ltr" value={d.retryCount} onChange={(e) => saveDevice(eq, { retryCount: +e.target.value })} /></div>
                  <div><label className="lbl">Scaling</label><input type="number" step="0.1" className="inp ltr !text-left" dir="ltr" value={d.scaling ?? 1} onChange={(e) => saveDevice(eq, { scaling: +e.target.value })} /></div>
                </div>
                <p className="mt-4 text-[11.5px] font-semibold rounded-lg p-3 flex gap-2 items-start" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
                  <Icon name="shield" size={15} className="flex-shrink-0 mt-0.5" />
                  فقط فیلدهای مرتبط با پروتکل انتخابی نمایش داده می‌شود. در Production این تنظیمات توسط Edge Gateway خوانده شده و ارتباط مستقیم مرورگر با PLC برقرار نمی‌شود.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* ---------- مودال ثبت دستی ---------- */}
      {manualFor && <ManualModal eq={manualFor} onClose={() => setManualFor(null)}
        onSubmit={(v) => { const r = recordOH(manualFor.id, v, "manual"); if (!r.ok) return r.error!; setManualFor(null); return null; }} />}
      {/* ---------- مودال اصلاح ---------- */}
      {adjustFor && <AdjustModal eq={adjustFor} onClose={() => setAdjustFor(null)}
        onSubmit={(v, reason) => { const r = recordOH(adjustFor.id, v, "adjusted", reason); if (!r.ok) return r.error!; setAdjustFor(null); return null; }} />}
    </div>
  );
}

/* ---------- مودال Manual Fallback ---------- */
function ManualModal({ eq, onClose, onSubmit }: { eq: Equipment; onClose: () => void; onSubmit: (v: number) => string | null }) {
  const { db } = useStore();
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const cur = db.deviceState.find((d) => d.equipmentId === eq.id)?.current ?? 0;
  return (
    <Modal title={`ثبت دستی ساعت کارکرد — ${eq.name}`} icon="pen" onClose={onClose} w={440}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>انصراف</button>
        <button className="btn btn-acc" onClick={() => {
          const v = parseFloat(val);
          if (val === "" || Number.isNaN(v)) { setErr("مقدار عددی معتبر وارد کنید"); return; }
          const e = onSubmit(v); if (e) setErr(e);
        }}><Icon name="check" size={15} />ثبت با منبع Manual</button>
      </>}>
      <p className="text-[12px] font-bold mb-2">مقدار فعلی دستگاه: <span className="ltr inline-block font-display text-[17px]">{faOH(cur)} h</span></p>
      <input type="number" step="0.1" className="inp ltr !text-left !text-[16px] font-bold" dir="ltr" autoFocus placeholder="ساعت کارکرد جدید"
        value={val} onChange={(e) => { setVal(e.target.value); setErr(""); }} />
      {err && <p className="text-[12px] font-bold mt-2 flex items-center gap-1.5" style={{ color: "var(--nok)" }}><Icon name="alert" size={13} />{err}</p>}
      <p className="text-[11px] font-semibold mt-3" style={{ color: "var(--muted)" }}>مقدار کمتر از مقدار فعلی پذیرفته نمی‌شود — مگر از طریق Adjustment با دلیل.</p>
    </Modal>
  );
}

/* ---------- مودال Adjustment (نیازمند مجوز approve) ---------- */
function AdjustModal({ eq, onClose, onSubmit }: { eq: Equipment; onClose: () => void; onSubmit: (v: number, reason: string) => string | null }) {
  const { db } = useStore();
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const cur = db.deviceState.find((d) => d.equipmentId === eq.id)?.current ?? 0;
  return (
    <Modal title={`اصلاح ساعت کارکرد (Adjustment) — ${eq.name}`} icon="sliders" onClose={onClose} w={470}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>انصراف</button>
        <button className="btn btn-nok" onClick={() => {
          const v = parseFloat(val);
          if (val === "" || Number.isNaN(v)) { setErr("مقدار جدید را وارد کنید"); return; }
          if (reason.trim().length < 5) { setErr("ثبت دلیل اصلاح اجباری است (حداقل ۵ کاراکتر)"); return; }
          const e = onSubmit(v, reason.trim()); if (e) setErr(e);
        }}><Icon name="check" size={15} />ثبت اصلاح</button>
      </>}>
      <div className="rounded-lg p-3 mb-3 text-[12px] font-bold flex items-center justify-between" style={{ background: "var(--nok-soft)", color: "var(--nok)" }}>
        <span className="flex items-center gap-1.5"><Icon name="alert" size={14} />مقدار فعلی</span>
        <span className="ltr font-display text-[18px]">{faOH(cur)} h</span>
      </div>
      <label className="lbl">مقدار جدید</label>
      <input type="number" step="0.1" className="inp ltr !text-left !text-[16px] font-bold mb-3" dir="ltr" autoFocus
        value={val} onChange={(e) => { setVal(e.target.value); setErr(""); }} />
      <label className="lbl">دلیل اصلاح (در Audit Log ثبت می‌شود)</label>
      <select className="inp mb-2" onChange={(e) => e.target.value && setReason(e.target.value)}>
        <option value="">— انتخاب دلیل —</option>
        {["تعویض کنترلر / PLC و ریست شمارنده", "Meter Reset طبق دستور کار تعمیرات", "خطای خواندن قبلی و اصلاح مقدار", "جابجایی دستگاه و شروع شمارش جدید"].map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input className="inp" placeholder="یا توضیح سفارشی…" value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} />
      {err && <p className="text-[12px] font-bold mt-2 flex items-center gap-1.5" style={{ color: "var(--nok)" }}><Icon name="alert" size={13} />{err}</p>}
      <p className="text-[11px] font-semibold mt-3" style={{ color: "var(--muted)" }}>ثبت می‌شود: مقدار قبلی / جدید / دلیل / کاربر / تاریخ و ساعت / منبع = Adjusted</p>
    </Modal>
  );
}
