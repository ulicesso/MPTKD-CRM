# MPTKD CRM: notes for coding sessions

CRM for Master P's World Class Tae Kwon Do. Built for Ulices (learning to code): keep code plain JavaScript, readable, commented where the "why" isn't obvious, and prefer well-known tools.

## Hard rules

- **Never commit real data.** No roster, lead spreadsheet, names, phone numbers, or the studio's real revenue or conversion figures. `data/`, `*.xlsx`, `*.csv` are git-ignored. The GitHub repo is public. Demo data uses invented names, `555-01xx` phones and `@example.com` emails (enforced by `tests/seed.test.js`).
- **Billing math** in `src/lib/billing.js` is a verbatim port of the tested tuition dashboard. Don't change its behavior without checking against the real roster locally.
- **Brand voice:** parent-facing text never calls classes "games"; it's structured martial arts training.
- Billing fields stay in the `memberships` table (admin-only via row-level security).

## Commands

- `npm run dev` / `npm run build` / `npm test`
- Browser checks: `npm run build && npx vite preview --port 4173 &` then `node scripts/e2e.mjs` and `node scripts/screenshots.mjs`.

## Architecture

- `src/lib/`: pure logic (constants, billing, metrics, dates). Test here first.
- `src/data/`: `store.js` (tables + persistence), `actions.js` (all writes), `selectors.js` (joined reads), `seed.js` (demo data simulated through actions).
- Table and column names match `supabase/migrations/*.sql`. New table → migration + `TABLES` in `store.js` + bump `SCHEMA_VERSION`.
- Design rules: `docs/DESIGN.md` (belt colors = stage, red = overdue, gold = now). Use the `frontend-design` skill in `.claude/skills/` for UI work.
