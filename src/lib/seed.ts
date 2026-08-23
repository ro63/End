/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — داده‌های اولیه (Seed)
   ------------------------------------------------------------
   این داده‌ها فقط برای راه‌اندازی اولیه دیتابیس هستند و هیچ
   Business Logic در آن‌ها Hard-Code نشده؛ مدیر همه‌چیز را از
   پنل مدیریت می‌سازد/ویرایش می‌کند. در نسخه سرور، این فایل
   معادل Migration + Seeder است.
   ============================================================ */

import type {
  DB, Role, User, EquipmentGroup, LocationNode, Equipment, Shift, Checklist,
  FailureLocation, DailyControl, OHRecord, DeviceState, Notification, ActivityLog,
  ChecklistItem, ControlAnswer,
} from "./types";
import { hashPw, mulberry, pdShift, uid, faDigits } from "./utils";

/* ---------- نقش‌ها و ماتریس دسترسی اولیه ---------- */
const roles: Role[] = [
  {
    id: "r-admin", name: "مدیر سیستم", description: "دسترسی کامل به همه ماژول‌ها", system: true,
    permissions: {
      dashboard: ["manage"], control: ["manage"], ophours: ["manage"], equipment: ["manage"],
      checklists: ["manage"], reports: ["manage"], notifications: ["manage"], logs: ["manage"],
      users: ["manage"], settings: ["manage"],
    },
  },
  {
    id: "r-sup", name: "سرپرست نت", description: "نظارت کامل، ویرایش تجهیزات و چک‌لیست‌ها، گزارش‌گیری", system: true,
    permissions: {
      dashboard: ["view"], control: ["view", "create", "submit"], ophours: ["view", "create", "edit"],
      equipment: ["view", "create", "edit"], checklists: ["view", "create", "edit"],
      reports: ["view", "export"], notifications: ["view"], logs: ["view"], users: ["view"],
    },
  },
  {
    id: "r-tech", name: "تکنسین", description: "اجرای کنترل روزانه و ثبت ساعت کارکرد دستی", system: true,
    permissions: {
      dashboard: ["view"], control: ["view", "create", "submit"], ophours: ["view", "create"],
      equipment: ["view"], checklists: ["view"], reports: ["view"], notifications: ["view"],
    },
  },
  {
    id: "r-viewer", name: "ناظر (فقط مشاهده)", description: "مشاهده داشبورد و گزارش‌ها بدون ثبت", system: true,
    permissions: { dashboard: ["view"], control: ["view"], reports: ["view", "export"], notifications: ["view"] },
  },
];

/* ---------- کاربران اولیه — فقط Seed، بعداً از پنل مدیریت می‌شوند ---------- */
function mkUser(u: Omit<User, "passHash"> & { pw: string }): User {
  const { pw, ...rest } = u;
  return { ...rest, passHash: hashPw(rest.username, pw) };
}
const users: User[] = [
  mkUser({ id: "u-admin", firstName: "محمد", lastName: "روشندل", personnelCode: "1001", username: "admin", pw: "admin1405", mobile: "0912-3456789", email: "admin@nipco.ir", department: "فناوری اطلاعات", position: "طراح و تحلیلگر سیستم", roleId: "r-admin", shiftId: "sh1", active: true, sectionScope: null, pw_: undefined as never } as never),
  mkUser({ id: "u-takhti", firstName: "جعفر", lastName: "تختی", personnelCode: "1002", username: "takhti", pw: "123456", mobile: "0912-1112233", email: "takhti@nipco.ir", department: "نت", position: "سرپرست نگهداری و تعمیرات", roleId: "r-sup", shiftId: "sh1", active: true, sectionScope: null } as never),
  mkUser({ id: "u-esf", firstName: "مهندس", lastName: "اسفندیاری", personnelCode: "1003", username: "esfandiyari", pw: "123456", mobile: "0912-4445566", email: "esf@nipco.ir", department: "برق", position: "تکنسین برق", roleId: "r-tech", shiftId: "sh2", active: true, sectionScope: ["electrical"] } as never),
  mkUser({ id: "u-fardin", firstName: "فردین", lastName: "عظمیان", personnelCode: "1004", username: "fardin", pw: "123456", mobile: "0912-7778899", email: "fardin@nipco.ir", department: "مکانیک", position: "تکنسین مکانیک", roleId: "r-tech", shiftId: "sh1", active: true, sectionScope: null } as never),
  mkUser({ id: "u-viewer", firstName: "بازرس", lastName: "کیفیت", personnelCode: "1005", username: "viewer", pw: "123456", mobile: "0912-0001122", email: "qa@nipco.ir", department: "کنترل کیفیت", position: "کارشناس QA", roleId: "r-viewer", shiftId: "sh1", active: true, sectionScope: null } as never),
];

