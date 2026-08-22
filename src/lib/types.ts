/* ============================================================
   سامانه کنترل روزانه تجهیزات NIPCO — مدل داده‌ها (Types)
   ------------------------------------------------------------
   این فایل معادل Entityهای دیتابیس در نسخه Full-Stack است.
   هر Interface здесь یک جدول در ERD سیستم محسوب می‌شود:
   Users / Roles / EquipmentGroups / Equipment / Shifts /
   Checklists / DailyControls / OperatingHourHistory / ...
   در نسخه سرور، این ساختارها با ORM (مثل Prisma/EF) به
   جداول واقعی با ایندکس و کلید خارجی نگاشت می‌شوند.
   ============================================================ */

export type ID = string;

/* ---------- ماژول‌ها و دسترسی‌ها (RBAC + Permission) ---------- */
export type ModuleKey =
  | "dashboard" | "control" | "ophours" | "equipment" | "checklists"
  | "reports" | "notifications" | "logs" | "users" | "settings";

export type Perm = "view" | "create" | "edit" | "delete" | "submit" | "export" | "manage" | "approve";

export interface Role {
  id: ID;
  name: string;            // نام نقش — Dynamic و قابل ایجاد توسط مدیر
  description: string;
  permissions: Partial<Record<ModuleKey, Perm[]>>;
  system?: boolean;        // نقش‌های سیستمی قابل حذف نیستند
}

export interface User {
  id: ID;
  firstName: string;
  lastName: string;
  personnelCode: string;
  username: string;
  passHash: string;        // هرگز Plain Text ذخیره نمی‌شود — در سرور: bcrypt/Argon2
  mobile: string;
  email: string;
  department: string;
  position: string;
  roleId: ID;
  shiftId: ID;
  active: boolean;
  deleted?: boolean;       // حذف نرم (Soft Delete)
  sectionScope?: string[] | null; // محدودیت سطح Section — مثال: فقط electrical
  tempPass?: string;       // رمز موقت پس از Reset توسط مدیر
}

/* ---------- ساختار محل: Company → Hall → Line → Area ---------- */
export interface LocationNode { id: ID; hall: string; line: string; area: string; }

export interface EquipmentGroup { id: ID; name: string; icon: string; active: boolean; }

export type OHSource = "manual" | "plc" | "hmi" | "opcua" | "modbus-tcp" | "modbus-rtu" | "api" | "gateway";

export interface DeviceConfig {
  enabled: boolean;          // Enabled / Disabled
  protocol: OHSource;
  ip?: string; port?: number; deviceId?: string; plcAddress?: string;
  register?: string; dataType?: string; scaling?: number;
  pollingSec: number; timeoutMs: number; retryCount: number;
}

export type EquipmentStatus = "active" | "idle" | "maintenance" | "inactive";

export interface Equipment {
  id: ID;
  code: string;              // کد یکتا — همان چیزی که در QR کدگذاری می‌شود
  name: string;
  groupId: ID;
  type: string;
  brand: string;
  model: string;
  serial: string;
  capacity: string;
  locationId: ID;
  status: EquipmentStatus;
  commissionDate: string;
  description: string;
  device: DeviceConfig;      // تنظیمات ارتباط با دستگاه برای خواندن ساعت کارکرد
}

/* ---------- شیفت‌ها (Dynamic — بدون Hard-Code) ---------- */
export interface Shift { id: ID; name: string; start: string; end: string; active: boolean; }

/* ---------- چک‌لیست‌ها (Checklist Builder) ---------- */
export type FieldKind = "oknok" | "numeric";
// معماری برای توسعه آینده: text / dropdown / checkbox / date / photo / signature

export interface ChecklistItem {
  id: ID;
  title: string;
  kind: FieldKind;
  options: string[];         // گزینه‌های OK/NOK — قابل افزودن گزینه جدید بدون کدنویسی
  min?: number; max?: number; unit?: string; decimals?: number;
  required: boolean;
}

export type SectionCategory = "mechanical" | "electrical" | "utilities" | "operator" | "safety";

export interface ChecklistSection { id: ID; name: string; category: SectionCategory; items: ChecklistItem[]; }

export interface Checklist {
  id: ID;
  name: string;
  scope: "group" | "equipment";   // Group Checklist یا Equipment Specific
  targetId: ID;                    // groupId یا equipmentId
  active: boolean;
  sections: ChecklistSection[];
}

