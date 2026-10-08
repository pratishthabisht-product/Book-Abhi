/* Deterministic parser for the booking portal's Amadeus-style "TRAVEL SUMMARY" PDF.
   Every value is copied from the document. Fields that cannot be read are flagged
   "missing" / "review" in the confidence map instead of being guessed. */
import { MON, TITLES, tc, fixAircraft, airlineName, monIdx, fmtDate, fmtDur } from "../lib/format.js";

export function linesFromItems(pages) {
  // pages: [{items:[{str, transform:[a,b,c,d,x,y], width}]}]
  const out = [];
  for (const pg of pages) {
    const rows = new Map();
    let minX = Infinity;
    for (const it of pg.items) {
      if (!it.str) continue;
      const size = Math.abs(it.transform[0]) || 10;
      const y = Math.round(it.transform[5] / (size * 0.5));
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: it.str, cw: size * 0.6 });
      minX = Math.min(minX, it.transform[4]);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const parts = rows.get(y).sort((a, b) => a.x - b.x);
      let line = "";
      for (const p of parts) {
        const col = Math.round((p.x - minX) / p.cw);
        if (col > line.length) line += " ".repeat(col - line.length);
        else if (line.length && !line.endsWith(" ") && !p.s.startsWith(" ")) line += " ";
        line += p.s;
      }
      out.push(line.replace(/\s+$/, ""));
    }
    out.push("");
  }
  return out.join("\n");
}

/* ---------- 2-3. EXTRACT + UNDERSTAND (Amadeus-style travel summary) ---------- */
export function classify(text) {
  const t = text || "";
  if (t.replace(/\s/g, "").length < 40) return "empty";
  const flighty = /\bFLIGHT\b/i.test(t) && /\b(DEPARTURE|DEPART|ARRIVAL|ARRIVE)\b/i.test(t) && /\b[A-Z0-9]{2}\s?\d{2,4}\b/.test(t);
  return flighty ? "flight" : "other";
}

function splitBookings(text) {
  const parts = text.split(/(?=^-{20,}\s*\nTRAVEL SUMMARY)/m).filter(p => /TRAVEL SUMMARY/.test(p));
  return parts.length ? parts : [text];
}

