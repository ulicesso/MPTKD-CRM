# From the lead spreadsheet to the CRM

The studio's sales workbook (the "Offense" spreadsheet) was read tab by tab, row by row, before building. This page records what each part does today and where it lives in the CRM, so nothing gets lost in translation. It describes structure only: no names or real numbers from the sheet are in this repository.

## How the sheet works today

The workbook tracks the same families several times over, by hand:

1. **Inquiry Log**: one row per child (siblings get separate rows under the same parent). Columns: student, parent, age, inquiry date, status, source, phone, email, a communications log, background, trial instructor, notes. Rows are grouped under month headings, and each month ends with a typed "Results" row (total inquiries, prospects, signed). Row color is the status: green signed, yellow prospect, orange special membership, red lost, blue contact on a future date, pink no response, white contact ASAP.
2. **Prospect Log**: the families who came in for a trial: date of inquiry, prospect, status (what they signed, or why not), trial date, sign date, source, communication log, next step, and whether they were entered into MasterMind.
3. **Facebook Leads**: Meta ad form leads, with *Qualified?*, location, *points of contact* (a touch count), *Scheduled?* and status. Many are out of area or unreachable.
4. **Offensive Stats** and **2024 Numbers**: a monthly table of inquiries, inquiry-to-prospect and prospect-to-new-student percentages, active prospects, monthly signings, signing rate and the top source, with averages and totals.
5. **Marketing Stats**: the same funnel per source per month (Inquiries, Leads, Trials, Sign-ups) and a year summary by source.
6. Supporting tabs: **New Student Check List** (onboarding steps after signing), **Hot Lists** (current families who might add a member), **Referral Rewards**, **Birthday Reach Outs** and **Birthday Party Guests** follow-ups, **Day Care and Camp Reach Outs**, **Summer Holds Tracker**, **Active/Inactive Count**, and a **MasterList** of students.

The pain points: the same child is typed into two or three tabs; status is a free-text cell that holds either a membership ("3M Yellow Belt PIF") or a reason ("Schedule", "Finances"); monthly results are counted and typed by hand; follow-up dates live in the communications text, so nothing reminds anyone.

## Where each piece lives now

| Spreadsheet | CRM |
|---|---|
| A row in the Inquiry Log | A **lead** (one per child) linked to a **family**, a **guardian** and a **student** record. Siblings share a family and show together everywhere. |
| Parent, phone, email | **Guardians** on the family, with a preferred contact method. |
| Age, Background | Student age; the lead's goals (picked from a list), previous experience, and "what they told us". |
| Source dropdown (Website, Facebook, Location, Referral, Family, Booth, Birthday, Old Student, Old Prospect, Staples Display, Community Event, school field trip, Called In) | **Lead source** list, plus a free-text *source detail* for the campaign, event or school. Referrals record *which current student referred them* (for the referral reward). |
| Status cell and row color | **Stage**: New inquiry, Contacted, Trial scheduled, Trial completed, Decision pending, Enrolled, Nurture, Lost. Lost always has a **reason**; Nurture always has a **reconnect date**. |
| Communications column ("3/12 LVM and text - Sotelo") | **Contact history**: each call, text, voicemail, email or in-person talk is its own entry with outcome, notes, who logged it and when. One entry can be logged for all siblings at once. |
| Next Step column | **Next step** and **next follow-up date** on every open lead; overdue ones turn red and appear on the dashboard. |
| Trial date, trial instructor, "Special Membership" rows (4 weeks for $19, 6 classes for $16, summer specials) | **Trials**: date and class time, offer (free week, extended trial, seasonal special, observe a class), instructor, and attended / no-show / rescheduled / cancelled. |
| Sign date and what they signed ("3M Yellow Belt PIF", "36M BB", "12M Blue Belt") | **Enroll** creates the student's **membership** record (the billing roster's columns) with the price list and family discount applied. |
| MasterMind Yes/No | Not needed: enrolling creates the membership record in the CRM itself. |
| Facebook *Qualified?* | **Qualified** on every lead (yes / no / not judged). Unqualified leads stay countable as inquiries but drop out of "leads". |
| Facebook *Points of contact*, "No contact after 10 POC" | Touches are counted from the contact history. After 10 unanswered touches the lead panel suggests Nurture or Lost. |
| Monthly "Results" rows, Offensive Stats, 2024 Numbers | **Analytics → Month by month**, computed live. |
| Marketing Stats | **Analytics → Lead sources**, plus ad and event **spend** for cost per lead and cost per signing. |

## Metric definitions

Kept identical to the sheet so year-over-year comparisons hold:

- **Inquiry**: every lead record (one per child).
- **Lead**: a qualified inquiry (in the area, right age, reachable).
- **Prospect**: came in for a trial, or enrolled without one (family add-ons often sign on the spot).
- **Signed**: enrolled.
- **Inquiry to prospect %** and **prospect to new student %**: by inquiry month, like the monthly Results rows.
- **Active prospects** and **monthly signings**: by the month the trial or the enrollment happened, like Offensive Stats. **Signing rate** = monthly signings ÷ active prospects.

The code for each lives in `src/lib/metrics.js` with tests in `tests/metrics.test.js`.

## Not moved yet (planned)

- **New Student Check List** → the Students module's onboarding checklist.
- **Hot Lists** → a "family add-on" view (Families already filters "training, with a sibling in the pipeline").
- **Referral Rewards, Birthday reach-outs, Day care and camp outreach** → Messaging and partnerships.
- **Summer Holds Tracker** → membership holds (the billing statuses Paused / On Break already exist).
- **Active/Inactive Count** → retention reporting.

## Open questions for the studio

- The sales log's most common sale is a **3-month starter** ("3M Yellow Belt", "3M LT"), which isn't in the billing price list. The Enroll form pre-fills the month-to-month rate for it and asks staff to confirm. What should it cost, monthly and paid in full?
- Should the 2024 and 2025 monthly totals from the sheet be loaded as historical benchmarks once the database is private? (They were deliberately left out of this public repository.)
- Which marketing spend should count toward cost per signing (ads only, or booth fees and printed materials too)?
