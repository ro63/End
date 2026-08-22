/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — کاربران و نقش‌ها
   ------------------------------------------------------------
   • CRUD کاربر + فعال/غیرفعال + Reset رمز (رمز موقت یک‌بارنمایش)
   • نقش‌های Dynamic با ماتریس دسترسی:
     Module × (View/Create/Edit/Delete/Submit/Export/Manage/Approve)
   • محدودیت سطح Section — مثال گروه برق فقط electrical
   • بررسی دسترسی‌ها در Backend هم انجام می‌شود (can در store)
   ============================================================ */

import { useState } from "react";
import { useStore } from "../lib/store";
import type { User, Role, ModuleKey, Perm, SectionCategory } from "../lib/types";
import { Icon, Modal, Seg, Switch } from "../components/ui";
import { cx, faNum, uid, hashPw } from "../lib/utils";

const MODULES: { k: ModuleKey; t: string }[] = [
  { k: "dashboard", t: "داشبورد" }, { k: "control", t: "کنترل روزانه" }, { k: "ophours", t: "ساعت کارکرد" },
  { k: "equipment", t: "تجهیزات" }, { k: "checklists", t: "چک‌لیست‌ها" }, { k: "reports", t: "گزارشات" },
  { k: "notifications", t: "اعلان‌ها" }, { k: "logs", t: "لاگ‌ها" }, { k: "users", t: "کاربران" }, { k: "settings", t: "تنظیمات" },
];
const PERMS: { k: Perm; t: string }[] = [
  { k: "view", t: "View" }, { k: "create", t: "Create" }, { k: "edit", t: "Edit" }, { k: "delete", t: "Delete" },
  { k: "submit", t: "Submit" }, { k: "export", t: "Export" }, { k: "manage", t: "Manage" }, { k: "approve", t: "Approve" },
];
const CATS: { v: SectionCategory; t: string }[] = [
  { v: "mechanical", t: "مکانیک" }, { v: "electrical", t: "برق" }, { v: "utilities", t: "تأسیسات" },
  { v: "operator", t: "اپراتوری" }, { v: "safety", t: "ایمنی" },
];

export default function UsersPage() {
  const [tab, setTab] = useState<"users" | "roles">("users");
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">کاربران و دسترسی‌ها</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>RBAC + Permission-Based تا سطح ماژول، فرم و Section</p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "users", label: "کاربران", icon: "users" },
          { v: "roles", label: "نقش‌ها و ماتریس دسترسی", icon: "shield" },
        ]} />
      </div>
      {tab === "users" ? <UsersTab /> : <RolesTab />}
    </div>
  );
}

