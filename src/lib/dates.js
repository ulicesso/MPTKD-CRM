/*
 * Date helpers. The CRM stores calendar dates as "YYYY-MM-DD" strings and
 * timestamps as ISO strings. Calendar dates are always read in local time,
 * so "2026-10-01" never slips to Sept 30 in a US timezone.
 */
export const MS_DAY = 86400000;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse "YYYY-MM-DD" (or the date part of an ISO timestamp) to a local Date. */
export function pd(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function dim(y, m) { return new Date(y, m + 1, 0).getDate(); }
export function daysBetween(a, b) { return Math.round((b - a) / MS_DAY); }
export function addDays(dateStr, n) { const d = pd(dateStr); d.setDate(d.getDate() + n); return iso(d); }
export function todayISO(now = new Date()) { return iso(now); }
export function monthKey(dateStr) { return dateStr ? dateStr.slice(0, 7) : ""; }
export function monthLabel(key, short = false) {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1];
  return short ? name.slice(0, 3) + " " + String(y).slice(2) : name + " " + y;
}
/** Local "YYYY-MM-DDTHH:MM" for a date plus a "5:15pm"-style time. */
export function combineDateTime(dateStr, time) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(time || "").trim());
  if (!m) return dateStr + "T00:00";
  let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12;
  return dateStr + "T" + String(h).padStart(2, "0") + ":" + m[2];
}

export function fmtDate(s, { year = "auto", today } = {}) {
  const d = pd(s); if (!d) return "—";
  const t = today ? pd(today) : new Date();
  const showYear = year === true || (year === "auto" && d.getFullYear() !== t.getFullYear());
  return MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate() + (showYear ? ", " + d.getFullYear() : "");
}
export function fmtTime(isoStr) {
  if (!isoStr || isoStr.length < 16) return "";
  let h = +isoStr.slice(11, 13); const mi = isoStr.slice(14, 16);
  const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12;
  return h + ":" + mi + ap;
}
export function fmtDateTime(isoStr, opts) {
  const t = fmtTime(isoStr);
  return fmtDate(isoStr, opts) + (t && t !== "12:00am" ? " at " + t : "");
}
/** "today", "tomorrow", "in 3 days", "2 days ago". */
export function relDay(s, today) {
  const d = pd(s), t = pd(today); if (!d || !t) return "";
  const n = daysBetween(t, d);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1 && n < 7) return DOW[d.getDay()];
  return n > 0 ? "in " + n + " days" : -n + " days ago";
}
export function ageFrom(birthdate, onDate) {
  const b = pd(birthdate), t = pd(onDate); if (!b || !t) return null;
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

/** Local, timezone-free timestamp "YYYY-MM-DDTHH:MM:SS" (single-location studio time). */
export function localStamp(d = new Date()) {
  return iso(d) + "T" + [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}
