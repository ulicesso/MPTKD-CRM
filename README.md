# MPTKD CRM

The custom CRM for Master P's World Class Tae Kwon Do (West Chester, PA). Version 0.1 covers the sales side: inquiries, trials, follow-ups, enrollment and the reporting the studio used to keep by hand in the lead spreadsheet. It is built to grow into students, renewals, testing, attendance, messaging and retention.

> **Right now this runs in demo mode.** Every family, phone number and email in the app is invented and lives only in your browser. No real student or billing data is in this repository, and none should ever be committed (see [Data privacy](#data-privacy)).

## What's in version 0.1

| Area | What it does |
|---|---|
| **Dashboard** | Today's list: trials on the mat today, new inquiries waiting on a first reply, overdue and due follow-ups. Trials this week, recent enrollments, the pipeline at a glance, this month's numbers, and a membership billing snapshot (admins only). |
| **Leads** | Every inquiry, one per prospective student. Search by name, parent, phone or email; filter by stage, source, program, owner and inquiry date; sort; export to CSV. Opens a detail panel with the parent, student, age, program, goals, experience, lead source, contact history, stage, trials and next follow-up. |
| **Pipeline** | A board with one column per stage: New inquiry, Contacted, Trial scheduled, Trial completed, Decision pending, Enrolled, Nurture, Lost. Drag a card or use its Move menu. Moves that need details (enroll, lost reason, nurture date, trial time) ask for them. |
| **Analytics** | The funnel (Inquiry → Lead → Prospect → Signed), the month-by-month table from the Offensive Stats tab, lead sources with spend, cost per lead and cost per signing (the Marketing Stats tab), trial show rate and conversion by offer and instructor, lost reasons, programs, speed to first contact, and what new students signed up for. |
| **Families** | Households with parents, every student (training or prospective), memberships and leads. Siblings move through the pipeline separately but are always shown together. |

The workflow rules (same-day first contact, confirm trials the day before, follow up the day after a trial, a reason for every lost lead, a reconnect date for every nurture lead, and the "10 touches with no reply" check) come straight from how the spreadsheet was used. See [docs/SPREADSHEET_TO_CRM.md](docs/SPREADSHEET_TO_CRM.md).

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # open the link it prints (usually http://localhost:5173)
```

Other commands:

```bash
npm test           # unit tests, plus the database schema and security rules in a real Postgres
npm run build      # production build into dist/
npm run seed:sql   # write supabase/seed.sql with demo data for loading into Supabase
```

The browser checks in `scripts/` (`e2e.mjs` clicks through the whole sales workflow; `screenshots.mjs` captures every page) run against `npx vite preview --port 4173` after `npm run build`. They use Playwright with a local Chromium; set `CHROMIUM=/path/to/chrome` if yours lives elsewhere.

In the app, **Reset demo data** (bottom of the sidebar) rebuilds the sample families around today's date. **Working as** switches between staff members; pick an instructor to see what they will see (no billing).

## How it's built

Plain JavaScript, chosen to stay readable for someone learning to code.

- **[Vite](https://vite.dev) + [React](https://react.dev)** for the web app, **React Router** for pages. No UI framework: styles are one CSS file with design tokens (`src/styles/app.css`).
- **Postgres schema with row-level security** in `supabase/migrations/`, ready for [Supabase](https://supabase.com). Billing lives in its own `memberships` table so the database itself blocks instructors from it.
- **A store with the same tables** (`src/data/store.js`) that the app reads and writes. In demo mode it saves to the browser. Moving to Supabase replaces how that store loads and saves; pages and workflow rules stay the same.

```
src/
  lib/            pure logic, no React
    constants.js    stages, sources, programs, memberships, trial offers, lost reasons
    billing.js      billing math + spreadsheet import, ported unchanged from the tuition dashboard
    billingAdapter.js  CRM records ⇄ billing math; enrollment pricing rules
    metrics.js      every analytics number and its definition
    dates.js, format.js
  data/
    store.js        tables, transactions, persistence
    actions.js      every change the CRM can make (add inquiry, log contact, book trial, enroll, ...)
    selectors.js    joined views for pages (a lead with its family, trials and history)
    seed.js         demo data generator (simulates a year of inquiries through actions.js)
    sql.js          state → SQL inserts
    CRMContext.jsx  React glue
  components/       shared UI: belt stage tags, drawers, forms, charts
  pages/            Dashboard, Leads, Pipeline, Analytics, Families
supabase/migrations/  the Postgres schema and security rules
tests/              unit, workflow, analytics, demo-data and database tests
docs/               design notes, spreadsheet mapping, Supabase setup
```

**Adding a feature** usually means: add columns or a table to a new migration, add the same table name to `TABLES` in `store.js`, write the change as an action in `actions.js`, then build the page. Keep calculations in `src/lib/` so they can be tested without a browser.

## What came from the existing tools

- **Tuition dashboard** (`reference/billing-dashboard.html`, kept for the upcoming port): its calculation and import functions are in `src/lib/billing.js`, behavior unchanged. They were re-checked against the real roster during this build and reproduce the brief's figures exactly (monthly billing, the next three months' expected totals, PIF count and prepaid total, expired PIF plans). The full dashboard page (deposit calendar, six-month outlook, PIF list) is the next port, not rebuilt yet.
- **Billing roster spreadsheet**: its columns are the `memberships` table, one to one, and the same price list and family-discount rules drive the Enroll form.
- **Lead spreadsheet**: see [docs/SPREADSHEET_TO_CRM.md](docs/SPREADSHEET_TO_CRM.md).

## Roadmap

1. **Supabase + login** (invite-only, Admin and Instructor roles). Follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md); then swap the store's load/save for Supabase calls.
2. **Tuition dashboard port** and the **roster import** screen (reuse `autoMap` / `buildMembers` from `billing.js`), loading the real roster into Supabase, never into git.
3. **Students**: profiles, rank, notes; the new-student checklist from the spreadsheet (reg fee, payment info, app info, first class, 30-day check-in).
4. **Renewals**: contracts ending, PIF renewals, awaiting renewal (logic already in `billing.js`).
5. **Testing and belts**: quarterly color-belt testing (Aug, Nov, Feb, May), Little Tigers' own stripe sequence on 8-week cycles, eligibility list.
6. **Attendance**: class check-in by class and date.
7. **Messaging and retention**: templates for the follow-up texts, birthday and referral reward reach-outs, holds and returning-student tracking (all spreadsheet tabs today).

## Data privacy

The data this CRM will hold is about minors and family billing.

- `data/`, spreadsheets (`*.xlsx`, `*.xls`) and CSV exports are git-ignored. Keep real exports out of this folder entirely if you can.
- This GitHub repository is currently **public**. That's fine for code with fake data, but consider making it private before connecting real data or deploying.
- Supabase keys go in Netlify environment variables, never in code. The service-role key never goes in the browser.
