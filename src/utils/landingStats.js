/**
 * Display rules for landing page metrics (match prior marketing copy: "100+" for large counts).
 * @param {"active_students"|"monthly_visits"|"office_staff"} key
 * @param {unknown} n
 */
export function formatLandingMetric(key, n) {
  const num = typeof n === "number" && !Number.isNaN(n) ? n : null;
  if (num === null) return "—";
  if (key === "office_staff") return String(num);
  return num >= 100 ? `${num}+` : String(num);
}
