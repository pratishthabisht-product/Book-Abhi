/* Customer itinerary building blocks — Book Abhi design system v1. */
import { esc } from "../lib/format.js";

/* ---------- 9. GENERATE: customer document blocks (design system v1) ---------- */
export const ICO = {
  bag: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M9 11v5M15 11v5"/></svg>',
  cabin: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="11" rx="2"/><path d="M10 8V5h4v3M9 21h.01M15 21h.01"/></svg>',
  alert: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  clock: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  swap: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7.5"/></svg>',
  user: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  plane: '<img class="pl" alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48ZyB0cmFuc2Zvcm09InJvdGF0ZSg5MCAxMiAxMikiPjxwYXRoIGZpbGw9IiMxQjI3NjYiIGQ9Ik0yMSAxNnYtMmwtOC01VjMuNWExLjUgMS41IDAgMCAwLTMgMFY5bC04IDV2Mmw4LTIuNVYxOWwtMiAxLjVWMjJsMy41LTEgMy41IDF2LTEuNUwxMyAxOXYtNS41bDggMi41eiIvPjwvZz48L3N2Zz4=">',
};
export const LOGO = (sz) => `<svg width="${sz}" height="${sz}" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#1B2766"/><path d="M11 27.5 20.5 20 11 12.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 27.5 29.5 20 20 12.5" fill="none" stroke="#F4A51C" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function docBlocks(model, A, settings) {
  const e = esc, B = [];
  const add = (html, gap = 14, keep = false) => B.push({ html, gap, keep });
  const segs = model.segments;
  const tm = (p, off) => `${e(p.time)}${off > 0 ? `<sup class="plus">+${off}</sup>` : ""}`;
  const status = model.booking.status || "Confirmed";
  // header
  add(`<header class="hdr"><div class="brand">${LOGO(36)}<div><div class="wm">BOOK <span>ABHI</span></div><div class="tagline">Your Travel Booking Partner</div></div></div>
    <div class="hdr-r"><span class="status">${ICO.check}Booking ${e(status)}</span>
    <div class="hdr-meta">Booking Reference <b>${e(model.booking.ref)}</b></div>
    ${model.booking.bookedOn ? `<div class="hdr-meta m2">Booked on <span>${e(model.booking.bookedOn)}</span></div>` : ""}</div></header>`, 0);
  // passengers
  add(`<section class="pax">${ICO.user}<div class="lbl">${A.multiPax ? `Passengers (${model.passengers.length})` : "Passenger"}</div><div class="pax-list">${
    model.passengers.map((p, i) => `<div>${A.multiPax ? `<span class="pax-n">${i + 1}.</span>` : ""}<span class="pax-name">${e(p.name)}</span><span class="pax-type">${e(p.type)}${p.title ? " · " + e(p.title) : ""}</span></div>`).join("")}</div></section>`, 0);
  // hero
  const J = A.journeys, J0 = J[0];
  const rows = J.map(j => `<div class="hrow${J.length > 1 ? " multi" : ""}">${J.length > 1 ? `<div class="hrow-tag">${e(j.label)}</div>` : ""}<div class="hrow-main">
    <span class="h-date">${e(j.fromWd)}, ${e(j.from.date)}</span><span class="h-time">${e(j.from.time)}<span class="to">→</span>${tm(j.to, j.dayOffset)}</span>
    <span class="h-pill"><b>${e(j.total)}</b><span class="dot">·</span>${e(j.stopsText)}${j.via.length ? " via " + e(j.via.join(", ")) : ""}</span>
    <span class="h-pill">${j.segments.map(s => `${e(s.airline)} · <b>${e(s.flight)}</b>`).join('<span class="dot">+</span>')}</span></div></div>`).join("");
  add(`<section class="hero"><div class="hero-top"><span class="lbl">Your journey</span><span class="trip-chip">${e(A.tripType)}${J.length === 1 ? " · " + e(J0.stopsText) : ""}</span></div>
    <div class="hero-title">${e(J0.from.city)} <span class="arr">${A.tripType === "Round trip" ? "⇄" : "→"}</span> ${e(A.tripType === "Round trip" ? J0.to.city : J[J.length - 1].to.city)}</div>
    ${J.length === 1 && J0.stops > 0 ? `<div class="hero-route">${e(J0.codes.join("  →  "))}</div>` : ""}<div class="hero-rows">${rows}</div></section>`, 0);
  // self-transfer banner
  A.conns.filter(c => c.selfTransfer).forEach(c => add(`<div class="banner danger">${ICO.alert}<div><h4>Important — Self transfer in ${e(c.city)}</h4>
    <p>Your flights are on separate bookings and are not connected by the airline. In ${e(c.city)} you may need to:</p>
    <ul><li>Collect your baggage</li><li>Clear immigration / customs</li><li>Check in again for your next flight${c.terminalChange ? ` at Terminal ${e(c.tTo)}` : ""}</li></ul></div></div>`, 14));
  // flights
  const card = (s, idx, total) => `<div class="card"><div class="card-h"><div class="al"><div class="al-badge">${e(s.airlineCode || s.flight.slice(0, 2))}</div><div>
    <div class="al-name">${total > 1 ? `<span class="seg-no">Flight ${idx} of ${total}</span> ` : ""}${e(s.airline)} · ${e(s.flight)}</div>
    <div class="al-sub">${[s.cabin ? e(s.cabin) + (s.bookingClass ? ` (${e(s.bookingClass)})` : "") : "", e(s.status)].filter(Boolean).join(" · ")}</div></div></div>
    ${s.pnr && (A.pnrs.length > 1 || !A.singleSegment) ? `<span class="pnr-chip"><span class="lbl">${e(s.airlineCode)} PNR</span><b>${e(s.pnr)}</b></span>` : ""}</div>
    <div class="tl">${["from", "to"].map(side => { const p = s[side], r = side === "to";
      return `<div class="pt${r ? " r" : ""}"><div class="code">${e(p.code)}</div><div class="city">${e(p.city)}</div><div class="apt">${e(p.airport)}</div>
      <div class="when"><span class="time">${r ? tm(p, s._dayOffset) : e(p.time)}</span><span class="date${r && s._dayOffset > 0 ? " nd" : ""}">${e(r ? s._toWd : s._fromWd)}, ${e(p.date)}${r && s._dayOffset === 1 ? " · next day" : ""}</span></div>
      ${p.terminal ? `<span class="term">Terminal ${e(p.terminal)}</span>` : ""}</div>`; }).join(`<div class="mid"><div class="dur">${e(s.duration)}</div><div class="track"><span class="nd1"></span>${ICO.plane}<span class="nd2"></span></div><div class="stop">${e(s.stops)}</div></div>`)}</div>
    ${A.singleSegment ? "" : `<div class="card-f">${[["Aircraft", s.aircraft], ["Meal", s.meal], ["Check-in bag", s.bagCheckin], ["Cabin bag", s.bagCabin]].filter(x => x[1]).map(x => `<span><span class="lbl">${x[0]}</span><b>${e(x[1])}</b></span>`).join("")}${s.checkinNote ? `<span class="ci">${e(s.checkinNote)}</span>` : ""}</div>`}</div>`;
  const conn = c => `<div class="conn${c.selfTransfer ? " st" : ""}"><span class="lay${c.long ? " long" : ""}">${ICO.clock}<b>${e(c.text)}</b> ${c.long ? "long " : ""}layover <span class="where">· ${e(c.city)} (${e(c.code)})</span></span>${
    c.terminalChange ? `<span class="flag warn">${ICO.swap}Terminal change · T${e(c.tFrom)} → T${e(c.tTo)}</span>` : ""}${
    c.airportChange ? `<span class="flag warn">${ICO.swap}Airport change · ${e(c.fromAirport)} → ${e(c.toAirport)}</span>` : ""}${
    c.overnight ? `<span class="flag info">Overnight connection</span>` : ""}${
    c.selfTransfer ? `<div class="conn-st"><h5>${ICO.alert}Self transfer</h5><p>Collect your baggage, clear immigration/customs and check in again for your next flight.</p></div>` : ""}</div>`;
  J.forEach(j => {
    if (J.length > 1) add(`<div class="leg-h"><span class="leg-tag${j.label === "Return" ? " ret" : ""}">${e(j.label)}</span><span class="r">${e(j.from.city)} → ${e(j.to.city)}</span><span class="d">${e(j.fromWd)}, ${e(j.from.date)}</span><span class="ln"></span></div>`, 16, true);
    else add(`<div class="sec-h"><h3>Flight itinerary</h3><span class="aside">${j.segments.length > 1 ? `${j.segments.length} flights · ${e(j.total)} total · ` : ""}All times are local</span></div>`, 16, true);
    j.segments.forEach((s, i) => {
      add(card(s, i + 1, j.segments.length), J.length > 1 ? 0 : 0);
      if (i < j.connections.length) add(conn(j.connections[i]), 0);
    });
  });
  // details table
  if (A.singleSegment) {
    const s = segs[0];
    const rows = [["Airline", s.airline], ["Flight", s.flight], ["Cabin", s.cabin && s.cabin + (s.bookingClass ? ` (${s.bookingClass})` : "")],
      ["Duration", s.duration && s.duration + (s.stops ? " · " + s.stops : "")], ["Aircraft", s.aircraft], ["Meal", s.meal],
      ["Departure terminal", s.from.terminal && "Terminal " + s.from.terminal], ["Arrival terminal", s.to.terminal && "Terminal " + s.to.terminal],
      ["Est. CO₂ emissions", model.extras && model.extras.co2]].filter(r => r[1]);
    if (rows.length % 2) rows.push(["", ""]);
    add(`<section><div class="sec-h"><h3>Flight details</h3></div><div class="dt">${rows.map((r, i) => `<div class="row${i >= rows.length - 2 ? " last" : ""}"><span class="k">${e(r[0])}</span><span class="v">${e(r[1])}</span></div>`).join("")}</div></section>`, 14);
  }
  // baggage + booking
  let bag;
  if (A.bagVaries) {
    const nums = segs.map(s => parseInt(s.bagCheckin)).filter(n => !isNaN(n)); const min = Math.min(...nums);
    bag = `<div class="bag-warn">${ICO.alert}Baggage allowance varies by flight</div>` + segs.map(s => `<div class="bag-seg"><div class="r">${e(s.from.code)} → ${e(s.to.code)}<small>${e(s.airline)} · ${e(s.flight)}</small></div>
      <div class="q${parseInt(s.bagCheckin) === min && nums.length > 1 ? " hl" : ""}"><b>${e(s.bagCheckin || "—")}</b><small>Check-in</small></div><div class="q"><b>${e(s.bagCabin || "—")}</b><small>Cabin</small></div></div>`).join("");
  } else {
    const s = segs[0];
    bag = (s.bagCheckin || s.bagCabin) ? `<div class="bag-big">${s.bagCheckin ? `<div class="bag-it"><div class="ib">${ICO.bag}</div><div><div class="v">${e(s.bagCheckin)}</div><div class="k">Check-in baggage</div></div></div>` : ""}${
      s.bagCabin ? `<div class="bag-it"><div class="ib">${ICO.cabin}</div><div><div class="v">${e(s.bagCabin)}</div><div class="k">Cabin baggage</div></div></div>` : ""}</div>${segs.length > 1 ? `<div class="same">Same allowance on all ${segs.length} flights.</div>` : ""}`
      : `<div class="same">Not stated in the booking.</div>`;
  }
  const kv = (label, inner, wide) => `<div class="kv${wide ? " wide" : ""}"><div class="lbl">${label}</div>${inner}</div>`;
  const tPax = model.passengers.filter(p => p.ticket), tSeg = segs.filter(s => s.ticket);
  let bk = kv("Booking reference", `<div class="v">${e(model.booking.ref)}</div>`);
  if (A.pnrs.length) bk += A.pnrs.length === 1 ? kv("Airline reference (PNR)", `<div class="v">${e(A.pnrs[0])}<span class="s">${e(A.airlines.join(", "))}</span></div>`)
    : kv("Airline references (PNR)", A.pnrGroups.map(g => `<div class="v">${e(g.pnr)}<span class="s">${e(g.codes.join(" → "))} · ${e(g.airline)}</span></div>`).join(""), true);
  if (tPax.length || tSeg.length) {
    const many = tPax.length + tSeg.length > 1;
    bk += kv(`E-ticket number${many ? "s" : ""}`, tPax.map(p => `<div class="v">${e(p.ticket)}${A.multiPax ? `<span class="s">${e(p.name)}</span>` : ""}</div>`).join("") +
      tSeg.map(s => `<div class="v">${e(s.ticket)}<span class="s">${e(s.from.code)} → ${e(s.to.code)} · ${e(s.flight)}</span></div>`).join(""), many);
  }
  bk += kv("Booking status", `<div class="ok">${ICO.check}${e(status)}</div>`);
  add(`<section class="duo"><div class="panel"><div class="sec-h"><h3>Baggage allowance</h3></div>${bag}</div>
    <div class="panel"><div class="sec-h"><h3>Booking &amp; ticket details</h3></div><div class="kvs">${bk}</div></div></section>`, 14);
  // important information
  if (A.notes.length) {
    add(`<div class="sec-h"><h3>Important information</h3></div>`, 14, true);
    A.notes.forEach((n, i) => add(`<div class="note ${n[0]}">${n[0] === "info" ? ICO.info : ICO.alert}<div><b>${e(n[1])}</b><span>${e(n[2])}</span></div></div>`, i ? 7 : 0));
  }
  // footer
  add(`<footer><div class="foot"><div class="brand">${LOGO(26)}<div><div class="wm sm">BOOK <span>ABHI</span></div><div class="tagline">Your Travel Booking Partner</div></div></div>
    ${settings.phone || settings.email ? `<div class="sup">Customer Support<br>${[settings.phone && `Phone <b>${e(settings.phone)}</b>`, settings.email && `Email <b>${e(settings.email)}</b>`].filter(Boolean).join(" &nbsp;·&nbsp; ")}</div>` : ""}</div>
    <div class="disc">Please verify your flight timings, terminal and baggage allowance before travelling.</div>
    <div class="src">Flights are operated by the airlines named above. Book Abhi is your booking partner and does not operate any flight.</div></footer>`, 16);
  return B;
}