/* ---------- شیفت‌ها — Dynamic، از تنظیمات قابل تغییر ----------
   ⚠️ شیفت ۳ (شب) از مرز روز عبور می‌کند و در utils مدیریت می‌شود. */
const shifts: Shift[] = [
  { id: "sh1", name: "شیفت ۱ (صبح)", start: "06:00", end: "14:00", active: true },
  { id: "sh2", name: "شیفت ۲ (عصر)", start: "14:00", end: "22:00", active: true },
  { id: "sh3", name: "شیفت ۳ (شب)", start: "22:00", end: "06:00", active: true },
];

/* ---------- گروه‌های تجهیزات ---------- */
const groups: EquipmentGroup[] = [
  { id: "g-press", name: "پرس هیدرولیک", icon: "press", active: true },
  { id: "g-robot", name: "ربات ABB", icon: "robot", active: true },
  { id: "g-comp", name: "کمپرسور اسکرو", icon: "compressor", active: true },
  { id: "g-fork", name: "لیفتراک", icon: "forklift", active: true },
  { id: "g-boiler", name: "موتورخانه", icon: "boiler", active: true },
  { id: "g-elec", name: "برق", icon: "zap", active: true },
  { id: "g-util", name: "تأسیسات", icon: "fan", active: true },
  { id: "g-other", name: "سایر", icon: "box", active: true },
];

/* ---------- ساختار محل: Hall → Line → Area ---------- */
const locations: LocationNode[] = [
  { id: "l1", hall: "سالن ۱", line: "خط پرس", area: "ناحیه A" },
  { id: "l2", hall: "سالن ۱", line: "خط پرس", area: "ناحیه B" },
  { id: "l3", hall: "سالن ۱", line: "خط ربات", area: "ایستگاه جوشکاری" },
  { id: "l4", hall: "سالن ۲", line: "خط مونتاژ", area: "ناحیه C" },
  { id: "l5", hall: "محوطه", line: "انبار", area: "محوطه بارگیری" },
  { id: "l6", hall: "ساختمان مرکزی", line: "موتورخانه", area: "تأسیسات" },
  { id: "l7", hall: "ساختمان مرکزی", line: "پست برق", area: "ترانس اصلی" },
  { id: "l8", hall: "سالن ۲", line: "اتاق کمپرسور", area: "هوای فشرده" },
];

/* ---------- تجهیزات اولیه ----------
   ⚠️ مطابق صورت‌مسئله، «پرس شماره ۶» عمداً در این نسخه اضافه نشده است. */
const dev = (protocol: Equipment["device"]["protocol"], enabled = true, ip = "192.168.1."): Equipment["device"] => ({
  enabled, protocol, ip: ip + (10 + Math.floor(Math.random() * 80)), port: protocol === "opcua" ? 4840 : 502,
  deviceId: "D-" + Math.floor(Math.random() * 90 + 10), register: "HR40001", dataType: "Float32",
  scaling: 1, pollingSec: 60, timeoutMs: 3000, retryCount: 3,
});
/* تجهیزات بدون ارتباط صنعتی — ثبت ساعت کارکرد فقط دستی */
const devManual = (): Equipment["device"] => ({ enabled: false, protocol: "manual", pollingSec: 60, timeoutMs: 3000, retryCount: 3 });

