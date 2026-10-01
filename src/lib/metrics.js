/*
 * Sales analytics. These reproduce the numbers the studio tracked by hand in
 * the "Offensive Stats" and "Marketing Stats" tabs, computed from the CRM's
 * own records instead of typed in.
 *
 * Definitions (same words as the spreadsheet):
 *   Inquiry   every lead record (one per prospective student).
 *   Lead      a qualified inquiry: not marked unqualified (out of area, wrong
 *             number, test). The Facebook tab's "Qualified?" column.
 *   Prospect  came in for a trial (attended), or enrolled without one
 *             (family add-ons often sign on the spot).
 *   Sign      enrolled.
 *
 * Cohort numbers (Inquiry → Prospect → Sign) group leads by inquiry date,
 * like the monthly "Results" rows in the Inquiry Log. "Monthly signings" and
 * "Active prospects" group by the date they happened, like Offensive Stats.
 */
import { SOURCES, PROGRAMS, LOST_REASONS, STAGES, CLOSED_STAGES } from "./constants.js";
import { pd, daysBetween } from "./dates.js";

export const inRange = (d, r) => !!d && d >= r.from && d <= r.to;
export const pct = (a, b) => (b ? a / b : null);

function trialsByLead(state) {
  const m = new Map();
  for (const t of state.trials) { if (!m.has(t.lead_id)) m.set(t.lead_id, []); m.get(t.lead_id).push(t); }
  return m;
}
export function isProspect(lead, trials) {
  return (trials || []).some((t) => t.status === "attended") || ["trial_completed", "decision", "enrolled"].includes(lead.stage);
}
export const isQualified = (lead) => lead.qualified !== false;
export const isSigned = (lead) => lead.stage === "enrolled";

/** Months "YYYY-MM" from `from` to `to`, inclusive. */
export function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
export function monthRange(key) {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}

function countFunnel(leads, tbl) {
  let inquiries = 0, qualified = 0, prospects = 0, signs = 0;
  for (const l of leads) {
    inquiries++;
    if (isQualified(l)) qualified++;
    if (isProspect(l, tbl.get(l.id))) prospects++;
    if (isSigned(l)) signs++;
  }
  return {
    inquiries, qualified, prospects, signs,
    inquiryToLead: pct(qualified, inquiries),
    leadToProspect: pct(prospects, qualified),
    inquiryToProspect: pct(prospects, inquiries),
    prospectToSign: pct(signs, prospects),
    inquiryToSign: pct(signs, inquiries),
  };
}

/** Funnel for leads whose inquiry date falls in the range. */
export function funnel(state, range) {
  const tbl = trialsByLead(state);
  return countFunnel(state.leads.filter((l) => inRange(l.inquiry_date, range)), tbl);
}

/** One row per month, matching the Offensive Stats tab. */
export function monthlyTable(state, months) {
  const tbl = trialsByLead(state);
  return months.map((key) => {
    const r = monthRange(key);
    const cohort = state.leads.filter((l) => inRange(l.inquiry_date, r));
    const f = countFunnel(cohort, tbl);
    const activeProspects = new Set(state.trials.filter((t) => t.status === "attended" && inRange(t.scheduled_at.slice(0, 10), r)).map((t) => t.lead_id)).size;
    const signings = state.leads.filter((l) => isSigned(l) && inRange(l.enrolled_on, r)).length;
    const src = {};
    for (const l of cohort) src[l.source] = (src[l.source] || 0) + 1;
    const top = Object.entries(src).sort((a, b) => b[1] - a[1])[0];
    return { key, ...f, activeProspects, signings, signingRate: pct(signings, activeProspects), topSource: top ? top[0] : null };
  });
}

export function totalsRow(rows) {
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const t = { inquiries: sum("inquiries"), qualified: sum("qualified"), prospects: sum("prospects"), signs: sum("signs"),
    activeProspects: sum("activeProspects"), signings: sum("signings") };
  return { ...t, inquiryToProspect: pct(t.prospects, t.inquiries), prospectToSign: pct(t.signs, t.prospects),
    signingRate: pct(t.signings, t.activeProspects), inquiryToSign: pct(t.signs, t.inquiries) };
}

/** Per-source funnel with spend, cost per lead and cost per signing (Marketing Stats tab). */
export function bySource(state, range) {
  const tbl = trialsByLead(state);
  const months = new Set(monthsBetween(range.from, range.to));
  const spend = {};
  for (const s of state.marketing_spend) if (months.has(s.month)) spend[s.source] = (spend[s.source] || 0) + Number(s.amount || 0);
  const leads = state.leads.filter((l) => inRange(l.inquiry_date, range));
  return SOURCES.map((s) => {
    const f = countFunnel(leads.filter((l) => l.source === s.key), tbl);
    const cost = spend[s.key] || 0;
    return { source: s.key, label: s.label, paid: s.paid, ...f, spend: cost,
      costPerLead: cost && f.qualified ? cost / f.qualified : null,
      costPerSign: cost ? (f.signs ? cost / f.signs : Infinity) : null };
  }).filter((r) => r.inquiries || r.spend);
}

