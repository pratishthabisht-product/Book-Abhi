/* Shared formatting / date helpers. */
export const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
export const TITLES = "MR|MRS|MS|MSTR|MISS|DR";


/* ---------- helpers ---------- */
export const tc = s => (s || "").toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\bIntl\b/g, "International");
export const fixAircraft = s => tc(s).replace(/(\d)([a-z]+)\b/g, (m, d, l) => d + (l === "neo" ? l : l.toUpperCase())).replace(/\bMax\b/, "MAX");
export const BRAND = { INDIGO: "IndiGo", FLYDUBAI: "flydubai", "AIR INDIA": "Air India", "AIRASIA": "AirAsia", "SPICEJET": "SpiceJet", KLM: "KLM", "AIR INDIA EXPRESS": "Air India Express" };
export const airlineName = s => BRAND[s.trim().toUpperCase()] || tc(s.trim());
export const monIdx = m => MON.indexOf(String(m).toUpperCase().slice(0, 3));
export function fmtDate(dd, mon, yyyy) { return `${String(+dd).padStart(2, "0")} ${tc(mon.slice(0, 3))} ${yyyy}`; }
export function parseDate(s) {
  const m = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec((s || "").trim());
  if (!m || monIdx(m[2]) < 0) return null;
  return new Date(Date.UTC(+m[3], monIdx(m[2]), +m[1]));
}
export function parseDT(p) {
  const d = parseDate(p.date), t = /^(\d{2}):(\d{2})$/.exec((p.time || "").trim());
  if (!d || !t) return null;
  return new Date(d.getTime() + (+t[1] * 60 + +t[2]) * 60000);
}
export const WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const weekday = p => { const d = parseDate(p.date); return d ? WD[d.getUTCDay()] : ""; };
export const durMin = s => { const m = /(\d+)h\s*(\d+)m/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };
export const fmtDur = m => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
export const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