const equipments: Equipment[] = [
  ...[
    ["PRS-1000", "پرس هیدرولیک ۱۰۰۰ تن", "Schuler", "HP-1000", "SN-8801", "۱۰۰۰ تن", "l1", 12595.4],
    ["PRS-1200", "پرس هیدرولیک ۱۲۰۰ تن", "Schuler", "HP-1200", "SN-8802", "۱۲۰۰ تن", "l1", 9842.7],
    ["PRS-1500", "پرس هیدرولیک ۱۵۰۰ تن", "AIDA", "HP-1500", "SN-7201", "۱۵۰۰ تن", "l2", 15208.9],
    ["PRS-2000", "پرس هیدرولیک ۲۰۰۰ تن", "AIDA", "HP-2000", "SN-7202", "۲۰۰۰ تن", "l2", 20113.2],
    ["PRS-1200A", "پرس هیدرولیک ۱۲۰۰ تن عابدی", "Abedi", "AP-1200", "SN-3301", "۱۲۰۰ تن", "l2", 6480.5],
  ].map(([code, name, brand, model, serial, capacity, loc, oh], i) => ({
    id: "eq-p" + i, code: code as string, name: name as string, groupId: "g-press", type: "پرس هیدرولیک",
    brand: brand as string, model: model as string, serial: serial as string, capacity: capacity as string,
    locationId: loc as string, status: "active" as const, commissionDate: "1398/04/12", description: "پرس ضربتی خط بدنه",
    device: dev(i % 2 ? "opcua" : "plc"),
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    id: "eq-r" + i, code: `ABB-${String(i + 1).padStart(2, "0")}`, name: `ربات جوشکاری ABB-${String(i + 1).padStart(2, "0")}`,
    groupId: "g-robot", type: "ربات صنعتی", brand: "ABB", model: "IRB 6700", serial: `ABB${6700 + i}`,
    capacity: "235kg / 2.65m", locationId: "l3", status: (i === 4 ? "maintenance" : "active") as Equipment["status"],
    commissionDate: "1400/02/01", description: "ربات جوشکاری نقطه‌ای",
    device: dev("opcua", i !== 4, "192.168.2."),
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: "eq-c" + i, code: `CMP-${String(i + 1).padStart(2, "0")}`, name: `کمپرسور اسکرو ${faDigits(i + 1)}`,
    groupId: "g-comp", type: "کمپرسور هوا", brand: "Atlas Copco", model: i < 2 ? "GA 75 VSD" : "GA 55",
    serial: `AC-55${i}0`, capacity: i < 2 ? "75kW" : "55kW", locationId: "l8", status: "active" as const,
    commissionDate: "1399/08/20", description: "تأمین هوای فشرده سالن‌ها",
    device: dev("modbus-tcp", true, "192.168.3."),
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: "eq-f" + i, code: `LFT-${String(i + 1).padStart(2, "0")}`, name: `لیفتراک ${faDigits(i + 1)}`,
    groupId: "g-fork", type: "لیفتراک برقی", brand: "Toyota", model: "8FBE15", serial: `TY${1500 + i}`,
    capacity: "1.5 تن", locationId: "l5", status: (i === 2 ? "idle" : "active") as Equipment["status"],
    commissionDate: "1401/01/15", description: "جابجایی پالت در انبار",
    device: devManual(),
  })),
  {
    id: "eq-b0", code: "BLR-01", name: "بویلر بخار موتورخانه", groupId: "g-boiler", type: "بویلر", brand: "MIURA", model: "SZL-2000",
    serial: "MR-2001", capacity: "۲ تن بخار", locationId: "l6", status: "active", commissionDate: "1396/11/02",
    description: "تولید بخار گرمایش و فرآیند", device: dev("modbus-rtu", true, "192.168.4."),
  },
  {
    id: "eq-b1", code: "CHL-01", name: "چیلر تراکمی موتورخانه", groupId: "g-boiler", type: "چیلر", brand: "Carrier", model: "30XA-402",
    serial: "CR-4021", capacity: "400kW", locationId: "l6", status: "active", commissionDate: "1397/03/10",
    description: "سرمایش آب فرآیند", device: dev("plc", true, "192.168.4."),
  },
  {
    id: "eq-e0", code: "TRF-01", name: "ترانسفورماتور اصلی", groupId: "g-elec", type: "ترانسفورماتور", brand: "پارس ترانس", model: "2MVA-20KV",
    serial: "PT-2001", capacity: "2MVA", locationId: "l7", status: "active", commissionDate: "1395/06/01",
    description: "تغذیه اصلی پست برق کارخانه", device: devManual(),
  },
  {
    id: "eq-u0", code: "AHU-01", name: "هواساز سالن مونتاژ", groupId: "g-util", type: "هواساز", brand: "Sarma System", model: "AHU-25",
    serial: "SS-2501", capacity: "25000 CFM", locationId: "l4", status: "active", commissionDate: "1400/09/05",
    description: "تهویه و فیلتراسیون سالن ۲", device: devManual(),
  },
  {
    id: "eq-o0", code: "CRN-01", name: "جرثقیل سقفی سالن ۲", groupId: "g-other", type: "جرثقیل", brand: "DEMAG", model: "DK-10T",
    serial: "DM-1001", capacity: "10 تن", locationId: "l4", status: "active", commissionDate: "1398/01/20",
    description: "جابجایی قالب و تجهیزات", device: devManual(),
  },
];

