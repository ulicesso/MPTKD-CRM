-- MPTKD CRM: core schema (families, students, memberships, leads and sales activity)
--
-- Run this in the Supabase SQL editor (or `supabase db push`). The browser demo
-- mode uses the same table and column names, so data moves between them cleanly.
--
-- Shape of the data:
--   family ─┬─ guardians (parents, contacts)
--           ├─ students (every child or adult who trains or might train)
--           │     └─ memberships (billing fields: admins only)
--           └─ leads (one per prospective student, so siblings move through the pipeline separately)
--                 ├─ trials
--                 ├─ activities (calls, texts, emails, notes: the contact history)
--                 └─ lead_stage_events (every stage change, for conversion timing)

-- gen_random_uuid() is built into Postgres 13+ (Supabase included), so no extension is needed.

-- ---------- Staff and roles ----------
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                -- links to auth.users once someone is invited
  name text not null,
  initials text,
  role text not null default 'instructor' check (role in ('admin', 'instructor', 'front_desk')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Families ----------
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,                      -- household label, usually the last name (roster "Family" column)
  town text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guardians (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  first_name text not null,
  last_name text,
  relationship text,                       -- Mom, Dad, Guardian, Self (adult student)
  phone text,
  email text,
  preferred_contact text check (preferred_contact in ('call', 'text', 'email')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists guardians_family_idx on guardians(family_id);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birthdate date,
  age_at_inquiry numeric(4,1),             -- the spreadsheet often has an age but no birthday (e.g. 4.5)
  program text check (program in ('little_tigers', 'kids', 'teen_adult')),
  status text not null default 'prospect' check (status in ('prospect', 'active', 'inactive', 'alumni')),
  rank text,                               -- belt; history moves to its own table in the belts phase
  joined_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_family_idx on students(family_id);

-- Billing fields live in their own table so row-level security can hide them
-- from instructors entirely (brief, section 8). Columns mirror the roster spreadsheet.
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  program text check (program in ('little_tigers', 'kids', 'teen_adult')),
  membership text not null,                -- e.g. "12 Month Program", "Black Belt Program"
  payment_type text not null check (payment_type in ('Monthly', 'PIF')),
  monthly_amount numeric(10,2),            -- actual draft: after family discount, incl. 3% if Card
  billing_day smallint check (billing_day between 1 and 31),
  payment_method text check (payment_method in ('ACH', 'Card', 'Card (no fee)')),
  start_date date,
  end_date date,
  pif_amount numeric(10,2),
  paid_date date,
  family_discount numeric(10,2) default 0, -- monthly $ for monthly payers, term total for PIF
  pif_discount numeric(10,2) default 0,
  status text not null default 'Active'
    check (status in ('Active', 'Paused', 'On Break', 'Awaiting Renewal', 'Paid Ahead', 'Not Paying', 'Ended')),
  billing_resumes date,
  source_lead_id uuid,                     -- the lead that produced this enrollment, if any
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memberships_student_idx on memberships(student_id);

-- ---------- Leads ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'trial_scheduled', 'trial_completed', 'decision', 'enrolled', 'nurture', 'lost')),
  stage_changed_at timestamp not null default localtimestamp,  -- studio local time
  inquiry_date date not null default current_date,
  source text not null,                    -- website, facebook, referral, family, ... (see src/lib/constants.js)
  source_detail text,                      -- campaign, event name, school name
  referred_by_student_id uuid references students(id) on delete set null,
  program_interest text check (program_interest in ('little_tigers', 'kids', 'teen_adult')),
  qualified boolean,                       -- null = not yet judged; false = out of area / wrong age / unreachable
  goals text[] not null default '{}',
  experience text,                         -- previous martial arts or activities
  background text,                         -- what the parent told us (the spreadsheet "Background" column)
  notes text,
  offer text,                              -- trial offer key
  next_follow_up date,
  next_step text,
  owner_id uuid references staff(id) on delete set null,
  lost_reason text,
  enrolled_on date,
  membership_id uuid references memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_stage_idx on leads(stage);
create index if not exists leads_follow_up_idx on leads(next_follow_up);
create index if not exists leads_family_idx on leads(family_id);
create index if not exists leads_inquiry_idx on leads(inquiry_date);

create table if not exists trials (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  scheduled_at timestamp not null,         -- local studio time
  offer text not null default 'free_week',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'attended', 'no_show', 'rescheduled', 'cancelled')),
  instructor_id uuid references staff(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists trials_lead_idx on trials(lead_id);
create index if not exists trials_when_idx on trials(scheduled_at);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  family_id uuid references families(id) on delete cascade,
  at timestamp not null default localtimestamp,   -- studio local time
  kind text not null check (kind in ('contact', 'note', 'stage', 'trial', 'system')),
  method text check (method in ('call', 'text', 'voicemail', 'email', 'in_person', 'social')),
  outcome text check (outcome in ('reached', 'replied', 'no_answer', 'sent')),
  body text,
  staff_id uuid references staff(id) on delete set null
);
create index if not exists activities_lead_idx on activities(lead_id, at desc);

create table if not exists lead_stage_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  at timestamp not null default localtimestamp,
  staff_id uuid references staff(id) on delete set null
);
create index if not exists stage_events_lead_idx on lead_stage_events(lead_id, at);

-- ---------- Marketing spend (for cost per lead and cost per signing) ----------
create table if not exists marketing_spend (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  source text not null,
  amount numeric(10,2) not null default 0,
  notes text,
  unique (month, source)
);

-- ---------- Monthly billing snapshots (for "change since last month") ----------
create table if not exists billing_snapshots (
  as_of date primary key,
  mrr numeric(12,2) not null,
  monthly_count int not null,
  pif_count int not null,
  pif_value numeric(12,2) not null
);

-- ---------- updated_at ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['families', 'students', 'memberships', 'leads'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row-level security ----------
-- Everyone must be signed in and listed in staff. Admins see everything.
-- Instructors and front desk work leads and students but never billing tables.
create or replace function current_staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from staff where auth_user_id = auth.uid() and active
$$;

alter table staff enable row level security;
alter table families enable row level security;
alter table guardians enable row level security;
alter table students enable row level security;
alter table memberships enable row level security;
alter table leads enable row level security;
alter table trials enable row level security;
alter table activities enable row level security;
alter table lead_stage_events enable row level security;
alter table marketing_spend enable row level security;
alter table billing_snapshots enable row level security;

drop policy if exists staff_read on staff;
create policy staff_read on staff for select to authenticated using (current_staff_role() is not null);
drop policy if exists staff_admin on staff;
create policy staff_admin on staff for all to authenticated
  using (current_staff_role() = 'admin') with check (current_staff_role() = 'admin');

do $$ declare t text; begin
  foreach t in array array['families', 'guardians', 'students', 'leads', 'trials', 'activities', 'lead_stage_events'] loop
    execute format('drop policy if exists %I_staff on %I', t, t);
    execute format('create policy %I_staff on %I for all to authenticated using (current_staff_role() is not null) with check (current_staff_role() is not null)', t, t);
  end loop;
  foreach t in array array['memberships', 'marketing_spend', 'billing_snapshots'] loop
    execute format('drop policy if exists %I_admin on %I', t, t);
    execute format('create policy %I_admin on %I for all to authenticated using (current_staff_role() = ''admin'') with check (current_staff_role() = ''admin'')', t, t);
  end loop;
end $$;