export function parseBooking(text) {
  const conf = {};
  const set = (path, v, c) => { conf[path] = v ? (c || "ok") : "missing"; return v || ""; };
  const g = (re) => { const m = re.exec(text); return m ? m : null; };
  const model = { booking: {}, passengers: [], segments: [], extras: {}, notes: [], flags: {} };

  let m = g(/BOOKING REF:\s*([A-Z0-9]{5,8})\b/);
  model.booking.ref = set("booking.ref", m && m[1]);
  m = g(/\bDATE:\s+(\d{1,2}) ([A-Z]{3}) (\d{4})/);
  model.booking.bookedOn = set("booking.bookedOn", m && fmtDate(m[1], m[2], m[3]));
  model.booking.status = set("booking.status", /RESERVATION CONFIRMED/.test(text) ? "Confirmed" : "", "ok");

  // passengers: summary block names + ticket lines
  const pax = new Map();
  const sumBlock = (/TRAVEL SUMMARY\s*\n([\s\S]*?)\nDATE\s+DEP/.exec(text) || [, ""])[1];
  for (const ln of sumBlock.split("\n")) {
    const pm = new RegExp(`^\\s*([A-Z][A-Z' -]+?)\\/(${TITLES})\\s*$`).exec(ln);
    if (pm) pax.set(pm[1].trim(), { name: pm[1].trim(), title: tc(pm[2]), type: /MSTR|MISS/.test(pm[2]) ? "Child" : "Adult", ticket: "" });
  }
  const tickets = [];
  const tre = new RegExp(`TICKET:\\s*([A-Z0-9]{2})\\/ETKT\\s+(\\d{3}\\s?\\d{10})\\s+FOR\\s+([A-Z][A-Z' -]+?)\\/(${TITLES})\\b`, "g");
  while ((m = tre.exec(text))) {
    const name = m[3].trim();
    tickets.push({ airline: m[1], number: m[2].replace(/\s/g, ""), name });
    if (!pax.has(name)) pax.set(name, { name, title: tc(m[4]), type: /MSTR|MISS/.test(m[4]) ? "Child" : "Adult", ticket: "" });
  }
  model.passengers = [...pax.values()];

  // summary table rows -> IATA codes per flight
  const codes = {};
  const rre = /^\s*\d{2}[A-Z]{3}\s+\d{4}\s+(.+?)\s([A-Z]{3})\s+(.+?)\s([A-Z]{3})\s+([A-Z0-9]{2}\d{1,4})\b/gm;
  while ((m = rre.exec(text))) codes[m[5]] = { from: m[2], to: m[4] };

  // flight blocks
  const fre = /^FLIGHT\s+([A-Z0-9]{2})\s?(\d{1,4})\s+-\s+(.+?)\s{2,}([A-Z]{3})\s+(\d{2}) ([A-Z]{3}) (\d{4})\s*$/gm;
  const heads = [];
  while ((m = fre.exec(text))) heads.push({ m, idx: m.index });
  const ticketsSection = text.indexOf("FLIGHT TICKET");
  heads.forEach((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].idx : (ticketsSection > h.idx ? ticketsSection : text.length);
    const b = text.slice(h.idx, end);
    const [, ac, num, aname, , dd, mon, yyyy] = h.m;
    const k = `segments.${i}.`;
    const flight = ac + num;
    const s = { airline: "", airlineCode: ac, flight: "", cabin: "", bookingClass: "", status: "", duration: "", stops: "",
                aircraft: "", meal: "", bagCheckin: "", bagCabin: "", pnr: "", ticket: "", checkinNote: "", selfTransferAfter: false,
                from: {}, to: {} };
    s.airline = set(k + "airline", airlineName(aname));
    s.flight = set(k + "flight", flight);
    const pt = (label, side) => {
      const pm = new RegExp(`${label}:\\s*([A-Z .'-]+?),\\s*([A-Z]{2})\\s*\\(([^)]+)\\)(?:,\\s*TERMINAL\\s*(\\w+))?[ \\t]*(?:(\\d{2}) ([A-Z]{3})\\s+(\\d{2}:\\d{2}))?[ \\t]*$`, "m").exec(b);
      const p = {};
      const kk = k + side + ".";
      p.city = set(kk + "city", pm && tc(pm[1].trim()));
      p.airport = set(kk + "airport", pm && tc(pm[3].trim()));
      p.terminal = pm && pm[4] ? pm[4] : "";
      conf[kk + "terminal"] = pm && pm[4] ? "ok" : (pm && /TERMINAL\s*$/m.test(b.split("\n").find(l => l.startsWith(label)) || "") ? "review" : "absent");
      const cd = codes[flight] && codes[flight][side];
      p.code = set(kk + "code", cd);
      if (pm && pm[5]) {
        let yr = +yyyy;
        if (side === "to" && monIdx(pm[6]) < monIdx(mon)) yr += 1;
        p.date = set(kk + "date", fmtDate(pm[5], pm[6], yr), yr !== +yyyy ? "review" : "ok");
        p.time = set(kk + "time", pm[7]);
      } else {
        p.date = set(kk + "date", side === "from" ? fmtDate(dd, mon, yyyy) : "", "review");
        p.time = set(kk + "time", "");
      }
      return p;
    };
    s.from = pt("DEPARTURE", "from");
    s.to = pt("ARRIVAL", "to");
    let x = /RESERVATION (\w+),\s*([A-Z ]+?)\s*\((\w)\)/.exec(b);
    s.status = set(k + "status", x && tc(x[1]));
    s.cabin = set(k + "cabin", x && tc(x[2]));
    s.bookingClass = x ? x[3] : "";
    x = /DURATION:\s*(\d{1,2}):(\d{2})/.exec(b);
    s.duration = set(k + "duration", x && fmtDur(+x[1] * 60 + +x[2]));
    x = /BAGGAGE ALLOWANCE:\s*(\d+)\s*(K|KG|PC)\b/.exec(b);
    s.bagCheckin = set(k + "bagCheckin", x && (x[2] === "PC" ? `${x[1]} PC` : `${x[1]} KG`));
    x = /CABIN BAGGAGE:\s*(\d+)\s*(K|KG|PC)\b/.exec(b);
    s.bagCabin = x ? (x[2] === "PC" ? `${x[1]} PC` : `${x[1]} KG`) : "";
    conf[k + "bagCabin"] = x ? "ok" : "absent";
    x = /MEAL:\s*(.+?)\s*$/m.exec(b);
    s.meal = x ? tc(x[1]) : ""; conf[k + "meal"] = x ? "ok" : "absent";
    x = /EQUIPMENT:\s*(.+?)\s*$/m.exec(b);
    s.aircraft = x ? fixAircraft(x[1]) : ""; conf[k + "aircraft"] = x ? "ok" : "absent";
    x = /FLIGHT BOOKING REF:\s*([A-Z0-9]{2})\/([A-Z0-9]{5,8})/.exec(b);
    s.pnr = set(k + "pnr", x && x[2], "ok");
    x = /^(NON STOP|\d STOPS?)\b/m.exec(b);
    s.stops = x ? (x[1] === "NON STOP" ? "Non-stop" : tc(x[1])) : "";
    x = /^\s*((?:ONLINE|AIRPORT|WEB)\s+CHECK-IN\s+[A-Z ]+?)\s*$/m.exec(b);
    s.checkinNote = x ? x[1].charAt(0) + x[1].slice(1).toLowerCase() : "";
    conf[k + "checkinNote"] = x ? "ok" : "absent";
    model.segments.push(s);
  });

  // tickets: per passenger, or per segment when several carriers ticketed separately
  const byAirline = {};
  tickets.forEach(t => { (byAirline[t.airline] = byAirline[t.airline] || []).push(t); });
  if (model.passengers.length > 1 || tickets.length <= 1) {
    tickets.forEach(t => { const p = model.passengers.find(p => p.name === t.name); if (p && !p.ticket) p.ticket = t.number; });
  } else {
    model.segments.forEach(s => { const t = (byAirline[s.airlineCode] || [])[0]; if (t) s.ticket = t.number; });
    if (!model.segments.some(s => s.ticket)) model.passengers[0].ticket = tickets[0].number;
  }
  model.passengers.forEach((p, i) => {
    conf[`passengers.${i}.name`] = p.name ? "ok" : "missing";
    conf[`passengers.${i}.ticket`] = p.ticket ? "ok" : "absent";
  });
  model.segments.forEach((s, i) => { conf[`segments.${i}.ticket`] = s.ticket ? "ok" : "absent"; });

  // self-transfer flag
  const st = /SELF[- ]?TRANSFER(?: IN| AT)?\s+([A-Z ]+?)(?:\s*-|\s*$)/m.exec(text);
  if (st || /SEPARATE TICKETS/.test(text)) {
    const city = st ? tc(st[1].trim()) : null;
    model.segments.forEach((s, i) => {
      if (i < model.segments.length - 1 && (!city || s.to.city === city)) s.selfTransferAfter = true;
    });
    model.flags.selfTransferSource = true;
    model.notes.push("Flights are booked on separate tickets (self-transfer" + (city ? ` in ${city}` : "") + ").");
  }
  m = g(/CO2 EMISSIONS IS ([\d.]+) KG\/PERSON/);
  model.extras.co2 = m ? `${m[1]} kg per person (ICAO estimate)` : "";
  if (!model.passengers.length) conf["passengers.0.name"] = "missing";
  return { model, conf };
}

export function parseBookingText(text) {
  const kind = classify(text);
  if (kind !== "flight") return { kind, bookings: [] };
  const bookings = splitBookings(text).map(parseBooking).filter(b => b.model.segments.length);
  return { kind: bookings.length ? "flight" : "unparsed", bookings };
}
