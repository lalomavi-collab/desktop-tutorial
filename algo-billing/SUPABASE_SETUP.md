# ALGO - Supabase Setup

הרץ את ה-SQL הבא ב-**Supabase SQL Editor** (בסדר הזה).

## 1. טבלת לקוחות

```sql
create table public.clients (
  id          text        primary key,
  user_id     uuid        not null default auth.uid() references auth.users,
  name        text        not null,
  rate        numeric     not null default 0,
  email       text,
  auto_bill   boolean     not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "users own clients"
  on public.clients for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 2. טבלת יומן שעות

```sql
create table public.time_logs (
  id           text        primary key,
  user_id      uuid        not null default auth.uid() references auth.users,
  client_id    text,
  client_name  text,
  log_date     date        not null,
  hours        numeric     not null,
  description  text,
  rate         numeric     not null default 0,
  total        numeric     not null default 0,
  status       text        not null default 'Pending',
  updated_at   timestamptz not null default now()
);

alter table public.time_logs enable row level security;

create policy "users own logs"
  on public.time_logs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 3. הגדרת Auth

ב-**Authentication → Providers**: ודא שה-Email provider פעיל ושה-"Confirm email" מוגדר.

ב-**Authentication → URL Configuration**:
- Site URL: `http://localhost:5173` (פיתוח) / הדומיין שלך (פרודקשן)
- Redirect URLs: הוסף `http://localhost:5173/**`

## 4. משתני סביבה

צור קובץ `.env.local` בשורש הפרויקט:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

ערכים אלה נמצאים ב-**Project Settings → API**.

## אופן פעולה

- **ללא `.env.local`**: האפליקציה עובדת כרגיל עם localStorage בלבד.
- **עם `.env.local` + כניסה**: לחץ על "כניסה" בכותרת → הזן אימייל → לחץ על הקישור שנשלח → הנתונים מסונכרנים עם Supabase (remote wins בכניסה ראשונה).
- **Upsert אידמפוטנטי**: כל רשומה משתמשת ב-`crypto.randomUUID()` כ-ID, כך שאפשר לפתוח את האפליקציה מכמה מכשירים.
