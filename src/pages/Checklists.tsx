/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — Checklist Builder
   ------------------------------------------------------------
   ساختار: Checklist → Section (Dynamic) → Item → Field Type
   • Create / Edit / Delete / Activate / Duplicate / Reorder
   • Group Checklist و Equipment Specific Checklist
   • انواع فیلد: OK/NOK (گزینه‌های قابل توسعه) و Numeric با
     Min/Max/Unit/Decimals/Required — معماری آماده فیلدهای آینده
   ============================================================ */

import { useState } from "react";
import { useStore } from "../lib/store";
import type { Checklist, ChecklistSection, ChecklistItem, SectionCategory } from "../lib/types";
import { Icon, Modal, Switch, Empty } from "../components/ui";
import { cx, faNum, uid } from "../lib/utils";

export default function Checklists() {
  const { db, mutate, log, toast, can } = useStore();
  const [editing, setEditing] = useState<Checklist | null>(null);
  const editable = can("checklists", "edit") || can("checklists", "create");

  const targetName = (c: Checklist) => c.scope === "group"
    ? db.groups.find((g) => g.id === c.targetId)?.name ?? "—"
    : db.equipment.find((e) => e.id === c.targetId)?.name ?? "—";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[26px] leading-none">Checklist Builder</h1>
          <p className="text-[12.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            چک‌لیست‌های کنترل روزانه — بدون کدنویسی بسازید، ترتیب دهید و تخصیص دهید
          </p>
        </div>
        {editable && <button className="btn btn-acc" onClick={() => setEditing({
          id: uid(), name: "", scope: "group", targetId: db.groups[0]?.id ?? "", active: true,
          sections: [{ id: uid(), name: "مکانیک", category: "mechanical", items: [] }],
        })}><Icon name="plus" size={15} />چک‌لیست جدید</button>}
      </div>

      {editing ? (
        <Builder cl={editing} isNew={!db.checklists.some((c) => c.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            if (!c.name.trim()) { toast("نام چک‌لیست الزامی است", "err"); return; }
            if (c.sections.length === 0 || c.sections.every((s) => s.items.length === 0)) { toast("حداقل یک آیتم تعریف کنید", "err"); return; }
            mutate((d) => {
              const i = d.checklists.findIndex((x) => x.id === c.id);
              if (i >= 0) d.checklists[i] = c; else d.checklists.unshift(c);
            });
            log("ذخیره چک‌لیست", `Checklists / ${c.name}`);
            toast("چک‌لیست ذخیره شد ✓", "ok");
            setEditing(null);
          }} />
      ) : (
        <div className="grid md:grid-cols-2 gap-3.5 fade-up">
          {db.checklists.map((c) => {
            const items = c.sections.reduce((s, x) => s + x.items.length, 0);
            return (
              <div key={c.id} className="card p-4.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[14.5px]">{c.name}</p>
                    <p className="text-[11.5px] font-semibold mt-1 flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
                      <span className={cx("badge", c.scope === "group" ? "b-info" : "b-acc")}>{c.scope === "group" ? "گروه تجهیز" : "اختصاصی تجهیز"}</span>
                      {targetName(c)} • {faNum(c.sections.length)} بخش • {faNum(items)} آیتم
                    </p>
                  </div>
                  {editable && <Switch on={c.active} onChange={(v) => { mutate((d) => { const x = d.checklists.find((y) => y.id === c.id); if (x) x.active = v; }); log(v ? "فعال‌سازی چک‌لیست" : "غیرفعال‌سازی چک‌لیست", `Checklists / ${c.name}`); }} />}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.sections.map((s) => <span key={s.id} className="badge b-mut">{s.name} ({faNum(s.items.length)})</span>)}
                </div>
                {editable && (
                  <div className="flex gap-1.5 mt-3.5 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(c))}><Icon name="pen" size={13} />ویرایش</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      const copy = structuredClone(c); copy.id = uid(); copy.name = c.name + " (کپی)";
                      copy.sections = copy.sections.map((s) => ({ ...s, id: uid(), items: s.items.map((i) => ({ ...i, id: uid() })) }));
                      mutate((d) => d.checklists.unshift(copy));
                      log("کپی چک‌لیست", `Checklists / ${c.name}`); toast("کپی ایجاد شد ✓", "ok");
                    }}><Icon name="layers" size={13} />کپی</button>
                    <button className="btn btn-ghost btn-sm hover:!text-[var(--nok)] mr-auto" onClick={() => {
                      mutate((d) => { d.checklists = d.checklists.filter((x) => x.id !== c.id); });
                      log("حذف چک‌لیست", `Checklists / ${c.name}`, "warning"); toast("چک‌لیست حذف شد", "info");
                    }}><Icon name="trash" size={13} />حذف</button>
                  </div>
                )}
              </div>
            );
          })}
          {db.checklists.length === 0 && <div className="md:col-span-2"><Empty icon="clipboard" title="چک‌لیستی تعریف نشده" sub="اولین چک‌لیست را بسازید" /></div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================ ویرایشگر چک‌لیست */
function Builder({ cl, isNew, onClose, onSave }: { cl: Checklist; isNew: boolean; onClose: () => void; onSave: (c: Checklist) => void }) {
  const { db } = useStore();
  const [c, setC] = useState<Checklist>(cl);
  const set = (patch: Partial<Checklist>) => setC((p) => ({ ...p, ...patch }));
  const cats: { v: SectionCategory; t: string }[] = [
    { v: "mechanical", t: "مکانیک" }, { v: "electrical", t: "برق" }, { v: "utilities", t: "تأسیسات" },
    { v: "operator", t: "اپراتوری" }, { v: "safety", t: "ایمنی" },
  ];

  const upSec = (i: number) => setC((p) => { const s = [...p.sections]; if (i > 0) [s[i - 1], s[i]] = [s[i], s[i - 1]]; return { ...p, sections: s }; });
  const dnSec = (i: number) => setC((p) => { const s = [...p.sections]; if (i < s.length - 1) [s[i + 1], s[i]] = [s[i], s[i + 1]]; return { ...p, sections: s }; });

  return (
    <div className="fade-up">
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="chevs" size={14} />بازگشت</button>
        <input className="inp flex-1 min-w-[220px] !font-bold" placeholder="نام چک‌لیست — مثلاً: کنترل روزانه CNC"
          value={c.name} onChange={(e) => set({ name: e.target.value })} />
        <button className="btn btn-acc" onClick={() => onSave(c)}><Icon name="check" size={15} />ذخیره چک‌لیست</button>
      </div>

      <div className="card p-4 mb-4 grid sm:grid-cols-3 gap-3">
        <div>
          <label className="lbl">نوع تخصیص</label>
          <div className="flex gap-2">
            {(["group", "equipment"] as const).map((s) => (
              <button key={s} onClick={() => set({ scope: s, targetId: s === "group" ? db.groups[0]?.id ?? "" : db.equipment[0]?.id ?? "" })}
                className={cx("badge !py-2 !px-3 cursor-pointer border", c.scope === s ? "b-acc" : "b-mut")}>
                {s === "group" ? "Group Checklist" : "اختصاصی تجهیز"}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="lbl">{c.scope === "group" ? "گروه هدف — برای همه تجهیزات گروه اجرا می‌شود" : "تجهیز هدف — فقط همین دستگاه"}</label>
          <select className="inp" value={c.targetId} onChange={(e) => set({ targetId: e.target.value })}>
            {c.scope === "group"
              ? db.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)
              : db.equipment.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
          </select>
          <p className="text-[10.5px] font-semibold mt-1.5" style={{ color: "var(--muted)" }}>
            💡 دو دستگاه مشابه می‌توانند چک‌لیست متفاوت داشته باشند — یک چک‌لیست اختصاصی برای یکی از آن‌ها بسازید.
          </p>
        </div>
      </div>

      {/* ---------- Sectionها ---------- */}
      <div className="space-y-4">
        {c.sections.map((sec, si) => (
          <section key={sec.id} className="card overflow-hidden">
            <header className="px-4 py-3 panel2 border-b flex flex-wrap items-center gap-2" style={{ borderColor: "var(--line)" }}>
              <input className="inp !w-auto !py-1.5 !font-bold flex-1 min-w-[140px]" value={sec.name}
                onChange={(e) => setC((p) => ({ ...p, sections: p.sections.map((s) => s.id === sec.id ? { ...s, name: e.target.value } : s) }))} />
              <select className="inp !w-auto !py-1.5 text-[12px]" value={sec.category}
                onChange={(e) => setC((p) => ({ ...p, sections: p.sections.map((s) => s.id === sec.id ? { ...s, category: e.target.value as SectionCategory } : s) }))}>
                {cats.map((x) => <option key={x.v} value={x.v}>{x.t}</option>)}
              </select>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm !px-2" onClick={() => upSec(si)} disabled={si === 0}><Icon name="chevd" size={13} className="rotate-180" /></button>
                <button className="btn btn-ghost btn-sm !px-2" onClick={() => dnSec(si)} disabled={si === c.sections.length - 1}><Icon name="chevd" size={13} /></button>
                <button className="btn btn-ghost btn-sm !px-2 hover:!text-[var(--nok)]" onClick={() => setC((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== sec.id) }))}><Icon name="trash" size={13} /></button>
              </div>
            </header>

            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {sec.items.map((it, ii) => (
                <ItemEditor key={it.id} it={it}
                  onChange={(patch) => setC((p) => ({
                    ...p, sections: p.sections.map((s) => s.id === sec.id ? { ...s, items: s.items.map((x) => x.id === it.id ? { ...x, ...patch } : x) } : s),
                  }))}
                  onDelete={() => setC((p) => ({ ...p, sections: p.sections.map((s) => s.id === sec.id ? { ...s, items: s.items.filter((x) => x.id !== it.id) } : s) }))}
                  onMove={(dir) => setC((p) => ({
                    ...p, sections: p.sections.map((s) => {
                      if (s.id !== sec.id) return s;
                      const items = [...s.items]; const j = ii + dir;
                      if (j < 0 || j >= items.length) return s;
                      [items[ii], items[j]] = [items[j], items[ii]];
                      return { ...s, items };
                    }),
                  }))}
                  first={ii === 0} last={ii === sec.items.length - 1} />
              ))}
            </div>

            <div className="p-3 flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setC((p) => ({
                ...p, sections: p.sections.map((s) => s.id === sec.id ? { ...s, items: [...s.items, { id: uid(), title: "", kind: "oknok", options: ["OK", "NOK"], required: true }] } : s),
              }))}><Icon name="plus" size={13} />آیتم OK/NOK</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setC((p) => ({
                ...p, sections: p.sections.map((s) => s.id === sec.id ? { ...s, items: [...s.items, { id: uid(), title: "", kind: "numeric", options: [], min: 0, max: 100, unit: "", decimals: 1, required: true }] } : s),
              }))}><Icon name="plus" size={13} />آیتم عددی (Numeric)</button>
            </div>
          </section>
        ))}
      </div>

      <button className="btn btn-dark w-full mt-4" onClick={() => setC((p) => ({
        ...p, sections: [...p.sections, { id: uid(), name: `بخش ${faNum(p.sections.length + 1)}`, category: "mechanical", items: [] }],
      }))}><Icon name="plus" size={15} />افزودن Section جدید</button>

      {isNew && <p className="text-[11px] font-semibold mt-3 text-center" style={{ color: "var(--muted)" }}>چک‌لیست جدید — پس از ذخیره بلافاصله برای تکنسین‌ها قابل اجراست</p>}
    </div>
  );
}

