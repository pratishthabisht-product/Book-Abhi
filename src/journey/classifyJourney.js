/* Journey intelligence: derives structure from the extracted segments only.
   Computes journeys (outbound/return/multi-city), layovers, stops, airline/PNR/baggage
   differences, self-transfer, terminal/airport changes, next-day arrival and the
   customer-facing alerts. Nothing here adds facts that are not in the booking. */
import { parseDate, parseDT, weekday, durMin, fmtDur } from "../lib/format.js";

/* ---------- 4. DETERMINE COMPLEXITY ---------- */
export function classifyJourney(model) {
  const segs = model.segments;
  segs.forEach(s => {
    s._fromWd = weekday(s.from); s._toWd = weekday(s.to);
    const a = parseDate(s.from.date), b = parseDate(s.to.date);
    s._dayOffset = a && b ? Math.round((b - a) / 864e5) : 0;
  });
  const journeys = [];
  let cur = null;
  segs.forEach((s, i) => {
    const prev = segs[i - 1];
    let lay = null;
    if (prev) {
      const a = parseDT(prev.to), b = parseDT(s.from);
      lay = a && b ? Math.round((b - a) / 60000) : null;
    }
    const sameCity = prev && (prev.to.code === s.from.code || (prev.to.city && prev.to.city === s.from.city));
    if (!prev || !sameCity || lay == null || lay < 0 || lay > 24 * 60) {
      cur = { segments: [s], connections: [] }; journeys.push(cur);
    } else {
      const c = { after: i - 1, minutes: lay, text: fmtDur(lay), city: prev.to.city, code: prev.to.code,
        long: lay >= 6 * 60, selfTransfer: !!prev.selfTransferAfter,
        airportChange: !!(prev.to.code && s.from.code && prev.to.code !== s.from.code),
        fromAirport: prev.to.airport, toAirport: s.from.airport, tFrom: prev.to.terminal, tTo: s.from.terminal,
        overnight: parseDate(s.from.date) > parseDate(prev.to.date) };
      c.terminalChange = !c.airportChange && !!c.tFrom && !!c.tTo && c.tFrom !== c.tTo;
      cur.connections.push(c); cur.segments.push(s);
    }
  });
  journeys.forEach(j => {
    const f = j.segments[0], l = j.segments[j.segments.length - 1];
    const total = j.segments.reduce((t, s) => t + (durMin(s.duration) || 0), 0) + j.connections.reduce((t, c) => t + c.minutes, 0);
    Object.assign(j, { from: f.from, to: l.to, fromWd: f._fromWd, toWd: l._toWd, total: fmtDur(total),
      stops: j.segments.length - 1, via: j.connections.map(c => c.city),
      codes: [f.from.code, ...j.segments.map(s => s.to.code)],
      dayOffset: (() => { const a = parseDate(f.from.date), b = parseDate(l.to.date); return a && b ? Math.round((b - a) / 864e5) : 0; })(),
      selfTransfer: j.connections.some(c => c.selfTransfer) });
    j.stopsText = j.stops === 0 ? "Non-stop" : `${j.stops} stop${j.stops > 1 ? "s" : ""}`;
  });
  let tripType = "One-way";
  if (journeys.length === 2 && journeys[0].from.city === journeys[1].to.city && journeys[0].to.city === journeys[1].from.city) {
    tripType = "Round trip"; journeys[0].label = "Outbound"; journeys[1].label = "Return";
  } else if (journeys.length > 1) {
    tripType = "Multi-city"; journeys.forEach((j, i) => j.label = `Journey ${i + 1}`);
  }
  const airlines = [...new Set(segs.map(s => s.airline).filter(Boolean))];
  const pnrs = [...new Set(segs.map(s => s.pnr).filter(Boolean))];
  const bagKey = s => `${s.bagCheckin}|${s.bagCabin}`;
  const bagVaries = new Set(segs.map(bagKey)).size > 1;
  const pnrGroups = [];
  segs.forEach(s => {
    if (!s.pnr) return;
    const last = pnrGroups[pnrGroups.length - 1];
    if (last && last.pnr === s.pnr) last.codes.push(s.to.code);
    else pnrGroups.push({ pnr: s.pnr, airline: s.airline, codes: [s.from.code, s.to.code] });
  });
  const conns = journeys.flatMap(j => j.connections);
  const maxStops = Math.max(...journeys.map(j => j.stops));
  const tags = [tripType, maxStops === 0 ? "Non-stop" : `${maxStops} stop${maxStops > 1 ? "s" : ""}`];
  if (airlines.length > 1) tags.push(`${airlines.length} airlines`);
  if (pnrs.length > 1) tags.push(`${pnrs.length} airline PNRs`);
  if (bagVaries) tags.push("Baggage varies");
  if (conns.some(c => c.selfTransfer)) tags.push("Self-transfer");
  if (conns.some(c => c.terminalChange)) tags.push("Terminal change");
  if (conns.some(c => c.airportChange)) tags.push("Airport change");
  if (conns.some(c => c.long)) tags.push("Long layover");
  if (journeys.some(j => j.dayOffset > 0)) tags.push("Next-day arrival");
  if (model.passengers.length > 1) tags.push(`${model.passengers.length} passengers`);

  // important information - only from source facts
  const notes = [];
  conns.forEach(c => {
    if (c.selfTransfer) notes.push(["danger", `Self-transfer in ${c.city}`, "See the warning at the top of this itinerary. You may need to collect baggage, clear immigration/customs and check in again."]);
    if (c.airportChange) notes.push(["warn", "Airport change", `${c.fromAirport} → ${c.toAirport}.`]);
    if (c.terminalChange) notes.push(["warn", `Terminal change in ${c.city}`, `You arrive at Terminal ${c.tFrom} and depart from Terminal ${c.tTo}.`]);
    if (c.long) notes.push(["info", `Long layover in ${c.city}`, `${c.text} between flights at ${c.city} (${c.code}).`]);
  });
  if (bagVaries) notes.push(["warn", "Baggage allowance varies by flight", "Check-in allowance: " + segs.map(s => `${s.bagCheckin || "not stated"} on ${s.from.code} → ${s.to.code}`).join(", ") + "."]);
  if (pnrs.length > 1) notes.push(["info", "Different airline references", "Each airline has its own booking reference (PNR). Use the one shown on each flight."]);
  segs.forEach(s => { if (s.checkinNote) notes.push(["info", `${s.from.code} → ${s.to.code} · ${s.flight}`, s.checkinNote + "."]); });
  journeys.forEach(j => {
    if (j.dayOffset > 0) notes.push(["info", j.dayOffset === 1 ? "Next-day arrival" : `Arrival +${j.dayOffset} days`,
      `${j.label && journeys.length > 1 ? "Your " + j.label.toLowerCase() + " flight arrives" : "You arrive"} in ${j.to.city} on ${j.toWd}, ${j.to.date}.`]);
  });
  (model.notes || []).forEach(t => notes.push(["info", "From your booking", t]));
  const order = { danger: 0, warn: 1, info: 2 };
  notes.sort((a, b) => order[a[0]] - order[b[0]]);
  return { journeys, tripType, airlines, pnrs, pnrGroups, bagVaries, tags, notes, conns,
    selfTransfer: conns.some(c => c.selfTransfer), singleSegment: segs.length === 1, multiPax: model.passengers.length > 1 };
}