/* ---------- محل‌های خرابی (Dynamic) ---------- */
const failureLocations: FailureLocation[] = [
  "موتور", "پمپ", "تابلو برق", "سنسور", "شیر برقی", "یونیت هیدرولیک",
  "سیستم ایمنی", "سیستم خنک‌کاری", "گیربکس", "سایر",
].map((name, i) => ({ id: "fl" + i, name }));

/* ---------- آیتم‌ساز چک‌لیست ---------- */
let itemSeq = 0;
const okNok = (title: string, required = true): ChecklistItem =>
  ({ id: "it" + ++itemSeq, title, kind: "oknok", options: ["OK", "NOK"], required });
const num = (title: string, min: number, max: number, unit: string, decimals = 1): ChecklistItem =>
  ({ id: "it" + ++itemSeq, title, kind: "numeric", options: [], min, max, unit, decimals, required: true });

/* ---------- چک‌لیست‌های اولیه — همه Dynamic و از Builder قابل ویرایش ---------- */
const checklists: Checklist[] = [
  {
    id: "cl-press", name: "کنترل روزانه پرس هیدرولیک", scope: "group", targetId: "g-press", active: true,
    sections: [
      { id: "s-p1", name: "هیدرولیک و مکانیک", category: "mechanical", items: [
        num("فشار روغن هیدرولیک", 100, 150, "bar"),
        num("دمای روغن هیدرولیک", 20, 60, "°C"),
        num("سطح روغن مخزن", 60, 100, "%"),
        okNok("نشتی روغن غیرعادی مشاهده نشد"),
      ]},
      { id: "s-p2", name: "برق و کنترل", category: "electrical", items: [
        num("ولتاژ اصلی تابلو", 370, 430, "V", 0),
        num("جریان موتور اصلی", 20, 85, "A", 1),
        okNok("چراغ‌های سیگنال تابلو سالم"),
      ]},
      { id: "s-p3", name: "ایمنی", category: "safety", items: [
        okNok("دکمه توقف اضطراری عملکرد صحیح دارد"),
        okNok("پرده نوری ایمنی فعال است"),
        okNok("حفاظ‌ها و سوپاپ‌های ایمنی سالم"),
      ]},
      { id: "s-p4", name: "اپراتوری", category: "operator", items: [
        okNok("صدای غیرعادی از پرس شنیده نشد"),
        okNok("کلاچ و ترمز عملکرد عادی دارند"),
      ]},
    ],
  },
  {
    id: "cl-robot", name: "کنترل روزانه ربات ABB", scope: "group", targetId: "g-robot", active: true,
    sections: [
      { id: "s-r1", name: "مکانیک", category: "mechanical", items: [
        okNok("نشتی روغن گیربکس محورها مشاهده نشد"),
        okNok("حرکت محورها روان و بدون لرزش"),
      ]},
      { id: "s-r2", name: "برق و کنترلر", category: "electrical", items: [
        num("ولتاژ تغذیه کنترلر", 200, 240, "V", 0),
        num("ولتاژ باتری بکاپ", 24, 29, "V", 1),
        okNok("کابل‌ها و کانکتورها سالم"),
      ]},
      { id: "s-r3", name: "تأسیسات", category: "utilities", items: [ num("فشار هوای فشرده ورودی", 5.5, 7, "bar") ]},
      { id: "s-r4", name: "ایمنی", category: "safety", items: [
        okNok("توقف اضطراری ربات عملکرد صحیح دارد"),
        okNok("اینترلاک درب حفاظ فعال است"),
      ]},
    ],
  },
  {
    id: "cl-comp", name: "کنترل روزانه کمپرسور اسکرو", scope: "group", targetId: "g-comp", active: true,
    sections: [
      { id: "s-c1", name: "مکانیک و هوا", category: "mechanical", items: [
        num("فشار هوای خروجی", 6, 8.5, "bar"),
        num("دمای هوای فشرده خروجی", 70, 98, "°C", 0),
        num("اختلاف فشار فیلتر روغن", 0.5, 3, "bar"),
        okNok("سطح روغن در محدوده مجاز است"),
      ]},
      { id: "s-c2", name: "برق", category: "electrical", items: [ num("جریان موتور", 30, 115, "A", 1) ]},
      { id: "s-c3", name: "تأسیسات", category: "utilities", items: [
        okNok("درین اتوماتیک رطوبت‌گیر کار می‌کند"),
        okNok("فن خنک‌کاری و جریان هوا عادی"),
      ]},
      { id: "s-c4", name: "ایمنی", category: "safety", items: [ okNok("سوپاپ اطمینان و آلارم‌ها سالم") ]},
    ],
  },
  {
    id: "cl-fork", name: "کنترل روزانه لیفتراک", scope: "group", targetId: "g-fork", active: true,
    sections: [
      { id: "s-f1", name: "اپراتوری و مکانیک", category: "operator", items: [
        okNok("شاخک‌ها و زنجیر بالابر سالم"),
        okNok("ترمز و فرمان عملکرد صحیح دارند"),
        okNok("بوق، چراغ‌ها و آینه‌ها سالم"),
        okNok("نشتی روغن هیدرولیک مشاهده نشد"),
      ]},
      { id: "s-f2", name: "تأسیسات", category: "utilities", items: [ num("شارژ باطری", 20, 100, "%", 0) ]},
      { id: "s-f3", name: "ایمنی", category: "safety", items: [ okNok("حفاظ بالای اپراتور (Overhead Guard) سالم") ]},
    ],
  },
  {
    id: "cl-boiler", name: "کنترل روزانه موتورخانه", scope: "group", targetId: "g-boiler", active: true,
    sections: [
      { id: "s-b1", name: "مکانیک", category: "mechanical", items: [
        num("فشار بخار بویلر", 4, 7, "bar"),
        num("دمای آب مدار", 50, 88, "°C", 0),
        okNok("پمپ‌های سیرکولاتور عملکرد عادی"),
      ]},
      { id: "s-b2", name: "تأسیسات", category: "utilities", items: [ num("فشار گاز ورودی مشعل", 0.3, 2, "bar") ]},
      { id: "s-b3", name: "ایمنی", category: "safety", items: [ okNok("سوپاپ اطمینان و پرشرسوئیچ‌ها سالم") ]},
    ],
  },
  {
    id: "cl-press2000", name: "بازدید ویژه پرس ۲۰۰۰ تن — کوشن", scope: "equipment", targetId: "eq-p3", active: true,
    sections: [
      { id: "s-x1", name: "سیستم کوشن", category: "mechanical", items: [
        num("فشار کوشن", 20, 40, "bar"),
        num("کورس کوشن", 40, 60, "mm", 0),
        okNok("نشتی سیلندر کوشن مشاهده نشد"),
      ]},
    ],
  },
];

