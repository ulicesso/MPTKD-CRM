/*
 * Shared vocabulary for the whole CRM.
 *
 * Everything here was translated from the existing sales spreadsheet
 * (Inquiry Log, Prospect Log, Facebook Leads, Marketing Stats) and the
 * billing roster. Keep keys stable: they are stored in the database.
 * Labels can change freely.
 */

/* ---------- Pipeline stages ----------
 * Each stage borrows a belt color, so a lead "earns belts" as it moves
 * toward Enrolled (black belt). Nurture and Lost sit off the belt track.
 *
 * Spreadsheet color legend → stage:
 *   white "Contact: ASAP"        → New inquiry
 *   yellow "Prospect"            → Trial scheduled / Trial completed / Decision pending
 *   orange "Special Membership"  → a trial with a paid offer (see TRIAL_OFFERS)
 *   blue "Contact: Future Date"  → Nurture (with a follow-up date)
 *   pink "No Response"           → Contacted (still trying) or Nurture
 *   green "Signed"               → Enrolled
 *   red "Lost Lead"              → Lost (with a reason)
 */
export const STAGES = [
  { key: "new", label: "New inquiry", short: "New", belt: "white", open: true,
    hint: "Reach out the same day. Speed to lead wins the trial." },
  { key: "contacted", label: "Contacted", short: "Contacted", belt: "yellow", open: true,
    hint: "In conversation. Goal: book the trial." },
  { key: "trial_scheduled", label: "Trial scheduled", short: "Trial set", belt: "green", open: true,
    hint: "Confirm the day before and follow up after the first class." },
  { key: "trial_completed", label: "Trial completed", short: "Trial done", belt: "blue", open: true,
    hint: "They came in. Hold the enrollment conversation." },
  { key: "decision", label: "Decision pending", short: "Deciding", belt: "red", open: true,
    hint: "Family is deciding. Keep a dated next step." },
  { key: "enrolled", label: "Enrolled", short: "Enrolled", belt: "black", open: false,
    hint: "Signed. Hand off to the new student checklist." },
  { key: "nurture", label: "Nurture", short: "Nurture", belt: "none", open: true,
    hint: "Not now. Reconnect on the follow-up date." },
  { key: "lost", label: "Lost", short: "Lost", belt: "none", open: false,
    hint: "Closed with a reason, so we can learn from it." },
];
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s]));
export const STAGE_ORDER = STAGES.map((s) => s.key);
/** Stages on the main belt track, in sales order. */
export const ACTIVE_TRACK = ["new", "contacted", "trial_scheduled", "trial_completed", "decision"];
export const CLOSED_STAGES = ["enrolled", "lost"];

/* ---------- Lead sources ----------
 * From the spreadsheet's Source dropdown and Marketing Stats rows.
 * `paid` marks sources that have a marketing cost, used for cost per signing.
 */
export const SOURCES = [
  { key: "website", label: "Website", paid: false },
  { key: "facebook", label: "Facebook / Meta ad", paid: true },
  { key: "google", label: "Google", paid: true },
  { key: "location", label: "Saw our location", paid: false },
  { key: "referral", label: "Referral", paid: false },
  { key: "family", label: "Family add-on", paid: false },
  { key: "birthday", label: "Birthday party", paid: false },
  { key: "event", label: "Community event / booth", paid: true },
  { key: "school", label: "School or daycare partner", paid: false },
  { key: "returning", label: "Returning student", paid: false },
  { key: "old_prospect", label: "Old prospect", paid: false },
  { key: "called_in", label: "Called in", paid: false },
  { key: "other", label: "Other", paid: false },
];
export const SOURCE = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

/* ---------- Programs ---------- */
export const PROGRAMS = [
  { key: "little_tigers", label: "Little Tigers", ages: "4–5", minAge: 3, maxAge: 5 },
  { key: "kids", label: "Kids 6–12", ages: "6–12", minAge: 6, maxAge: 12 },
  { key: "teen_adult", label: "Teen/Adult", ages: "13+", minAge: 13, maxAge: 120 },
];
export const PROGRAM = Object.fromEntries(PROGRAMS.map((p) => [p.key, p]));
/** The billing roster stores program labels, e.g. "Kids 6–12". */
export const PROGRAM_BY_LABEL = Object.fromEntries(PROGRAMS.map((p) => [p.label, p.key]));

export function programForAge(age) {
  if (age == null || age === "") return "";
  const a = Number(age);
  if (!isFinite(a)) return "";
  if (a < 6) return "little_tigers";
  if (a <= 12) return "kids";
  return "teen_adult";
}

/* ---------- Memberships ----------
 * The first eight match the billing roster dropdown exactly.
 * The two 3-month starter programs come from the sales log ("3M Yellow Belt",
 * "3M LT"), which is what most new families sign. Their price isn't in the
 * billing brief yet, so the enroll form pre-fills the month-to-month rate
 * and asks staff to confirm.
 */
