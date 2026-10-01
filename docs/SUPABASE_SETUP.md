# Setting up the real database (Supabase) and hosting (Netlify)

This is the path from demo mode to the CRM the studio actually uses. Steps 1 to 4 are point-and-click and free. Step 5 is the code change that connects the app, which is the next build session.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**.
2. Name it `mptkd-crm`, choose a strong database password (save it in a password manager), and pick the **East US** region.
3. Wait a minute for it to finish setting up.

## 2. Create the tables and security rules

1. In the project, open **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_core_schema.sql` from this repository, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned".
3. Optional, for a test copy only: run `npm run seed:sql` on your computer, then paste `supabase/seed.sql` into a new query and run it to load the made-up demo families. Don't load demo data into the project you'll use for real students.

What the security rules do: nobody sees anything unless they're signed in **and** listed in the `staff` table. Admins see everything. Instructors and front desk can work leads, families and students but get **zero rows** from `memberships`, `marketing_spend` and `billing_snapshots`. That's enforced by the database, so it holds even if someone pokes at the app. (`tests/schema.test.js` checks this on every test run.)

## 3. Invite people (no public sign-up)

1. **Authentication → Providers → Email**: keep it on. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
2. **Authentication → Users → Invite user**: invite yourself and Master P by email.
3. After each person accepts, copy their user ID (the UUID in the Users list) and add them to staff in the SQL editor:

```sql
insert into staff (name, initials, role, auth_user_id)
values ('Ulices Sotelo', 'US', 'admin', 'paste-the-user-id-here'),
       ('Master P', 'MP', 'admin', 'paste-the-user-id-here');
```

Instructors get `role = 'instructor'`.

## 4. Host on Netlify

1. In [Netlify](https://app.netlify.com): **Add new site → Import an existing project → GitHub**, pick `MPTKD-CRM`.
2. Build command `npm run build`, publish directory `dist`. (The `public/_redirects` file already makes page links work on refresh.)
3. **Site configuration → Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase **Project Settings → API**. Use the **anon / publishable** key only. The **service_role / secret** key never goes in Netlify or the browser.
4. Deploy. Until step 5 is done the site still runs in demo mode with fake data, which is a safe way to share it.

Before any real data goes in, make the GitHub repository **private** (GitHub → Settings → General → Danger Zone → Change visibility).

## 5. Connect the app (next build session)

- Add `@supabase/supabase-js` and a login screen (email magic link).
- In `src/data/store.js`, when `VITE_SUPABASE_URL` is set, load the tables from Supabase instead of the browser, and have each action write its inserts and updates through Supabase. The actions in `src/data/actions.js` already describe every write as insert/update calls on named tables, so they map one to one.
- Hide billing screens for instructors in the UI (the app already does this when you switch "Working as" to an instructor; the database blocks the data either way).
- Import the real roster through the import screen (port of the tuition dashboard's updater), straight into Supabase. Never commit the spreadsheet.