/* ---------- ویرایشگر یک آیتم ---------- */
function ItemEditor({ it, onChange, onDelete, onMove, first, last }: {
  it: ChecklistItem; onChange: (p: Partial<ChecklistItem>) => void; onDelete: () => void;
  onMove: (dir: -1 | 1) => void; first: boolean; last: boolean;
}) {
  const [newOpt, setNewOpt] = useState("");
  return (
    <div className="p-3.5 grid md:grid-cols-[1fr_auto] gap-3">
      <div className="space-y-2.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cx("badge flex-shrink-0", it.kind === "numeric" ? "b-info" : "b-ok")}>{it.kind === "numeric" ? "Numeric" : "OK / NOK"}</span>
          <input className="inp !py-1.5" placeholder="عنوان آیتم — مثلاً: فشار روغن هیدرولیک" value={it.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>

        {it.kind === "numeric" ? (
          <div className="flex flex-wrap gap-2 items-center text-[12px]">
            <label className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--muted)" }}>Min
              <input type="number" step="any" className="inp !w-20 !py-1 ltr !text-left" dir="ltr" value={it.min ?? 0} onChange={(e) => onChange({ min: +e.target.value })} /></label>
            <label className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--muted)" }}>Max
              <input type="number" step="any" className="inp !w-20 !py-1 ltr !text-left" dir="ltr" value={it.max ?? 0} onChange={(e) => onChange({ max: +e.target.value })} /></label>
            <label className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--muted)" }}>واحد
              <input className="inp !w-16 !py-1" value={it.unit ?? ""} onChange={(e) => onChange({ unit: e.target.value })} placeholder="bar" /></label>
            <label className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--muted)" }}>اعشار
              <input type="number" className="inp !w-14 !py-1 ltr !text-left" dir="ltr" value={it.decimals ?? 1} onChange={(e) => onChange({ decimals: Math.max(0, +e.target.value) })} /></label>
            <span className="badge b-acc">Range Validation فعال — خارج از محدوده = توضیح اجباری</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>گزینه‌ها (قابل توسعه):</span>
            {it.options.map((o) => (
              <span key={o} className="badge b-mut !py-1">{o}
                <button className="mr-1 opacity-60 hover:opacity-100" onClick={() => onChange({ options: it.options.filter((x) => x !== o) })}><Icon name="x" size={10} /></button>
              </span>
            ))}
            <input className="inp !w-28 !py-1 !text-[11.5px]" placeholder="گزینه جدید" value={newOpt} onChange={(e) => setNewOpt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newOpt.trim()) { onChange({ options: [...it.options, newOpt.trim()] }); setNewOpt(""); } }} />
            <button className="btn btn-ghost btn-sm !px-2" onClick={() => { if (newOpt.trim()) { onChange({ options: [...it.options, newOpt.trim()] }); setNewOpt(""); } }}><Icon name="plus" size={12} /></button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:flex-col md:justify-center">
        <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer select-none badge b-mut !py-1.5">
          <input type="checkbox" checked={it.required} onChange={(e) => onChange({ required: e.target.checked })} />الزامی
        </label>
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => onMove(-1)} disabled={first}><Icon name="chevd" size={12} className="rotate-180" /></button>
          <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => onMove(1)} disabled={last}><Icon name="chevd" size={12} /></button>
          <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-[var(--nok)]" onClick={onDelete}><Icon name="trash" size={12} /></button>
        </div>
      </div>
    </div>
  );
}