export const MEMBERSHIPS = [
  { key: "Month to Month", months: 0, rate: 210, ltRate: 180, pifPct: 0 },
  { key: "6 Month Program", months: 6, rate: 205, ltRate: 175, pifPct: 0.05 },
  { key: "12 Month Program", months: 12, rate: 195, ltRate: 165, pifPct: 0.075 },
  { key: "Blue Belt Program", months: 12, rate: 185, ltRate: null, pifPct: 0.1, legacy: true },
  { key: "Black Belt Program", months: 36, rate: 179, ltRate: null, pifPct: 0.1 },
  { key: "Holiday 6+1", months: 7, pifOnly: 1110, seasonal: true },
  { key: "Holiday 10+2", months: 12, pifOnly: 1850, seasonal: true },
  { key: "Holiday 18+4", months: 22, pifOnly: 3330, seasonal: true },
  { key: "3 Month Yellow Belt", months: 3, rate: 210, ltRate: null, pifPct: 0, starter: true, confirmPrice: true },
  { key: "3 Month Little Tigers", months: 3, rate: null, ltRate: 180, pifPct: 0, starter: true, confirmPrice: true },
];
export const MEMBERSHIP = Object.fromEntries(MEMBERSHIPS.map((m) => [m.key, m]));

export const PAYMENT_TYPES = ["Monthly", "PIF"];
export const PAYMENT_METHODS = ["ACH", "Card", "Card (no fee)"];
export const CARD_FEE = 0.03;
/** Family discount ladder: 1st student full rate, then $20, $40, then free. */
export const FAMILY_DISCOUNT_STEPS = [0, 20, 40, "free"];
export const REGISTRATION_FEE = { full: 199, earlyDiscount: 100 };

/* ---------- Trials ----------
 * From the brief and the "special membership" rows in the sales log
 * (4 weeks for $19, 6 classes for $16 back to school, summer specials).
 */
export const TRIAL_OFFERS = [
  { key: "free_week", label: "Free 1-week trial", price: 0, detail: "Private lesson plus group classes" },
  { key: "extended", label: "Extended trial", price: 49, detail: "4 classes" },
  { key: "special", label: "Seasonal special", price: 19, detail: "Back to School, summer, holiday offers" },
  { key: "observe", label: "Observe a class", price: 0, detail: "Watched before booking" },
];
export const TRIAL_OFFER = Object.fromEntries(TRIAL_OFFERS.map((o) => [o.key, o]));
export const TRIAL_STATUSES = [
  { key: "scheduled", label: "Scheduled" },
  { key: "attended", label: "Attended" },
  { key: "no_show", label: "No-show" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "cancelled", label: "Cancelled" },
];
export const TRIAL_STATUS = Object.fromEntries(TRIAL_STATUSES.map((s) => [s.key, s]));

/** Class times seen in the sales log and brief, used for trial booking. */
export const CLASS_SLOTS = {
  little_tigers: ["Mon 5:15pm", "Tue 4:30pm", "Wed 5:15pm", "Thu 5:15pm"],
  kids: ["Mon 4:10pm", "Mon 5:10pm", "Mon 6:20pm", "Tue 4:10pm", "Wed 5:10pm", "Thu 4:55pm", "Sat 10:00am"],
  teen_adult: ["Mon 7:50pm", "Tue 7:00pm", "Thu 7:50pm", "Sat 11:00am"],
};

/* ---------- Contact history ----------
 * The spreadsheet logged "date - action - staff", e.g. "3/12 LVM and text - Sotelo".
 */
export const CONTACT_METHODS = [
  { key: "call", label: "Call" },
  { key: "text", label: "Text" },
  { key: "voicemail", label: "Left voicemail" },
  { key: "email", label: "Email" },
  { key: "in_person", label: "In person" },
  { key: "social", label: "Messenger / DM" },
];
export const CONTACT_METHOD = Object.fromEntries(CONTACT_METHODS.map((m) => [m.key, m]));
export const CONTACT_OUTCOMES = [
  { key: "reached", label: "Spoke with them" },
  { key: "replied", label: "They replied" },
  { key: "no_answer", label: "No answer" },
  { key: "sent", label: "Sent info or link" },
];
export const CONTACT_OUTCOME = Object.fromEntries(CONTACT_OUTCOMES.map((o) => [o.key, o]));
/** "No Contact after 10 POC": after this many unanswered touches, suggest Nurture or Lost. */
export const MAX_UNANSWERED_TOUCHES = 10;

/* ---------- Lost reasons ----------
 * The red "Lost Lead" rows in the Inquiry Log, grouped.
 */
export const LOST_REASONS = [
  { key: "schedule", label: "Schedule doesn't fit" },
  { key: "finances", label: "Cost / finances" },
  { key: "distance", label: "Too far / outside our area" },
  { key: "no_response", label: "Stopped responding" },
  { key: "no_show", label: "No-show, never rebooked" },
  { key: "not_interested", label: "Not interested" },
  { key: "readiness", label: "Not ready yet (age or maturity)" },
  { key: "support", label: "Needs support we can't provide" },
  { key: "competitor", label: "Chose another school or activity" },
  { key: "unqualified", label: "Unqualified (wrong number, test, spam)" },
];
export const LOST_REASON = Object.fromEntries(LOST_REASONS.map((r) => [r.key, r]));

export const GOALS = [
  "Confidence", "Focus", "Discipline", "Fitness", "Self-defense",
  "Respect", "Social skills", "Coordination", "Anti-bullying", "Stress relief",
];

export const STAFF_ROLES = { admin: "Admin", instructor: "Instructor", front_desk: "Front desk" };
