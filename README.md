# NIPCO Daily Equipment Control System

**سامانه کنترل و بازدید روزانه تجهیزات NIPCO** — شرکت قطعه‌سازی خودرو
طراح و تحلیلگر سیستم: **محمد روشندل** — نسخه ۱٫۰٫۰ (۱۴۰۵)

---

## این سامانه چیست؟

نرم‌افزار **کنترل و بازدید روزانه تجهیزات** برای محیط صنعتی: تکنسین روی تبلت، QR تجهیز را اسکن می‌کند، چک‌لیست را اجرا می‌کند (OK/NOK + مقادیر عددی با اعتبارسنجی محدوده)، در صورت NOK/خروج از محدوده توضیح اجباری ثبت می‌کند، ساعت کارکرد را (از دستگاه یا دستی) ثبت و Submit می‌کند. در قطع شبکه، داده‌ها در **صف آفلاین** ذخیره و هنگام اتصال **خودکار Sync** می‌شوند.

> ⚠️ **PM عمداً در Scope نیست** — NIPCO سیستم PM جداگانه دارد و هیچ ماژول/منو/گزارش PM در این سامانه وجود ندارد.

## اجرا

```bash
npm install     # نصب وابستگی‌ها
npm run dev     # محیط توسعه
npm run build   # ساخت Production (خروجی در dist/)
```

## حساب‌های دمو

| نقش | نام کاربری | رمز |
|---|---|---|
| مدیر سیستم | `admin` | `admin1405` |
| سرپرست نت (جعفر تختی) | `takhti` | `123456` |
| تکنسین برق (اسفندیاری — فقط Sectionهای برق) | `esfandiyari` | `123456` |
| تکنسین مکانیک (فردین عظمیان) | `fardin` | `123456` |
| ناظر (فقط مشاهده) | `viewer` | `123456` |

۵ تلاش ناموفق = قفل ۶۰ ثانیه‌ای (Rate Limiting).

## امکانات پیاده‌سازی‌شده

- ✅ Login صنعتی با لوگو، Show/Hide رمز، Enter، Loading، خطای فارسی، Rate Limiting، Remember Me، Session Timeout قابل تنظیم
- ✅ داشبورد با KPI زنده، نمودارها، وضعیت شیفت‌ها (مدیریت شیفت شب)، شخصی‌سازی و ذخیره چیدمان
- ✅ کنترل روزانه: اسکن QR / فهرست / جستجو → اجرای چک‌لیست → **توضیح اجباری NOK/Out-of-Range** → Submit
- ✅ Checklist Builder کامل (Section/Item پویا، Reorder، Duplicate، Group/Equipment-Specific)
- ✅ **ساعت کارکرد بدون سقف** + خواندن خودکار (شبیه‌سازی Gateway با Polling) + Manual Fallback با ثبت منبع (Auto/Manual/Adjusted) + **Adjustment با دلیل و مجوز Approve** + تاریخچه و گزارش
- ✅ RBAC + Permission تا سطح ماژول/فرم/**Section** (ماتریس Module × 8 Permission)
- ✅ Offline-First: تشخیص قطع، صف محلی، Sync خودکار، جلوگیری از Duplicate
- ✅ گزارشات با فیلترهای ترکیبی + گزارش خرابی + نمودار قابل تغییر نوع + خروجی Excel/CSV + چاپ
- ✅ Notification Center + Ruleهای Email/SMS + Activity Log کامل
- ✅ مدیریت کاربران/نقش‌ها/تجهیزات/گروه‌ها/محل‌ها/شیفت‌ها (همه Dynamic)
- ✅ برندینگ: Upload/تغییر/حذف لوگو با Validation (لوگو Hard-Code نیست)
- ✅ سه تم (روشن/تاریک/صنعتی) + رنگ سازمانی + پشتیبان‌گیری/بازیابی + بستن سال و آرشیو
- ✅ PWA (manifest + Service Worker) — نصب روی تبلت، Touch-Friendly و Mobile-First
- ✅ توضیحات فارسی در تمام بخش‌های مهم کد

## ساختار ماژول‌ها

```
src/
├─ lib/        types (مدل داده) / utils (تاریخ شمسی، شیفت، هش) / seed / store (هسته: Auth, RBAC, Sync, Gateway)
├─ components/ ui (آیکون‌ها، لوگو، QR، نمودارها، مودال، Toast)
└─ pages/      Login / Dashboard / DailyControl / OperatingHours / Equipment / Checklists / Reports / Ops / Users / Settings
```

## معماری صنعتی (Production)

```
Machine/PLC/HMI → Industrial Gateway (OPC UA/Modbus) → NIPCO Backend/API → Database → Tablet/Dashboard
```
در این نسخه، Gateway و Backend به‌صورت شبیه‌سازی دقیق در `store.tsx` پیاده شده‌اند؛ مدل داده‌ها (`types.ts`) معادل مستقیم ERD دیتابیس است تا مهاجرت به سرور واقعی بدون بازنویسی رابط کاربری انجام شود. جزئیات: `ARCHITECTURE.md` و `DEPLOYMENT.md`.