/* ================= کاربران ================= */
function UsersTab() {
  const { db, mutate, log, toast } = useStore();
  const [form, setForm] = useState<User | null | "new">(null);
  const [resetFor, setResetFor] = useState<{ u: User; temp: string } | null>(null);

  return (
    <div className="space-y-3 fade-up">
      <div className="flex justify-end">
        <button className="btn btn-acc" onClick={() => setForm("new")}><Icon name="plus" size={15} />کاربر جدید</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[880px]">
          <thead><tr><th>کاربر</th><th>کد پرسنلی</th><th>نام کاربری</th><th>نقش</th><th>شیفت</th><th>محدودیت Section</th><th>فعال</th><th>عملیات</th></tr></thead>
          <tbody>
            {db.users.filter((u) => !u.deleted).map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-[15px] flex-shrink-0" style={{ background: "var(--acc-soft)", color: "var(--acc)" }}>
                      {u.firstName[0]}{u.lastName[0]}
                    </span>
                    <div>
                      <p className="font-bold text-[12.5px]">{u.firstName} {u.lastName}</p>
                      <p className="text-[10.5px]" style={{ color: "var(--muted)" }}>{u.position} — {u.department}</p>
                    </div>
                  </div>
                </td>
                <td className="text-[12px] ltr inline-block">{u.personnelCode}</td>
                <td className="text-[12px] ltr inline-block font-semibold">{u.username}{u.tempPass && <span className="badge b-acc mr-2">رمز موقت فعال</span>}</td>
                <td><span className="badge b-info">{db.roles.find((r) => r.id === u.roleId)?.name ?? "—"}</span></td>
                <td className="text-[12px]">{db.shifts.find((s) => s.id === u.shiftId)?.name ?? "—"}</td>
                <td>{u.sectionScope ? u.sectionScope.map((s) => <span key={s} className="badge b-acc ml-1">{CATS.find((c) => c.v === s)?.t ?? s}</span>) : <span className="badge b-mut">همه بخش‌ها</span>}</td>
                <td><Switch on={u.active} onChange={(v) => {
                  mutate((d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.active = v; });
                  log(v ? "فعال‌سازی کاربر" : "غیرفعال‌سازی کاربر", `Users / ${u.username}`, v ? "success" : "warning");
                  toast(v ? "کاربر فعال شد" : "کاربر غیرفعال شد — دسترسی بلافاصله قطع می‌شود", v ? "ok" : "warn");
                }} /></td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="btn btn-ghost btn-sm !px-2" title="ویرایش" onClick={() => setForm(u)}><Icon name="pen" size={13} /></button>
                    <button className="btn btn-ghost btn-sm !px-2" title="Reset رمز" onClick={() => {
                      const temp = String(Math.floor(100000 + Math.random() * 900000));
                      mutate((d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.tempPass = temp; });
                      log("Reset رمز عبور", `Users / ${u.username}`, "warning");
                      setResetFor({ u, temp });
                    }}><Icon name="key" size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && <UserForm initial={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {resetFor && (
        <Modal title="رمز موقت ایجاد شد" icon="key" onClose={() => setResetFor(null)} w={420}
          footer={<button className="btn btn-acc" onClick={() => setResetFor(null)}>متوجه شدم</button>}>
          <p className="text-[13px] font-semibold leading-6">رمز موقت <b>{resetFor.u.firstName} {resetFor.u.lastName}</b> — فقط یک‌بار نمایش داده می‌شود و پس از اولین ورود باید تغییر کند:</p>
          <p className="font-display text-[34px] text-center my-4 ltr tracking-[0.3em]" style={{ color: "var(--acc)" }}>{resetFor.temp}</p>
        </Modal>
      )}
    </div>
  );
}

function UserForm({ initial, onClose }: { initial: User | null; onClose: () => void }) {
  const { db, mutate, log, toast } = useStore();
  const [f, setF] = useState(() => initial ?? {
    id: "", firstName: "", lastName: "", personnelCode: "", username: "", mobile: "", email: "",
    department: "", position: "", roleId: db.roles[2]?.id ?? db.roles[0].id, shiftId: db.shifts[0].id,
    active: true, passHash: "", sectionScope: null as string[] | null, tempPass: undefined as string | undefined, deleted: false,
  });
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const toggleScope = (c: SectionCategory) => {
    const cur = (f.sectionScope as string[] | null) ?? [...CATS.map((x) => x.v as string)];
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
    set("sectionScope", next.length === CATS.length || next.length === 0 ? null : next);
  };

  return (
    <Modal title={initial ? `ویرایش ${initial.firstName} ${initial.lastName}` : "کاربر جدید"} icon="users" onClose={onClose} w={640}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>انصراف</button>
        <button className="btn btn-acc" onClick={() => {
          if (!f.firstName || !f.lastName || !f.username.trim()) { setErr("نام، نام خانوادگی و نام کاربری الزامی است"); return; }
          if (!initial && pw.length < 6) { setErr("رمز عبور حداقل ۶ کاراکتر"); return; }
          if (!initial && db.users.some((u) => u.username.toLowerCase() === (f.username as string).toLowerCase())) { setErr("این نام کاربری قبلاً ثبت شده"); return; }
          if (initial) {
            mutate((d) => { const x = d.users.find((y) => y.id === initial.id); if (x) Object.assign(x, f); });
            log("ویرایش کاربر", `Users / ${f.username}`);
          } else {
            mutate((d) => d.users.unshift({ ...(f as unknown as User), id: uid(), passHash: hashPw(f.username as string, pw) }));
            log("ایجاد کاربر", `Users / ${f.username}`);
          }
          toast("ذخیره شد ✓", "ok"); onClose();
        }}><Icon name="check" size={15} />ذخیره</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="lbl">نام *</label><input className="inp" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></div>
        <div><label className="lbl">نام خانوادگی *</label><input className="inp" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></div>
        <div><label className="lbl">کد پرسنلی</label><input className="inp ltr !text-left" dir="ltr" value={f.personnelCode} onChange={(e) => set("personnelCode", e.target.value)} /></div>
        <div><label className="lbl">نام کاربری *</label><input className="inp ltr !text-left" dir="ltr" value={f.username} onChange={(e) => set("username", e.target.value)} /></div>
        {!initial && <div><label className="lbl">رمز عبور * (هش می‌شود)</label><input type="password" className="inp ltr !text-left" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} /></div>}
        <div><label className="lbl">موبایل</label><input className="inp ltr !text-left" dir="ltr" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} /></div>
        <div><label className="lbl">ایمیل</label><input className="inp ltr !text-left" dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div><label className="lbl">واحد</label><input className="inp" value={f.department} onChange={(e) => set("department", e.target.value)} /></div>
        <div><label className="lbl">سمت</label><input className="inp" value={f.position} onChange={(e) => set("position", e.target.value)} /></div>
        <div><label className="lbl">نقش</label>
          <select className="inp" value={f.roleId} onChange={(e) => set("roleId", e.target.value)}>{db.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><label className="lbl">شیفت</label>
          <select className="inp" value={f.shiftId} onChange={(e) => set("shiftId", e.target.value)}>{db.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>
      <div className="mt-4">
        <label className="lbl">محدودیت سطح Section (مثال: گروه برق فقط بخش‌های الکتریکی را ثبت کند)</label>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => {
            const all = f.sectionScope === null || f.sectionScope === undefined;
            const on = all || (f.sectionScope as string[]).includes(c.v);
            return (
              <button key={c.v} type="button" onClick={() => toggleScope(c.v)} className={cx("badge !py-1.5 !px-3 cursor-pointer border", on ? "b-acc" : "b-mut")}>
                <Icon name={on ? "check" : "minus"} size={11} />{c.t}
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>اگر همه انتخاب شوند محدودیت حذف می‌شود — Permission در Backend هم بررسی می‌شود.</p>
      </div>
      {err && <p className="text-[12px] font-bold mt-3" style={{ color: "var(--nok)" }}>{err}</p>}
    </Modal>
  );
}

/* ================= نقش‌ها و ماتریس دسترسی ================= */
function RolesTab() {
  const { db, mutate, log, toast, user } = useStore();
  const [sel, setSel] = useState(db.roles[0].id);
  const role = db.roles.find((r) => r.id === sel)!;
  const myRole = db.roles.find((r) => r.id === user?.roleId);
  const isMine = role.id === user?.roleId;

  const toggle = (m: ModuleKey, p: Perm) => {
    mutate((d) => {
      const r = d.roles.find((x) => x.id === sel);
      if (!r) return;
      const cur = r.permissions[m] ?? [];
      const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
      r.permissions = { ...r.permissions, [m]: next };
    });
    log("تغییر Permission نقش", `Roles / ${role.name} — ${m}.${p}`, "warning");
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4 fade-up">
      <div className="card p-2.5 h-fit">
        {db.roles.map((r) => (
          <button key={r.id} onClick={() => setSel(r.id)}
            className={cx("w-full text-right rounded-lg px-3.5 py-3 mb-1 transition-all", sel === r.id ? "" : "opacity-60 hover:opacity-100")}
            style={sel === r.id ? { background: "var(--acc-soft)", color: "var(--acc)" } : {}}>
            <p className="font-bold text-[13px] flex items-center gap-2">{r.name}{r.system && <Icon name="lock" size={11} className="opacity-60" />}</p>
            <p className="text-[10.5px] font-semibold truncate" style={{ color: "var(--muted)" }}>{r.description}</p>
          </button>
        ))}
        <button className="btn btn-dark btn-sm w-full mt-1" onClick={() => {
          const nr: Role = { id: uid(), name: "نقش جدید", description: "", permissions: { dashboard: ["view"] } };
          mutate((d) => d.roles.push(nr));
          log("ایجاد نقش جدید", `Roles / ${nr.name}`);
          setSel(nr.id); toast("نقش جدید ایجاد شد — دسترسی‌ها را تنظیم کنید", "ok");
        }}><Icon name="plus" size={14} />نقش جدید (Dynamic)</button>
      </div>

      <div className="card p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <input className="inp !w-64 !font-bold" value={role.name} onChange={(e) => mutate((d) => { const r = d.roles.find((x) => x.id === sel); if (r) r.name = e.target.value; })} />
            <p className="text-[10.5px] font-bold mt-1" style={{ color: "var(--muted)" }}>
              {faNum(db.users.filter((u) => u.roleId === role.id).length)} کاربر با این نقش {isMine && "— نقش فعلی شما"}
            </p>
          </div>
          {!role.system && !isMine && (
            <button className="btn btn-ghost btn-sm hover:!text-[var(--nok)]" onClick={() => {
              mutate((d) => { d.roles = d.roles.filter((x) => x.id !== role.id); });
              log("حذف نقش", `Roles / ${role.name}`, "warning");
              setSel(db.roles[0].id); toast("نقش حذف شد", "info");
            }}><Icon name="trash" size={13} />حذف نقش</button>
          )}
        </div>
        <table className="tbl min-w-[700px]">
          <thead>
            <tr>
              <th>ماژول</th>
              {PERMS.map((p) => <th key={p.k} className="!text-center">{p.t}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.k}>
                <td className="font-bold text-[12.5px]">{m.t}</td>
                {PERMS.map((p) => {
                  const on = (role.permissions[m.k] ?? []).includes(p.k) || (role.permissions[m.k] ?? []).includes("manage");
                  const managed = (role.permissions[m.k] ?? []).includes("manage");
                  return (
                    <td key={p.k} className="!text-center">
                      <button onClick={() => toggle(m.k, p.k)} disabled={p.k !== "manage" && managed}
                        className={cx("w-6 h-6 rounded-md border inline-flex items-center justify-center transition-all", on && "scale-105")}
                        style={on ? { background: p.k === "manage" ? "var(--acc)" : "var(--ok)", borderColor: "transparent", color: "#fff" } : { borderColor: "var(--line2)" }}
                        title={`${m.t} — ${p.t}`}>
                        {on && <Icon name="check" size={12} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10.5px] font-semibold mt-3 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Icon name="shield" size={13} />Manage = همه دسترسی‌های آن ماژول. Approve برای اصلاح ساعت کارکرد (Adjustment) استفاده می‌شود.
        </p>
      </div>
    </div>
  );
}
