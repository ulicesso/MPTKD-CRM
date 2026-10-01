/* Display formatting shared by every page. */
export const money = (n) => (n == null || !isFinite(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
export const money2 = (n) => (n == null || !isFinite(n) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const pct = (x, digits = 0) => (x == null || !isFinite(x) ? "—" : (x * 100).toFixed(digits) + "%");
export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
export function fmtAge(age) {
  if (age == null || age === "") return "";
  const n = Number(age);
  if (!isFinite(n)) return String(age);
  return Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, "");
}
export function telHref(phone) { return "tel:" + String(phone || "").replace(/[^\d+]/g, ""); }
export function smsHref(phone) { return "sms:" + String(phone || "").replace(/[^\d+]/g, ""); }
