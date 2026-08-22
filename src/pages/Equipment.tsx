/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — مدیریت تجهیزات
   ------------------------------------------------------------
   • CRUD کامل تجهیزات / گروه‌ها / محل‌ها (Hall → Line → Area)
   • تعریف تجهیز جدید بدون تغییر Source Code — همه‌چیز از پنل
   • QR اختصاصی هر تجهیز + چاپ لیبل
   • ⚠️ پرس شماره ۶ مطابق صورت‌مسئله در Seed اولیه نیست
   ============================================================ */

import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import type { Equipment as Eq, EquipmentGroup, LocationNode, EquipmentStatus } from "../lib/types";
import { Icon, Modal, PseudoQR, Seg, Empty, Switch } from "../components/ui";
import { cx, faNum, uid } from "../lib/utils";

type Tab = "eq" | "groups" | "locs";

export default function EquipmentPage() {
  const [tab, setTab] = useState<Tab>("eq");
  const { can } = useStore();
  const editable = can("equipment", "edit") || can("equipment", "create");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">مدیریت تجهیزات</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            تعریف تجهیز، گروه و محل جدید بدون نیاز به تغییر کد — Database Driven
          </p>
        </div>
        <Seg value={tab} onChange={setTab} options={[
          { v: "eq", label: "تجهیزات", icon: "factory" },
          { v: "groups", label: "گروه‌ها", icon: "layers" },
          { v: "locs", label: "محل‌ها", icon: "box" },
        ]} />
      </div>
      {tab === "eq" && <EqTab editable={editable} />}
      {tab === "groups" && <GroupsTab editable={editable} />}
      {tab === "locs" && <LocsTab editable={editable} />}
    </div>
  );
}

