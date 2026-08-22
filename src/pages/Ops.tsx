/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — اعلان‌ها و Activity Log
   ------------------------------------------------------------
   • Notification Center: Overdue/NOK/Failure/OOR/Backup/System
     با نمایش کانال‌های Email/SMS طبق Ruleهای تنظیمات
   • Activity Log: کاربر / زمان / IP / عملیات / موجودیت / نتیجه
   ============================================================ */

import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { NotifType } from "../lib/types";
import { Icon, Seg, Empty } from "../components/ui";
import { cx, faNum, faDate, faTime, timeAgo } from "../lib/utils";

/* ================= مرکز اعلان‌ها ================= */
export function Notifications() {
  const { db, mutate } = useStore();
  const [f, setF] = useState<"all" | NotifType>("all");
  const list = db.notifications.filter((n) => f === "all" || n.type === f);
  const unread = db.notifications.filter((n) => !n.read).length;

  const meta: Record<NotifType, { icon: string; color: string; label: string }> = {
    nok: { icon: "x", color: "var(--nok)", label: "NOK" },
    failure: { icon: "alert", color: "var(--nok)", label: "خرابی" },
    oor: { icon: "gauge", color: "var(--amber)", label: "خارج محدوده" },
    overdue: { icon: "clock", color: "var(--amber)", label: "عقب‌افتاده" },
    backup: { icon: "database", color: "var(--info)", label: "پشتیبان" },
    system: { icon: "info", color: "var(--info)", label: "سیستم" },
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">مرکز اعلان‌ها</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            {faNum(unread)} اعلان خوانده‌نشده — ارسال Email/SMS طبق Ruleها
          </p>
        </div>
        <div className="flex gap-2">
          <Seg size="sm" value={f} onChange={setF} options={[
            { v: "all", label: "همه" }, { v: "nok", label: "NOK" }, { v: "failure", label: "خرابی" },
            { v: "oor", label: "محدوده" }, { v: "overdue", label: "عقب‌افتاده" }, { v: "backup", label: "پشتیبان" },
          ]} />
          <button className="btn btn-ghost btn-sm" onClick={() => mutate((d) => d.notifications.forEach((n) => { n.read = true; }))}>
            <Icon name="check" size={13} />خواندن همه
          </button>
        </div>
      </div>

      <div className="space-y-2.5 fade-up">
        {list.map((n) => {
          const m = meta[n.type];
          return (
            <button key={n.id} onClick={() => mutate((d) => { const x = d.notifications.find((y) => y.id === n.id); if (x) x.read = true; })}
              className={cx("w-full text-right card p-4 flex items-start gap-3.5 transition-all hover:-translate-y-px", !n.read && "border-r-[3px]")}
              style={!n.read ? { borderRightColor: m.color } : { opacity: 0.75 }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color }}>
                <Icon name={m.icon} size={19} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <b className="text-[13.5px]">{n.title}</b>
                  <span className="badge b-mut !text-[10px]">{m.label}</span>
                  {!n.read && <span className="w-2 h-2 rounded-full blink" style={{ background: m.color }} />}
                </span>
                <span className="block text-[12px] font-semibold mt-0.5 truncate" style={{ color: "var(--muted)" }}>{n.body}</span>
                <span className="flex items-center gap-3 mt-1.5 text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>
                  {timeAgo(n.at)}
                  {n.email && <span className="flex items-center gap-1"><Icon name="mail" size={11} />Email</span>}
                  {n.sms && <span className="flex items-center gap-1"><Icon name="message" size={11} />SMS</span>}
                </span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && <div className="card"><Empty icon="bell" title="اعلانی در این دسته نیست" /></div>}
      </div>
    </div>
  );
}

/* ================= Activity Log ================= */
export function ActivityLog() {
  const { db } = useStore();
  const [fAction, setFAction] = useState("all");
  const [limit, setLimit] = useState(25);

  const actions = useMemo(() => [...new Set(db.logs.map((l) => l.action))], [db.logs]);
  const list = db.logs.filter((l) => fAction === "all" || l.action === fAction).slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">Activity Log</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            همه عملیات مهم سامانه — کاربر، زمان، IP، موجودیت و نتیجه
          </p>
        </div>
        <select className="inp !w-auto !py-2 text-[12.5px]" value={fAction} onChange={(e) => setFAction(e.target.value)}>
          <option value="all">همه عملیات‌ها</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto fade-up">
        <table className="tbl min-w-[820px]">
          <thead><tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>موجودیت / رکورد</th><th>IP</th><th>نتیجه</th></tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td className="text-[11.5px] whitespace-nowrap" style={{ color: "var(--muted)" }}>{faDate(l.at)} — {faTime(l.at)}</td>
                <td className="font-bold text-[12px]">{l.username || "سیستم"}</td>
                <td className="text-[12px]">{l.action}</td>
                <td className="text-[11.5px] ltr !text-right" style={{ color: "var(--muted)" }}>{l.entity}</td>
                <td className="text-[11px] ltr inline-block" style={{ color: "var(--muted)" }}>{l.ip}</td>
                <td>{l.result === "success" ? <span className="badge b-ok">موفق</span> : l.result === "failed" ? <span className="badge b-nok">ناموفق</span> : <span className="badge b-acc">هشدار</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {db.logs.length > limit && (
          <div className="p-3 text-center">
            <button className="btn btn-ghost btn-sm" onClick={() => setLimit(limit + 25)}><Icon name="chevd" size={13} />نمایش موارد بیشتر ({faNum(db.logs.length - limit)} مانده)</button>
          </div>
        )}
      </div>
    </div>
  );
}