/* ---------- تولید تاریخچه ۷ روز اخیر (کنترل‌ها + ساعت کارکرد) ----------
   با RNG قطعی تا در هر بار Seed اولیه، داده‌های باثبات تولید شود. */
function genHistory() {
  const r = mulberry(1405);
  const controls: DailyControl[] = [];
  const ohHistory: OHRecord[] = [];
  const techs = ["u-fardin", "u-esf", "u-takhti"];
  const nokDescs = [
    "صدای غیرعادی از یاتاقان شنیده می‌شود — نیاز به بررسی در شیفت بعد",
    "نشتی جزئی روغن از شلنگ فشار قوی مشاهده شد",
    "سنسور فشار گاهی قطع و وصل می‌شود",
    "لرزش غیرعادی در شروع حرکت محورها",
    "چراغ سیگنال تابلو سوخته است",
  ];
  const baseOH: Record<string, number> = {};
  equipments.forEach((e) => {
    const found = (equipments.find((x) => x.id === e.id) as Equipment & { _oh?: number });
    baseOH[e.id] = e.device.enabled ? 5000 + r() * 16000 : 800 + r() * 4000;
    void found;
  });
  // مقدار جاری هر تجهیز
  const deviceState: DeviceState[] = equipments.map((e) => ({
    equipmentId: e.id, current: Math.round(baseOH[e.id] * 10) / 10,
    lastRead: e.device.enabled ? new Date(Date.now() - r() * 300000).toISOString() : undefined,
    connection: e.device.enabled ? "connected" : "disconnected",
  }));

  const mainEq = equipments.filter((e) => ["g-press", "g-robot", "g-comp", "g-boiler"].includes(e.groupId) && e.status !== "maintenance");
  for (let day = 7; day >= 1; day--) {
    const date = pdShift(new Date(), -day);
    for (const eq of mainEq) {
      if (r() < 0.15) continue; // گاهی کنترلی انجام نشده
      const cl = checklists.find((c) => c.scope === "group" && c.targetId === eq.groupId)!;
      const userId = techs[Math.floor(r() * techs.length)];
      const answers: ControlAnswer[] = [];
      let nokCount = 0, oorCount = 0;
      for (const sec of cl.sections) for (const it of sec.items) {
        const roll = r();
        if (it.kind === "numeric") {
          const span = (it.max! - it.min!) || 1;
          let v = it.min! + span * (0.25 + r() * 0.5);
          let res: ControlAnswer["result"] = "in-range";
          let desc = "";
          if (roll < 0.05) { v = it.max! + span * (0.1 + r() * 0.2); res = "out-of-range"; desc = "مقدار خارج از محدوده — " + nokDescs[Math.floor(r() * nokDescs.length)]; oorCount++; }
          answers.push({ itemId: it.id, value: String(Math.round(v * 10) / 10), result: res, description: desc });
        } else {
          const nok = roll < 0.06;
          if (nok) nokCount++;
          answers.push({
            itemId: it.id, value: nok ? "NOK" : "OK", result: nok ? "nok" : "ok",
            description: nok ? nokDescs[Math.floor(r() * nokDescs.length)] : "",
            failureLocationId: nok && r() < 0.8 ? failureLocations[Math.floor(r() * failureLocations.length)].id : undefined,
          });
        }
      }
      const prev = baseOH[eq.id];
      const cur = Math.round((prev + 6.5 + r() * 3) * 10) / 10;
      baseOH[eq.id] = cur;
      const submittedAt = new Date(); submittedAt.setDate(submittedAt.getDate() - day); submittedAt.setHours(7 + Math.floor(r() * 3), Math.floor(r() * 60), 0, 0);
      controls.push({
        id: uid(), equipmentId: eq.id, checklistId: cl.id, userId, shiftId: "sh1", date,
        startedAt: new Date(submittedAt.getTime() - 600000).toISOString(), submittedAt: submittedAt.toISOString(),
        status: "submitted", answers, nokCount, oorCount,
        oh: { value: cur, source: eq.device.enabled ? "auto" : "manual", previous: prev },
      });
      ohHistory.push({
        id: uid(), equipmentId: eq.id, date, time: "07:4" + Math.floor(r() * 9) + ":00", shiftId: "sh1",
        previous: prev, value: cur, diff: Math.round((cur - prev) * 10) / 10,
        source: eq.device.enabled ? "auto" : "manual", protocol: eq.device.protocol, userId,
      });
      const ds = deviceState.find((d) => d.equipmentId === eq.id)!;
      ds.current = cur;
    }
  }
  // چند رکورد اصلاح ساعت کارکرد برای نمایش Adjustment
  ohHistory.push({
    id: uid(), equipmentId: "eq-c1", date: pdShift(new Date(), -2), time: "15:20:00", shiftId: "sh2",
    previous: baseOH["eq-c1"], value: Math.round((baseOH["eq-c1"] - 12.5) * 10) / 10, diff: -12.5,
    source: "adjusted", protocol: "plc", userId: "u-admin", reason: "تعویض کنترلر و ریست شمارنده ساعت کارکرد",
  });
  return { controls, ohHistory, deviceState, baseOH };
}