/* ================= تب تجهیزات ================= */
function EqTab({ editable }: { editable: boolean }) {
  const { db, mutate, log, toast } = useStore();
  const [q, setQ] = useState("");
  const [gid, setGid] = useState("all");
  const [form, setForm] = useState<Eq | null | "new">(null);
  const [qrFor, setQrFor] = useState<Eq | null>(null);
  const [delFor, setDelFor] = useState<Eq | null>(null);

  const list = useMemo(() => db.equipment.filter((e) =>
    (gid === "all" || e.groupId === gid) &&
    (q.trim() === "" || `${e.name} ${e.code} ${e.brand} ${e.model} ${e.serial}`.toLowerCase().includes(q.trim().toLowerCase()))
  ), [db.equipment, q, gid]);

  const loc = (id: string) => { const l = db.locations.find((x) => x.id === id); return l ? `${l.hall} / ${l.line}` : "—"; };
  const stBadge: Record<EquipmentStatus, [string, string]> = {
    active: ["b-ok", "فعال"], idle: ["b-mut", "آماده‌به‌کار"], maintenance: ["b-nok", "تعمیرات"], inactive: ["b-mut", "غیرفعال"],
  };

  return (
    <div className="space-y-3 fade-up">
      <div className="card p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <input className="inp !pr-9 !py-2" placeholder="جستجو در نام، کد، برند، سریال…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Icon name="search" size={15} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-45" />
        </div>
        <select className="inp !w-auto !py-2 text-[12.5px]" value={gid} onChange={(e) => setGid(e.target.value)}>
          <option value="all">همه گروه‌ها</option>
          {db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <span className="text-[11.5px] font-bold" style={{ color: "var(--muted)" }}>{faNum(list.length)} تجهیز</span>
        {editable && <button className="btn btn-acc btn-sm mr-auto" onClick={() => setForm("new")}><Icon name="plus" size={14} />تجهیز جدید</button>}
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl min-w-[900px]">
          <thead><tr><th>کد</th><th>نام تجهیز</th><th>گروه</th><th>برند / مدل</th><th>محل</th><th>وضعیت</th><th>QR</th><th>عملیات</th></tr></thead>
          <tbody>
            {list.map((e) => {
              const g = db.groups.find((x) => x.id === e.groupId);
              const [cls, txt] = stBadge[e.status];
              return (
                <tr key={e.id}>
                  <td><span className="badge b-mut ltr">{e.code}</span></td>
                  <td className="font-bold text-[12.5px]">{e.name}</td>
                  <td className="text-[12px] font-semibold">{g?.name}</td>
                  <td className="text-[12px]" style={{ color: "var(--muted)" }}>{e.brand} {e.model}</td>
                  <td className="text-[12px] font-semibold">{loc(e.locationId)}</td>
                  <td><span className={cx("badge", cls)}>{txt}</span></td>
                  <td><button className="btn btn-ghost btn-sm !px-2" onClick={() => setQrFor(e)} title="نمایش QR"><Icon name="qr" size={14} /></button></td>
                  <td>
                    <div className="flex gap-1.5">
                      {editable && <button className="btn btn-ghost btn-sm !px-2" onClick={() => setForm(e)}><Icon name="pen" size={13} /></button>}
                      {editable && <button className="btn btn-ghost btn-sm !px-2 hover:!text-[var(--nok)]" onClick={() => setDelFor(e)}><Icon name="trash" size={13} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={8}><Empty title="تجهیزی یافت نشد" /></td></tr>}
          </tbody>
        </table>
      </div>

      {form && <EqForm initial={form === "new" ? null : form} onClose={() => setForm(null)} onSave={(data) => {
        if (form === "new") {
          const ne: Eq = { id: uid(), ...data };
          mutate((d) => d.equipment.unshift(ne));
          mutate((d) => { d.deviceState.unshift({ equipmentId: ne.id, current: 0, connection: "disconnected" }); });
          log("ایجاد تجهیز", `Equipment / ${ne.code}`);
          toast("تجهیز جدید ایجاد شد ✓", "ok");
        } else {
          mutate((d) => { const x = d.equipment.find((e) => e.id === (form as Eq).id); if (x) Object.assign(x, data); });
          log("ویرایش تجهیز", `Equipment / ${(form as Eq).code}`);
          toast("تغییرات ذخیره شد ✓", "ok");
        }
        setForm(null);
      }} />}

      {qrFor && (
        <Modal title={`QR Code — ${qrFor.name}`} icon="qr" onClose={() => setQrFor(null)} w={380}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setQrFor(null)}>بستن</button>
            <button className="btn btn-acc" onClick={() => window.print()}><Icon name="printer" size={15} />چاپ لیبل</button>
          </>}>
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--line2)" }}>
              <PseudoQR value={`NIPCO-EQ:${qrFor.code}`} size={190} />
            </div>
            <p className="font-display text-[20px]">{qrFor.code}</p>
            <p className="text-[11.5px] font-semibold text-center" style={{ color: "var(--muted)" }}>
              تکنسین با اسکن این کد مستقیماً کنترل روزانه همین تجهیز را شروع می‌کند
            </p>
          </div>
        </Modal>
      )}

      {delFor && (
        <Modal title="حذف تجهیز" icon="trash" onClose={() => setDelFor(null)} w={400}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDelFor(null)}>انصراف</button>
            <button className="btn btn-nok" onClick={() => {
              mutate((d) => { const x = d.equipment.find((e) => e.id === delFor.id); if (x) x.status = "inactive"; });
              log("غیرفعال‌سازی تجهیز (حذف نرم)", `Equipment / ${delFor.code}`, "warning");
              toast("تجهیز غیرفعال شد (حذف نرم) — سوابق حفظ می‌شود", "info");
              setDelFor(null);
            }}><Icon name="trash" size={14} />غیرفعال کردن</button>
          </>}>
          <p className="text-[13px] font-semibold leading-6">
            «{delFor.name}» غیرفعال می‌شود. سوابق کنترل و ساعت کارکرد آن <b>حفظ</b> می‌شود (Soft Delete) و تجهیز از فهرست‌های اجرایی خارج می‌شود.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ---------- فرم تجهیز ---------- */
function EqForm({ initial, onClose, onSave }: { initial: Eq | null; onClose: () => void; onSave: (d: Omit<Eq, "id">) => void }) {
  const { db } = useStore();
  const [f, setF] = useState(() => initial ?? {
    code: "", name: "", groupId: db.groups[0]?.id ?? "", type: "", brand: "", model: "", serial: "",
    capacity: "", locationId: db.locations[0]?.id ?? "", status: "active" as EquipmentStatus,
    commissionDate: "1405/01/01", description: "",
    device: { enabled: false, protocol: "manual" as const, pollingSec: 60, timeoutMs: 3000, retryCount: 3 },
  });
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={initial ? `ویرایش ${initial.name}` : "تجهیز جدید"} icon="factory" onClose={onClose} w={620}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>انصراف</button>
        <button className="btn btn-acc" onClick={() => {
          if (!f.code.trim() || !f.name.trim()) { setErr("کد و نام تجهیز الزامی است"); return; }
          onSave(f as Omit<Eq, "id">);
        }}><Icon name="check" size={15} />ذخیره</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="lbl">کد تجهیز (داخل QR) *</label><input className="inp ltr !text-left" dir="ltr" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="PRS-1600" /></div>
        <div><label className="lbl">نام تجهیز *</label><input className="inp" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="پرس هیدرولیک ۱۶۰۰ تن" /></div>
        <div><label className="lbl">گروه</label>
          <select className="inp" value={f.groupId} onChange={(e) => set("groupId", e.target.value)}>{db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label className="lbl">نوع</label><input className="inp" value={f.type} onChange={(e) => set("type", e.target.value)} placeholder="پرس هیدرولیک" /></div>
        <div><label className="lbl">برند</label><input className="inp" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></div>
        <div><label className="lbl">مدل</label><input className="inp" value={f.model} onChange={(e) => set("model", e.target.value)} /></div>
        <div><label className="lbl">سریال</label><input className="inp ltr !text-left" dir="ltr" value={f.serial} onChange={(e) => set("serial", e.target.value)} /></div>
        <div><label className="lbl">ظرفیت</label><input className="inp" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="۱۶۰۰ تن" /></div>
        <div><label className="lbl">محل (سالن / خط / ناحیه)</label>
          <select className="inp" value={f.locationId} onChange={(e) => set("locationId", e.target.value)}>
            {db.locations.map((l) => <option key={l.id} value={l.id}>{l.hall} / {l.line} / {l.area}</option>)}
          </select></div>
        <div><label className="lbl">وضعیت</label>
          <select className="inp" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">فعال</option><option value="idle">آماده‌به‌کار</option><option value="maintenance">تعمیرات</option><option value="inactive">غیرفعال</option>
          </select></div>
        <div className="sm:col-span-2"><label className="lbl">توضیحات</label><textarea className="inp" value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
      </div>
      {err && <p className="text-[12px] font-bold mt-2.5" style={{ color: "var(--nok)" }}>{err}</p>}
    </Modal>
  );
}

/* ================= تب گروه‌ها ================= */
function GroupsTab({ editable }: { editable: boolean }) {
  const { db, mutate, log, toast } = useStore();
  const [name, setName] = useState("");
  const [ren, setRen] = useState<EquipmentGroup | null>(null);

  return (
    <div className="fade-up">
      {editable && (
        <div className="card p-3.5 flex gap-2 mb-4">
          <input className="inp flex-1" placeholder="نام گروه جدید — مثلاً: CNC" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-acc" onClick={() => {
            if (name.trim().length < 2) return;
            mutate((d) => d.groups.push({ id: uid(), name: name.trim(), icon: "box", active: true }));
            log("ایجاد گروه تجهیز", `EquipmentGroups / ${name.trim()}`);
            toast("گروه جدید ایجاد شد ✓", "ok"); setName("");
          }}><Icon name="plus" size={15} />افزودن گروه</button>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {db.groups.map((g) => {
          const count = db.equipment.filter((e) => e.groupId === g.id && e.status !== "inactive").length;
          return (
            <div key={g.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[14px] truncate">{g.name}</p>
                <p className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{faNum(count)} تجهیز • {g.active ? "فعال" : "غیرفعال"}</p>
              </div>
              {editable && (
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost btn-sm !px-2" onClick={() => setRen(g)}><Icon name="pen" size={13} /></button>
                  <Switch on={g.active} onChange={(v) => { mutate((d) => { const x = d.groups.find((y) => y.id === g.id); if (x) x.active = v; }); log(v ? "فعال‌سازی گروه" : "غیرفعال‌سازی گروه", `EquipmentGroups / ${g.name}`); }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {ren && (
        <Modal title="تغییر نام گروه" icon="pen" onClose={() => setRen(null)} w={380}
          footer={<button className="btn btn-acc" onClick={() => {
            mutate((d) => { const x = d.groups.find((y) => y.id === ren.id); if (x) x.name = ren.name; });
            log("ویرایش گروه تجهیز", `EquipmentGroups / ${ren.name}`); setRen(null); toast("ذخیره شد ✓", "ok");
          }}>ذخیره</button>}>
          <input className="inp" value={ren.name} onChange={(e) => setRen({ ...ren, name: e.target.value })} />
        </Modal>
      )}
    </div>
  );
}

/* ================= تب محل‌ها ================= */
function LocsTab({ editable }: { editable: boolean }) {
  const { db, mutate, log, toast } = useStore();
  const [f, setF] = useState({ hall: "", line: "", area: "" });
  return (
    <div className="fade-up grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>سالن (Hall)</th><th>خط (Line)</th><th>ناحیه (Area)</th><th>تجهیزات</th>{editable && <th>حذف</th>}</tr></thead>
          <tbody>
            {db.locations.map((l) => (
              <tr key={l.id}>
                <td className="font-bold text-[12.5px]">{l.hall}</td><td className="text-[12.5px]">{l.line}</td><td className="text-[12.5px]">{l.area}</td>
                <td><span className="badge b-mut">{faNum(db.equipment.filter((e) => e.locationId === l.id).length)}</span></td>
                {editable && <td><button className="btn btn-ghost btn-sm !px-2 hover:!text-[var(--nok)]"
                  onClick={() => {
                    if (db.equipment.some((e) => e.locationId === l.id)) { toast("این محل دارای تجهیز است — ابتدا تجهیزات را منتقل کنید", "err"); return; }
                    mutate((d) => { d.locations = d.locations.filter((x) => x.id !== l.id); });
                    log("حذف محل", `Locations / ${l.hall}-${l.line}`, "warning");
                  }}><Icon name="trash" size={13} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="card p-4 h-fit">
          <h3 className="font-bold text-[13.5px] mb-3 flex items-center gap-2"><Icon name="plus" size={15} style={{ color: "var(--acc)" }} />محل جدید</h3>
          <div className="space-y-2.5">
            <div><label className="lbl">سالن</label><input className="inp" value={f.hall} onChange={(e) => setF({ ...f, hall: e.target.value })} placeholder="سالن ۳" /></div>
            <div><label className="lbl">خط</label><input className="inp" value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })} placeholder="خط رنگ" /></div>
            <div><label className="lbl">ناحیه</label><input className="inp" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="ناحیه D" /></div>
            <button className="btn btn-acc w-full" onClick={() => {
              if (!f.hall.trim() || !f.line.trim()) { toast("سالن و خط الزامی است", "err"); return; }
              const nl: LocationNode = { id: uid(), hall: f.hall.trim(), line: f.line.trim(), area: f.area.trim() || "—" };
              mutate((d) => d.locations.push(nl));
              log("ایجاد محل", `Locations / ${nl.hall}-${nl.line}`);
              toast("محل جدید اضافه شد ✓", "ok"); setF({ hall: "", line: "", area: "" });
            }}><Icon name="check" size={15} />ثبت محل</button>
          </div>
          <p className="text-[10.5px] font-semibold mt-3" style={{ color: "var(--muted)" }}>ساختار: Company → Hall → Line → Area → Location → Equipment</p>
        </div>
      )}
    </div>
  );
}
