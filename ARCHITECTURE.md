# معماری سامانه — NIPCO DECS

## ۱) معماری سیستم (لایه‌ها)

```
┌─────────────┐   ┌──────────────────────┐   ┌───────────────────────┐
│ Tablet/Phone │──▶│  NIPCO Backend (API)  │──▶│  PostgreSQL (ERD زیر) │
└─────────────┘   └──────────┬───────────┘   └───────────────────────┘
       ▲                     │ JWT + RBAC Middleware
       │ PWA/Offline Queue   ▼
       │            ┌────────────────────┐
       └────────────│ Industrial Gateway │◀── PLC / HMI / OPC UA / Modbus
                    └────────────────────┘
```
ارتباط مستقیم مرورگر با PLC **ممنوع** است؛ Gateway یک Edge Service مستقل و Modular است (افزودن پروتکل جدید بدون تغییر هسته).

## ۲) ERD (خلاصه Entityها — معادل `src/lib/types.ts`)

```
Users ──< DailyControls >── Equipment ──< OperatingHourHistory
  │            │                │                 │
Roles          Checklist        EquipmentGroups   Source(Auto/Manual/Adjusted)
Permissions    Sections>Items   Locations(Hall/Line/Area)
Shifts         FailureLocations DeviceConfig(protocol/ip/register/polling)
Notifications  ActivityLogs     OfflineQueue / SyncLogs / Archives
```
نوع ساعت کارکرد: **DECIMAL(18,4)** — بدون سقف مصنوعی.

## ۳) قرارداد API (نمونه — نسخه سرور: `/api/v1`)

| Method | Endpoint | شرح |
|---|---|---|
| POST | /auth/login | ورود (Rate-Limited, bcrypt) |
| GET/POST | /equipment, /groups, /locations | CRUD تجهیزات |
| GET/POST/PUT | /checklists | Builder |
| POST | /daily-controls | ثبت کنترل (Duplicate-Key = id کلاینت) |
| POST | /operating-hours | ثبت/اصلاح (Adjustment نیازمند Approve) |
| GET | /reports/controls?from&to&shift&group&result | گزارش ترکیبی |
| POST | /sync/batch | Sync صف آفلاین (idempotent) |

## ۴) ماتریس Permission (RBAC + PBAC)

ماژول‌ها: dashboard, control, ophours, equipment, checklists, reports, notifications, logs, users, settings
دسترسی‌ها: **View / Create / Edit / Delete / Submit / Export / Manage / Approve**
سطح چهارم: **Section Scope** — مثال: کاربر گروه برق فقط Sectionهای `electrical` را ثبت می‌کند (بقیه فقط مشاهده). بررسی در Backend (Middleware) و Frontend هر دو انجام می‌شود.

## ۵) Offline & Sync

1. تشخیص `online/offline` مرورگر + سوئیچ شبیه‌سازی در Header
2. Submit آفلاین → ذخیره محلی با `status=queued` + درج در `OfflineQueue`
3. اتصال مجدد → Sync ترتیبی با نمایش وضعیت؛ **جلوگیری از Duplicate** با id یکتای سمت کلاینت و بررسی `(equipment, checklist, date, shift)`
4. Conflict Resolution: سرور رکورد موجود را نگه می‌دارد و رکورد محلی را رد می‌کند (Server Wins)

## ۶) ساعت کارکرد — جریان داده

`Device Reading (Gateway Poll هر N ثانیه) → Cache مقدار جاری + LastReading → ثبت همراه کنترل (Source=Auto) | Manual Fallback (Source=Manual) | Adjustment با دلیل (Source=Adjusted, نیازمند Approve)`. قانون: `New < Previous ❌` مگر Adjustment — همه مقادیر + Prev/New/Reason/User/Time در تاریخچه.