/* ---------- اعلان‌ها و لاگ‌های اولیه ---------- */
function genNotifs(): Notification[] {
  const now = Date.now();
  return [
    { id: uid(), type: "nok", title: "ثبت NOK در پرس هیدرولیک ۱۵۰۰ تن", body: "نشتی جزئی روغن از شلنگ فشار قوی — ثبت‌شده توسط فردین عظمیان", at: new Date(now - 3600e3 * 3).toISOString(), read: false, email: true },
    { id: uid(), type: "oor", title: "مقدار خارج از محدوده — کمپرسور ۲", body: "فشار هوای خروجی ۹٫۲ bar (محدوده مجاز: ۶ تا ۸٫۵)", at: new Date(now - 3600e3 * 7).toISOString(), read: false },
    { id: uid(), type: "overdue", title: "کنترل انجام‌نشده — ربات ABB-05", body: "تجهیز در وضعیت تعمیرات است؛ کنترل روزانه امروز ثبت نشده", at: new Date(now - 3600e3 * 20).toISOString(), read: true },
    { id: uid(), type: "backup", title: "پشتیبان‌گیری خودکار انجام شد", body: "پشتیبان Daily با موفقیت ذخیره شد (۲٫۴MB)", at: new Date(now - 3600e3 * 14).toISOString(), read: true },
    { id: uid(), type: "system", title: "خوش آمدید", body: "سامانه کنترل روزانه تجهیزات NIPCO نسخه ۱٫۰ آماده بهره‌برداری است.", at: new Date(now - 3600e3 * 48).toISOString(), read: true },
  ];
}
function genLogs(): ActivityLog[] {
  const now = Date.now();
  const mk = (h: number, username: string, action: string, entity: string, result: ActivityLog["result"] = "success"): ActivityLog =>
    ({ id: uid(), userId: "", username, action, entity, result, at: new Date(now - h * 3600e3).toISOString(), ip: "192.168.1." + (20 + Math.floor(h) % 40) });
  return [
    mk(1.2, "fardin", "ثبت کنترل روزانه", "DailyControl / PRS-1500"),
    mk(3, "esfandiyari", "ثبت ساعت کارکرد دستی", "OperatingHours / CMP-03"),
    mk(5, "admin", "تغییر تنظیمات سامانه", "Settings / Polling"),
    mk(8, "takhti", "ورود به سامانه", "Auth"),
    mk(9, "unknown", "تلاش ناموفق ورود", "Auth / takhti", "failed"),
    mk(26, "admin", "اصلاح ساعت کارکرد", "OperatingHours / CMP-01 — تعویض کنترلر", "warning"),
  ];
}

/* ---------- ساخت پایگاه داده اولیه ---------- */
export function makeSeed(): DB {
  const hist = genHistory();
  return {
    v: 3,
    users, roles, groups, locations, equipment: equipments, shifts, checklists, failureLocations,
    controls: hist.controls, ohHistory: hist.ohHistory, deviceState: hist.deviceState,
    notifications: genNotifs(), logs: genLogs(), queue: [],
    archives: [],
    settings: {
      theme: "light", accent: "#e8590c", sessionTimeoutMin: 120, gatewayPollSec: 30, gatewayEnabled: true,
      autoBackup: "daily", logoDataUrl: null, loginLogoDataUrl: null, reportLogoDataUrl: null,
      brandNameFa: "نیپکو | قطعه‌سازی خودرو", brandNameEn: "NIPCO", tagline: "سامانه کنترل و بازدید روزانه تجهیزات",
      loginBg: "image", cardRadius: 14, density: "comfortable", operationalYear: 1405,
      notifRules: { nokEmail: true, nokSms: false, overdueEmail: true, failureSms: true },
      dashLayout: { completion: true, trend: true, shift: true, ohTop: true, activity: true, notifs: true },
    },
  };
}