export function byProgram(state, range) {
  const tbl = trialsByLead(state);
  const leads = state.leads.filter((l) => inRange(l.inquiry_date, range));
  return PROGRAMS.map((p) => ({ program: p.key, label: p.label, ...countFunnel(leads.filter((l) => l.program_interest === p.key), tbl) }));
}

export function lostReasons(state, range) {
  const lost = state.leads.filter((l) => l.stage === "lost" && inRange(l.inquiry_date, range));
  return LOST_REASONS.map((r) => ({ reason: r.key, label: r.label, count: lost.filter((l) => l.lost_reason === r.key).length }))
    .filter((r) => r.count).sort((a, b) => b.count - a.count);
}

/** Trials that happened in the range: show rate and what they turned into. */
export function trialStats(state, range) {
  const leadById = new Map(state.leads.map((l) => [l.id, l]));
  const ts = state.trials.filter((t) => inRange(t.scheduled_at.slice(0, 10), range) && t.status !== "rescheduled");
  const done = ts.filter((t) => t.status === "attended" || t.status === "no_show");
  const attended = ts.filter((t) => t.status === "attended");
  const signed = attended.filter((t) => leadById.get(t.lead_id)?.stage === "enrolled");
  const byInstructor = {};
  for (const t of attended) {
    const k = t.instructor_id || "none";
    byInstructor[k] ??= { attended: 0, signed: 0 };
    byInstructor[k].attended++;
    if (leadById.get(t.lead_id)?.stage === "enrolled") byInstructor[k].signed++;
  }
  const byOffer = {};
  for (const t of attended) {
    byOffer[t.offer] ??= { attended: 0, signed: 0 };
    byOffer[t.offer].attended++;
    if (leadById.get(t.lead_id)?.stage === "enrolled") byOffer[t.offer].signed++;
  }
  return {
    booked: ts.length, attended: attended.length, noShows: done.length - attended.length,
    upcoming: ts.filter((t) => t.status === "scheduled").length,
    showRate: pct(attended.length, done.length), trialToSign: pct(signed.length, attended.length),
    byInstructor, byOffer,
  };
}

/** How fast and how hard we work leads. */
export function velocity(state, range) {
  const acts = new Map();
  for (const a of state.activities) { if (!acts.has(a.lead_id)) acts.set(a.lead_id, []); acts.get(a.lead_id).push(a); }
  const cohort = state.leads.filter((l) => inRange(l.inquiry_date, range));
  const firstTouchHours = [];
  let sameDay = 0, contacted = 0;
  for (const l of cohort) {
    const list = (acts.get(l.id) || []).slice().sort((a, b) => (a.at < b.at ? -1 : 1));
    const created = list.find((a) => a.kind === "system")?.at || l.inquiry_date + "T09:00:00";
    const first = list.find((a) => a.kind === "contact");
    if (!first) continue;
    contacted++;
    const h = (new Date(first.at) - new Date(created)) / 3600000;
    firstTouchHours.push(Math.max(0, h));
    if (first.at.slice(0, 10) === l.inquiry_date) sameDay++;
  }
  const enrolled = state.leads.filter((l) => isSigned(l) && inRange(l.enrolled_on, range));
  const daysToSign = enrolled.map((l) => daysBetween(pd(l.inquiry_date), pd(l.enrolled_on))).filter((d) => d >= 0);
  const touchesToSign = enrolled.map((l) => (acts.get(l.id) || []).filter((a) => a.kind === "contact").length);
  return {
    medianFirstTouchHours: median(firstTouchHours), sameDayRate: pct(sameDay, contacted), contacted, cohort: cohort.length,
    medianDaysToSign: median(daysToSign), avgTouchesToSign: touchesToSign.length ? touchesToSign.reduce((a, b) => a + b, 0) / touchesToSign.length : null,
  };
}

/** Contacts logged per staff member in the range. */
export function staffActivity(state, range) {
  const out = {};
  for (const a of state.activities) {
    if (a.kind !== "contact" || !inRange(a.at.slice(0, 10), range)) continue;
    const k = a.staff_id || "none";
    out[k] ??= { contacts: 0, reached: 0 };
    out[k].contacts++;
    if (a.outcome === "reached" || a.outcome === "replied") out[k].reached++;
  }
  return out;
}

/** What new students signed up for, by enrollment date. */
export function enrollmentMix(state, range) {
  const ms = new Map(state.memberships.map((m) => [m.id, m]));
  const rows = {};
  let pif = 0, total = 0;
  for (const l of state.leads) {
    if (!isSigned(l) || !inRange(l.enrolled_on, range)) continue;
    const m = ms.get(l.membership_id);
    const k = m?.membership || "Unknown";
    rows[k] ??= { membership: k, monthly: 0, pif: 0 };
    if (m?.payment_type === "PIF") { rows[k].pif++; pif++; } else rows[k].monthly++;
    total++;
  }
  return { rows: Object.values(rows).sort((a, b) => b.monthly + b.pif - a.monthly - a.pif), pifShare: pct(pif, total), total };
}

/** Current pipeline: how many leads sit in each stage right now. */
export function pipelineNow(state) {
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0]));
  for (const l of state.leads) counts[l.stage]++;
  return counts;
}

export function openLeads(state) {
  return state.leads.filter((l) => !CLOSED_STAGES.includes(l.stage));
}

function median(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
