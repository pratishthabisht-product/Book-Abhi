import { parseDT } from "../lib/format.js";

/* ---------- 8. VALIDATE ---------- */
const DATE_RE = /^\d{2} [A-Z][a-z]{2} \d{4}$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validate(model, conf) {
  const issues = []; // {level:'block'|'warn', path, msg}
  const need = (path, v, label, re) => {
    if (!v || !String(v).trim()) issues.push({ level: "block", path, msg: `${label} is missing.` });
    else if (re && !re.test(String(v).trim())) issues.push({ level: "block", path, msg: `${label} "${v}" is not in the expected format.` });
  };
  if (!model.passengers.length) issues.push({ level: "block", path: "passengers.0.name", msg: "No passenger found." });
  model.passengers.forEach((p, i) => need(`passengers.${i}.name`, p.name, `Passenger ${i + 1} name`));
  need("booking.ref", model.booking.ref, "Booking reference");
  model.segments.forEach((s, i) => {
    const n = `Flight ${i + 1}`, k = `segments.${i}.`;
    need(k + "airline", s.airline, `${n} airline`);
    need(k + "flight", s.flight, `${n} flight number`, /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/);
    ["from", "to"].forEach(side => {
      const w = side === "from" ? "departure" : "arrival";
      need(k + side + ".code", s[side].code, `${n} ${w} airport code`, /^[A-Z]{3}$/);
      need(k + side + ".city", s[side].city, `${n} ${w} city`);
      need(k + side + ".date", s[side].date, `${n} ${w} date`, DATE_RE);
      need(k + side + ".time", s[side].time, `${n} ${w} time`, TIME_RE);
    });
    const a = parseDT(s.from), b = parseDT(s.to);
    if (a && b && b < a - 15 * 3600e3) issues.push({ level: "block", path: k + "to.date", msg: `${n} arrives before it departs. Check the dates.` });
    if (!s.duration) issues.push({ level: "warn", path: k + "duration", msg: `${n} duration not found. It will be hidden.` });
    else if (!/^\d+h \d{2}m$/.test(s.duration)) issues.push({ level: "block", path: k + "duration", msg: `${n} duration should look like "3h 25m".` });
    if (!s.bagCheckin) issues.push({ level: "warn", path: k + "bagCheckin", msg: `${n} baggage allowance not found. It will show as "Not stated".` });
  });
  Object.entries(conf || {}).forEach(([path, c]) => {
    if (c === "review" && !issues.some(x => x.path === path)) issues.push({ level: "warn", path, msg: `${labelFor(path)} needs a quick check.` });
  });
  return issues;
}
export function labelFor(path) {
  const p = path.split(".");
  const L = { ref: "Booking reference", bookedOn: "Booking date", status: "Status", name: "Passenger name", ticket: "E-ticket",
    airline: "Airline", flight: "Flight number", cabin: "Cabin", duration: "Duration", bagCheckin: "Check-in baggage", bagCabin: "Cabin baggage",
    pnr: "Airline PNR", aircraft: "Aircraft", meal: "Meal", city: "City", code: "Airport code", airport: "Airport", terminal: "Terminal", date: "Date", time: "Time" };
  const last = L[p[p.length - 1]] || p[p.length - 1];
  if (p[0] === "segments") return `Flight ${+p[1] + 1} ${p.length === 4 ? (p[2] === "from" ? "departure" : "arrival") + " " + last.toLowerCase() : last.toLowerCase()}`;
  return last;
}