/* ---------- محل خرابی (Dynamic) ---------- */
export interface FailureLocation { id: ID; name: string; }

/* ---------- کنترل روزانه ---------- */
export type ItemResult = "ok" | "nok" | "in-range" | "out-of-range";

export interface ControlAnswer {
  itemId: ID;
  value: string;             // مقدار خام (OK/NOK یا عدد)
  result: ItemResult;
  description: string;       // در صورت NOK / Out of Range اجباری است
  failureLocationId?: ID;
}

export interface DailyControl {
  id: ID;                    // شناسه یکتای سمت کلاینت — برای جلوگیری از ثبت تکراری هنگام Sync
  equipmentId: ID;
  checklistId: ID;
  userId: ID;
  shiftId: ID;
  date: string;              // تاریخ شمسی (yyyy/mm/dd) — جداسازی اطلاعات سالانه
  startedAt: string;         // ISO
  submittedAt?: string;
  status: "draft" | "submitted" | "queued";
  answers: ControlAnswer[];
  oh?: { value: number; source: "auto" | "manual"; previous: number };
  nokCount: number;
  oorCount: number;
  pendingSync?: boolean;     // در صف Sync آفلاین بوده است
}

/* ---------- ساعت کارکرد ----------
   ⚠️ نوع number در JS معادل DECIMAL(18,4) در دیتابیس در نظر گرفته شود.
   هیچ سقف مصنوعی (9999/99999) وجود ندارد — برای دهه‌ها کارکرد کافی است. */
export interface OHRecord {
  id: ID;
  equipmentId: ID;
  date: string;              // تاریخ شمسی
  time: string;              // HH:MM:SS
  shiftId: ID;
  previous: number;
  value: number;
  diff: number;
  source: "auto" | "manual" | "adjusted";
  protocol?: OHSource;
  userId: ID;
  reason?: string;           // دلیل اصلاح — فقط در Adjustment
}

export type ConnState = "connected" | "disconnected" | "timeout" | "error" | "unknown";

export interface DeviceState {
  equipmentId: ID;
  current: number;           // ساعت کارکرد جاری — بدون سقف
  lastRead?: string;         // ISO زمان آخرین خواندن
  connection: ConnState;
}

/* ---------- اعلان‌ها ---------- */
export type NotifType = "nok" | "failure" | "oor" | "overdue" | "backup" | "system";
export interface Notification {
  id: ID; type: NotifType; title: string; body: string;
  at: string; read: boolean; email?: boolean; sms?: boolean;
}

/* ---------- لاگ فعالیت‌ها ---------- */
export interface ActivityLog {
  id: ID; userId: ID; username: string;
  action: string; entity: string; recordId?: ID;
  result: "success" | "failed" | "warning";
  at: string; ip: string;
}

/* ---------- صف آفلاین (Offline Queue + Sync) ---------- */
export interface QueueItem {
  id: ID;
  kind: "control" | "oh";
  payload: DailyControl | OHRecord;
  createdAt: string;
  status: "pending" | "syncing" | "synced" | "error";
  attempts: number;
}

/* ---------- تنظیمات سراسری ---------- */
export interface Settings {
  theme: "light" | "dark" | "industrial";
  accent: string;
  sessionTimeoutMin: number;
  gatewayPollSec: number;     // بازه خواندن خودکار ساعت کارکرد از Gateway
  gatewayEnabled: boolean;
  autoBackup: "off" | "daily" | "weekly" | "monthly";
  logoDataUrl: string | null;       // لوگوی آپلودی — Hard-Code نیست
  loginLogoDataUrl: string | null;
  operationalYear: number;          // مثال: 1405
  notifRules: { nokEmail: boolean; nokSms: boolean; overdueEmail: boolean; failureSms: boolean };
  dashLayout: Record<string, boolean>;
}

/* ---------- پایگاه داده محلی (معادل دیتابیس سرور) ---------- */
export interface DB {
  v: number;
  users: User[];
  roles: Role[];
  groups: EquipmentGroup[];
  locations: LocationNode[];
  equipment: Equipment[];
  shifts: Shift[];
  checklists: Checklist[];
  failureLocations: FailureLocation[];
  controls: DailyControl[];
  ohHistory: OHRecord[];
  deviceState: DeviceState[];
  notifications: Notification[];
  logs: ActivityLog[];
  queue: QueueItem[];
  settings: Settings;
  archives: { year: number; at: string; size: number }[];
}

export interface Session { userId: ID; at: number; remember: boolean; }
