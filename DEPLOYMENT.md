# DEPLOYMENT — NIPCO DECS

> ⚠️ **Deployment Audit نتیجه:** این بسته یک اپلیکیشن **Frontend (React 18 + Vite 6 + TypeScript + Tailwind 4)** با لایه داده محلی (localStorage به‌جای دیتابیس، شبیه‌سازی Gateway در `store.tsx`) است. Backend/دیتابیس واقعی در این بسته **Not Found** است و باید طبق `ARCHITECTURE.md` اضافه شود. این سند بر اساس فایل‌های واقعی پروژه نوشته شده است.

## استخراج واقعی از Source Code

| مورد | مقدار |
|---|---|
| Frontend Framework | React 18.2 + Vite 6.4 (پلاگین @vitejs/plugin-react) |
| زبان | TypeScript 5.7 |
| استایل | Tailwind CSS 4.1 (@tailwindcss/vite) |
| Package Manager | npm (package-lock.json) |
| Build | `npm run build` → `vite build` (خروجی `dist/`) |
| Typecheck | `npm run typecheck` → `tsc --noEmit` |
| PWA | `public/manifest.webmanifest` + `public/sw.js` (ثبت در `src/App.tsx` در حالت PROD) |
| Backend / ORM / Migration / Seed CLI | **Missing** (شبیه‌سازی در `src/lib/store.tsx` — داده در localStorage کلید `nipco-decs-db-v3`) |
| Dockerfile / docker-compose | **Missing** |
| .env / Environment Variables | **Missing** (بدون متغیر محیطی) |
| Health Check | **Missing** |
| HTTPS/Reverse Proxy | در این بسته **Missing** — باید در سرور پیکربندی شود |
| Ports | Vite dev پیش‌فرض 5173 |

## نصب روی Ubuntu Server (Frontend + Nginx)

```bash
sudo apt update && sudo apt install -y nginx nodejs npm
git clone <repo> && cd nipco-decs && npm ci && npm run build
sudo cp -r dist/* /var/www/nipco/ 
# Nginx: root /var/www/nipco; try_files $uri /index.html;  (SPA + PWA)
sudo ufw allow 'Nginx Full' && sudo systemctl enable --now nginx
```
HTTPS با `certbot --nginx` فعال شود. برای اجرای شبکه داخلی روی تبلت‌ها، سرور باید در LAN در دسترس باشد.

## Docker (پیشنهادی — فایل‌ها باید اضافه شوند)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./ && RUN npm ci
COPY . . && RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```
`docker compose up -d` — Reverse Proxy و Volume برای بکاپ طبق ARCHITECTURE.

## توسعه محلی

```bash
npm install → npm run dev → http://localhost:5173 → Login: admin / admin1405
```
Reset داده‌ها: تنظیمات → پشتیبان‌گیری → بازنشانی کامل.

## پشتیبان‌گیری / Restore (وضعیت فعلی)

- Manual: تنظیمات → پشتیبان‌گیری → دانلود JSON کامل (Database + تنظیمات + برندینگ)
- Restore: همان تب → انتخاب فایل پشتیبان
- Automatic: سوئیچ Daily/Weekly/Monthly در تنظیمات (اجرا در نسخه سرور با Cron)
- آرشیو سالانه: تنظیمات → سال و آرشیو → Close Year → Archive → سال جدید

## به‌روزرسانی و Rollback

`Backup(دانلود JSON) → توقف سرویس → جایگزینی dist → شروع → بررسی Login/داشبورد` — Rollback = بازگردانی `dist` قبلی + Restore بکاپ JSON.

## Production Readiness

- 🟢 **READY:** رابط کامل، Auth/RBAC، Offline/Sync (محلی)، PWA، گزارشات، لاگ‌ها، بکاپ JSON، تم/برندینگ
- 🟡 **NEEDS ATTENTION:** اتصال به Backend واقعی و PostgreSQL، Gateway واقعی (OPC UA/Modbus)، ارسال واقعی Email/SMS، دوریت واقعی دوربین برای QR
- 🔴 **UNSAFE تا اصلاح:** هش رمز نمایشی سمت کلاینت است — **قبل از استقرار واقعی باید bcrypt/Argon2 در Backend** جایگزین شود؛ HTTPS و Rate Limit سمت سرور الزامی است.
