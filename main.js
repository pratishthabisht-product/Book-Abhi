/* Book Abhi — AI Flight Itinerary Generator (interview prototype)
   Flow: Landing → Upload → Processing → Review → Preview → Download.
   State lives in memory only; refreshing the page starts over. */
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "./styles/app.css";
import "./styles/itinerary.css";

import { extractBookingData, aiStatus, manualItinerary, reverify } from "./extraction/extractBookingData.js";
import { validate, cloneItinerary, emptyPassenger } from "./model/ItineraryData.js";
import { demoBooking, DEMO_PDF_URL, DEMO_PDF_NAME } from "./model/demoBooking.js";
import { classifyJourney } from "./journey/classifyJourney.js";
import { ItineraryPreview, PAGE_W, PAGE_H } from "./render/ItineraryPreview.js";
import { generatePDF, downloadPDF } from "./pdf/generatePDF.js";
import { esc } from "./lib/format.js";
import { I } from "./ui/icons.js";

const $ = (s, r = document) => r.querySelector(s);
const main = $("#main");
const measureEl = $("#measure"), captureEl = $("#capture");

/* ---------------- state ---------------- */
const S = { ai: { enabled: false, model: null }, view: "landing", file: null, text: "", cur: null, zoom: null, mode: "desktop", page: 1, pages: [], pdf: null, proc: null, err: null, demo: false };
const SAMPLES = [
  ["roundtrip.pdf", "Round trip · 2 passengers"], ["onestop.pdf", "One stop via Dubai"], ["multistop.pdf", "Two stops · 2 airlines"],
  ["multiairline.pdf", "Air India + Emirates · different bags"], ["selftransfer.pdf", "Self-transfer in Dubai"],
  ["partial.pdf", "Missing arrival time"], ["otherlayout.pdf", "Different portal layout"], ["photo_booking.png", "Screenshot of a booking"], ["invalid.pdf", "Damaged file"],
];

/* ---------------- utils ---------------- */
const getP = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const setP = (o, p, v) => { const ks = p.split("."); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const fmtSize = b => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const analyze = it => classifyJourney(cloneItinerary(it));
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; $("#toast").appendChild(t); setTimeout(() => t.remove(), 3200); }
const routeTitle = A => { const J = A.journeys; return `${esc(J[0].from.city || "?")} ${A.tripType === "Round trip" ? "⇄" : "→"} ${esc(A.tripType === "Round trip" ? J[0].to.city : J[J.length - 1].to.city || "?")}`; };

/* ---------------- shell ---------------- */
const STEPS = [["upload", "Upload"], ["review", "Review"], ["preview", "Preview"], ["done", "Download"]];
const stepOf = v => ({ upload: 0, processing: 0, error: 0, review: 1, workspace: 2, done: 3 }[v]);
function paintStepper() {
  const at = stepOf(S.view);
  $("#stepper").innerHTML = at == null ? "" : STEPS.map(([, l], i) => `<span class="st ${i < at ? "past" : i === at ? "now" : ""}"><i>${i < at ? I.check : i + 1}</i>${l}</span>`).join('<span class="sep"></span>');
}
function go(view) { S.view = view; render(); main.scrollTop = 0; }
function render() { paintStepper(); main.innerHTML = VIEWS[S.view](); AFTER[S.view] && AFTER[S.view](); }
const VIEWS = {}, AFTER = {};

/* ================= LANDING ================= */
VIEWS.landing = () => `<div class="page landing"><div class="ld-hero">
  <div class="eyebrow">Book Abhi</div><h1>AI Flight Itinerary Generator</h1>
  <p class="ld-lead">Transform a booking confirmation into a customer-ready travel itinerary.</p>
  <div class="ld-cta"><button class="btn primary lg" data-act="new">${I.plus}Create New Itinerary</button><button class="btn lg" data-act="demo">${I.spark}Use Demo Booking</button></div>
  <p class="ld-note">The demo loads a real Emirates EK512 confirmation from a booking portal. No upload needed.</p></div>
  <div class="ld-flow">
    ${[["Raw booking PDF", "Text-heavy confirmation from the third-party booking portal", I.upload],
       ["Structured booking data", "Passengers, flights, terminals, baggage, PNR and tickets, read from the document", I.list],
       ["Agent review", "Every field is editable and anything uncertain is flagged", I.open],
       ["Customer itinerary", "A branded Book Abhi A4 PDF, ready to send", I.dl]].map(([t, d, ic], i) => `<div class="card ld-step"><span class="ld-n">${ic}</span><b>${t}</b><small>${d}</small></div>${i < 3 ? `<span class="ld-arr">${I.fwd}</span>` : ""}`).join("")}
  </div>
  <p class="ld-foot">Book Abhi doesn't book, change or cancel flights. It only changes how existing booking information is presented. The uploaded document stays the source of truth.</p></div>`;

/* ================= UPLOAD ================= */
VIEWS.upload = () => {
  const f = S.file;
  return `<div class="page"><div class="up">
  <div class="ph"><div><h1>Upload Flight Confirmation</h1><p>Upload the flight confirmation received from your booking portal: a PDF, or a screenshot or photo of it.</p></div>${aiPill()}</div>
  <label class="drop" id="upDrop" for="upFile">${I.upload}<b>Drag &amp; drop your PDF here</b><small>or <span class="link">Browse files</span></small><small>Supported formats: PDF, PNG, JPG</small></label>
  <input type="file" id="upFile" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden>
  ${f ? `<div class="card filechip"><div class="ficon">${/^image\//.test(f.type) ? "IMG" : "PDF"}</div><div class="fm"><div class="fn">${esc(f.name)}</div><div class="fs">${fmtSize(f.size)} · ${f.progress < 100 ? "Uploading… " + f.progress + "%" : "Ready to extract"}</div><div class="bar"><i style="width:${f.progress}%"></i></div></div>
    <button class="btn sm" data-act="replace">Replace</button><button class="btn sm ghost" data-act="remove" title="Remove file">${I.x}</button></div>` : ""}
  <div class="up-actions"><button class="btn" data-act="demo">${I.spark}Use Demo Booking</button>
  <button class="btn primary lg" data-act="extract" ${f && f.progress >= 100 ? "" : "disabled"}>Extract Booking Details${I.fwd}</button></div>
  <div class="samples"><h4>More sample confirmations</h4><p>Made-up bookings that show other journey types, other layouts and error handling. Other layouts and images are read with AI when it's switched on; otherwise you can enter them manually. <a class="link" href="${DEMO_PDF_URL}" download="${DEMO_PDF_NAME}">Download the Emirates sample PDF</a> to try uploading it yourself.</p>
  <div class="sgrid">${SAMPLES.map(([file, label]) => `<button class="sbtn" data-act="sample" data-file="${file}"><b>${esc(label)}</b><small>${file}</small></button>`).join("")}</div></div></div></div>`;
};
AFTER.upload = () => {
  const zone = $("#upDrop"), input = $("#upFile");
  input.addEventListener("change", () => input.files[0] && setFile(input.files[0]));
  ["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("over"); }));
  zone.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });
};
async function setFile(file) {
  const ok = /\.(pdf|png|jpe?g|webp)$/i.test(file.name) || /^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type);
  if (!ok) { toast("Please choose a PDF or an image (PNG, JPG)"); return; }
  if (file.size > 15 * 1048576) { toast("That file is over 15 MB. Please use a smaller file."); return; }
  S.file = { name: file.name, size: file.size, type: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg"), progress: 10, bytes: null };
  if (S.view === "upload") render();
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!S.file) return;
  S.file.bytes = buf;
  for (const p of [45, 80, 100]) { S.file.progress = p; if (S.view === "upload") render(); await sleep(90); }
}
async function fetchSample(file) {
  const r = await fetch("/samples/" + file); const b = await r.blob();
  return new File([b], file, { type: b.type && b.type !== "application/octet-stream" ? b.type : "application/pdf" });
}

/* ================= PROCESSING ================= */
const PSTEPS = [["up", "Booking document uploaded"], ["read", "Reading the document"], ["pax", "Passenger details extracted"], ["flt", "Flight details extracted"], ["bk", "Booking information identified"], ["jr", "Journey structure identified"], ["fin", "Itinerary ready for review"]];
VIEWS.processing = () => {
  const P = S.proc;
  return `<div class="page"><div class="proc"><div class="card steps"><h2>${esc(P.title)}</h2><p class="sub">${esc(S.file ? S.file.name : "")}</p>
  ${PSTEPS.map(([k, label]) => { const st = P.st[k] || "pending"; return `<div class="step ${st}"><div class="ic">${st === "done" ? I.check : st === "warn" || st === "fail" ? I.alert : ""}</div><div><b>${esc(P.label[k] || label)}</b>${P.detail[k] ? `<small>${esc(P.detail[k])}</small>` : ""}</div></div>`; }).join("")}
  ${P.callout || ""}</div>
  <div class="card srcdoc"><div class="hd"><span>Booking portal document</span><span>${P.text ? P.text.split("\n").filter(l => l.trim()).length + " lines read" : P.done ? "No text layer (image)" : "Reading…"}</span></div><pre>${P.text ? highlight(P.text, P.marks || []) : P.done ? "This document is an image, so it was read visually." : ""}</pre></div></div></div>`;
};
function highlight(text, marks) {
  let h = esc(text);
  const vals = [...new Set(marks.filter(v => v && String(v).length >= 3))].sort((a, b) => b.length - a.length);
  for (const v of vals) { const e = esc(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); h = h.replace(new RegExp(`(?<![\\w>])(${e})(?![\\w<])`, "g"), "<mark>$1</mark>"); }
  return h;
}
function marksFor(it) {
  const m = [it.booking.ref];
  it.passengers.forEach(p => { m.push(p.name); if (p.ticket) m.push(p.ticket.replace(/^(\d{3})(\d{10})$/, "$1 $2")); });
  it.segments.forEach(s => m.push(s.pnr, s.from.time, s.to.time, s.from.code, s.to.code, s.flight, s.flight.slice(0, 2) + " " + s.flight.slice(2)));
  return m;
}
async function runExtraction({ demo = false } = {}) {
  S.demo = demo;
  S.proc = { title: "Reading your booking confirmation…", st: {}, detail: {}, label: {}, text: "", marks: [] };
  go("processing");
  const step = (k, st, detail, label) => { S.proc.st[k] = st; if (detail !== undefined) S.proc.detail[k] = detail; if (label) S.proc.label[k] = label; if (S.view === "processing") render(); };
  step("up", "done", fmtSize(S.file.size)); step("read", "active"); await sleep(250);

  let res;
  try {
    res = await extractBookingData(S.file, { onStage: st => { if (st === "ai") step("read", "active", "This layout isn't one the built-in reader knows, so AI is reading it…", "Reading the document with AI"); } });
  } catch (e) { console.error(e); res = { status: "invalid" }; }
  if (demo && res.status !== "ok") res = { status: "ok", method: "rules", itinerary: cloneItinerary(demoBooking.itinerary), confidence: { ...demoBooking.confidence }, findings: [], text: res.text || "" };
  S.proc.done = true;
  if (res.status === "invalid") { step("read", "fail", "This file couldn't be opened."); await sleep(500); return showError("invalid"); }
  if (res.status === "unsupported") { step("read", "fail", "No flight details found."); await sleep(500); return showError("unsupported", res); }
  if (res.status === "needs_ai") { step("read", "fail", "This is a scan or image."); await sleep(500); return showError("needs_ai", res); }

  const it = res.itinerary;
  S.text = res.text || ""; S.proc.text = S.text; S.proc.marks = marksFor(it);
  const how = { rules: "Built-in reader · booking portal travel summary format", ai: `AI reading${res.model ? " (" + res.model + ")" : ""} · every value checked against the document`, manual: "This layout couldn't be read automatically" }[res.method];
  step("read", res.method === "manual" ? "warn" : "done", how);
  S.cur = { it, conf: res.confidence, orig: cloneItinerary(it), edited: {}, sourceName: S.file.name, method: res.method, findings: res.findings || [], model: res.model, check: res.check || null };
  if (res.method === "manual") {
    S.proc.title = "Manual entry needed";
    ["pax", "flt", "bk", "jr", "fin"].forEach(k => step(k, "pending"));
    S.proc.callout = `<div class="callout warn">${I.alert}<div><b>This layout couldn't be read automatically</b><p>${S.ai.enabled ? "AI reading couldn't make sense of it either." : "AI reading isn't switched on for this site, and the built-in reader only knows the portal's travel-summary format."} You can type the details in from the document; the preview and PDF work as normal.</p><button class="btn primary" data-act="to-review-jump">Enter details</button></div></div>`;
    return render();
  }
  await sleep(300); step("pax", "done", it.passengers.map(p => `${p.name || "?"} · ${p.type}`).join(", ") || "No passenger found");
  step("flt", "active"); await sleep(360);
  step("flt", "done", it.segments.map(s => `${s.airline} ${s.flight} · ${s.from.code || "?"} → ${s.to.code || "?"}`).join("   "));
  step("bk", "active"); await sleep(300);
  step("bk", "done", `Booking ref ${it.booking.ref || "not found"}${it.segments.some(s => s.pnr) ? " · Airline PNR " + [...new Set(it.segments.map(s => s.pnr).filter(Boolean))].join(", ") : ""}`);
  step("jr", "active"); await sleep(360);
  step("jr", "done", analyze(it).tags.join(" · "));
  if (res.bookingsFound > 1) toast(`This document holds ${res.bookingsFound} bookings. Showing the first one.`);
  if (res.status === "partial") {
    S.proc.title = "Almost there";
    const n = res.issues.filter(i => i.level === "block").length;
    step("fin", "warn", `${n} field${n > 1 ? "s" : ""} need${n > 1 ? "" : "s"} review`, "Some booking details need review");
    S.proc.callout = `<div class="callout warn">${I.alert}<div><b>Some booking details need review</b><p>Most of the booking was read, but a few fields couldn't be found in the document. Check them and fill in what's missing.</p><button class="btn primary" data-act="to-review-jump">Review Details</button></div></div>`;
    return render();
  }
  step("fin", "done"); S.proc.title = "Booking read"; await sleep(500);
  S.zoom = null; go("review");
}
function startManual() {
  const m = manualItinerary();
  S.cur = { it: m.it, conf: m.conf, orig: cloneItinerary(m.it), edited: {}, sourceName: S.file ? S.file.name : "manual entry", method: "manual", findings: [], check: { parserConf: m.conf, sourceText: S.text || "", sourceIsImage: false } };
  S.zoom = null; go("review");
}
function aiPill() {
  return S.ai.enabled ? `<span class="pill ready" title="Layouts the built-in reader doesn't know are read with ${esc(S.ai.model || "AI")}"><span class="dot"></span>AI reading on</span>`
    : `<span class="pill sample" title="Set ANTHROPIC_API_KEY on the server to read any layout, scans and photos">Built-in reader only</span>`;
}

/* ================= ERRORS ================= */
function showError(kind, res) { S.err = kind; S.errRes = res || null; go("error"); }
VIEWS.error = () => {
  const E = { invalid: ["bad", "Unable to read this PDF.", "The file may be damaged or password-protected. You can try another booking confirmation.", false],
    unsupported: ["warn", "This doesn't look like a flight booking confirmation.", "No flights, departure or arrival details were found in it. You can try another document, or enter the details yourself.", true],
    needs_ai: ["warn", "This document is a scan or an image.", S.ai.enabled ? "AI reading couldn't read it clearly. Try a sharper copy, or enter the details yourself." : "Reading scans and photos needs AI reading, which isn't switched on for this site. You can enter the details yourself instead.", true] }[S.err];
  return `<div class="page"><div class="card err"><div class="eic ${E[0]}">${I.alert}</div><h2>${E[1]}</h2><p>${E[2]}</p>${S.file ? `<div class="fname">${esc(S.file.name)} · ${fmtSize(S.file.size)}</div>` : ""}
  <div class="err-acts"><button class="btn primary lg" data-act="reupload">${I.upload}Upload Another Document</button>${E[3] ? `<button class="btn lg" data-act="manual">${I.open}Enter details manually</button>` : `<button class="btn lg" data-act="demo">Use Demo Booking</button>`}</div></div></div>`;
};

/* ================= REVIEW FORM ================= */
const CRIT = /^(booking\.ref|passengers\.\d+\.name|segments\.\d+\.(airline|flight|(from|to)\.(code|city|date|time)))$/;
const MK = { ok: I.check, review: `${I.alert}Review`, missing: `${I.alert}Needs review`, edited: "Edited", absent: "Not in booking" };
function statusOf(path) {
  const c = S.cur; if (c.edited[path] !== undefined) return "edited";
  const v = getP(c.it, path), st = c.conf[path];
  if (st === "review") return "review";
  if (!v && (st === "missing" || CRIT.test(path))) return "missing";
  if (!v) return "absent";
  return "ok";
}
function field(path, label, o = {}) {
  const v = getP(S.cur.it, path) ?? "", st = statusOf(path);
  const ph = st === "absent" ? "Not in booking" : st === "missing" ? "Enter from booking" : "";
  const input = o.options ? `<select data-path="${path}" id="f-${path}">${o.options.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`
    : `<input data-path="${path}" id="f-${path}" value="${esc(v)}" placeholder="${ph}" autocomplete="off" spellcheck="false"${o.upper ? ' data-upper="1"' : ""}>`;
  const orig = getP(S.cur.orig, path);
  return `<div class="f ${o.cls || ""} st-${st}" data-f="${path}"><label for="f-${path}">${esc(label)}<span class="mk ${st}">${MK[st]}</span></label>
  <div class="in">${input}${st === "edited" && orig !== undefined ? `<button class="rev" data-act="revert" data-path="${path}" title="Restore extracted value: ${esc(orig || "empty")}">${I.undo}</button>` : ""}</div>${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ""}</div>`;
}
function sectionCount(prefix) {
  let rev = 0, miss = 0;
  Object.keys(S.cur.conf).filter(k => k.startsWith(prefix)).forEach(k => { const st = statusOf(k); if (st === "review") rev++; if (st === "missing") miss++; });
  return miss ? `<span class="fcount bad">${miss} need${miss > 1 ? "" : "s"} review</span>` : rev ? `<span class="fcount warn">${rev} to check</span>` : `<span class="fcount ok">Verified</span>`;
}
function formHtml(compact) {
  const it = S.cur.it, A = analyze(it);
  const H = compact ? () => "" : t => t;
  let h = `<details class="card fsec" open><summary><h3>Passenger${it.passengers.length > 1 ? "s" : ""}</h3><span class="sm">${it.passengers.length}</span>${sectionCount("passengers")}${I.chev}</summary><div class="fbody">
  ${it.passengers.map((p, i) => `<div class="paxrow">${field(`passengers.${i}.name`, "Passenger name", { cls: "fmono", upper: true })}${field(`passengers.${i}.type`, "Passenger type", { options: ["Adult", "Child", "Infant"] })}${compact ? "" : field(`passengers.${i}.title`, "Title")}${field(`passengers.${i}.ticket`, "Ticket number", { cls: "fmono" })}
    ${it.passengers.length > 1 ? `<button class="iconbtn" data-act="del-pax" data-i="${i}" title="Remove passenger">${I.trash}</button>` : "<span></span>"}</div>`).join("")}
  <button class="link" data-act="add-pax" style="margin-top:8px">+ Add passenger</button></div></details>
  <details class="card fsec" open><summary><h3>Booking</h3>${sectionCount("booking")}${I.chev}</summary><div class="fbody"><div class="fg">
  ${field("booking.ref", "Booking reference (PNR)", { cls: "fmono", upper: true })}${field("booking.bookedOn", "Booking date", { hint: H("DD Mon YYYY") })}${field("booking.status", "Booking status")}</div></div></details>`;
  it.segments.forEach((s, i) => {
    const k = `segments.${i}.`;
    h += `<details class="card fsec" ${compact && i > 0 ? "" : "open"}><summary><h3>Flight ${it.segments.length > 1 ? i + 1 : ""}</h3><span class="sm">${esc(s.from.city || "?")} → ${esc(s.to.city || "?")} · ${esc(s.flight)}</span>${sectionCount(k)}${I.chev}</summary><div class="fbody">
    <div class="fgrp">Flight</div><div class="fg">${field(k + "airline", "Airline")}${field(k + "flight", "Flight number", { cls: "fmono", upper: true })}${field(k + "cabin", "Cabin")}${field(k + "duration", "Duration", { hint: H("e.g. 3h 25m") })}${field(k + "aircraft", "Aircraft")}${field(k + "meal", "Meal")}</div>
    <div class="fgrp">From</div><div class="fg">${field(k + "from.city", "City")}${field(k + "from.code", "Airport code", { cls: "fmono", upper: true })}${field(k + "from.airport", "Airport", { cls: compact ? "" : "w2" })}${field(k + "from.terminal", "Departure terminal")}${field(k + "from.date", "Departure date", { hint: H("DD Mon YYYY") })}${field(k + "from.time", "Departure time", { hint: H("24h, local time") })}</div>
    <div class="fgrp">To</div><div class="fg">${field(k + "to.city", "City")}${field(k + "to.code", "Airport code", { cls: "fmono", upper: true })}${field(k + "to.airport", "Airport", { cls: compact ? "" : "w2" })}${field(k + "to.terminal", "Arrival terminal")}${field(k + "to.date", "Arrival date", { hint: H("DD Mon YYYY") })}${field(k + "to.time", "Arrival time", { hint: H("24h, local time") })}</div>
    <div class="fgrp">Baggage &amp; ticket</div><div class="fg">${field(k + "bagCheckin", "Check-in baggage", { upper: true })}${field(k + "bagCabin", "Cabin baggage", { upper: true })}${field(k + "pnr", "Airline PNR", { cls: "fmono", upper: true })}${field(k + "ticket", "Ticket (this flight)", { cls: "fmono" })}${field(k + "checkinNote", "Check-in note", { cls: "w2" })}</div>
    </div></details>`;
    if (i < it.segments.length - 1) {
      const c = A.conns.find(x => x.after === i), next = it.segments[i + 1];
      h += c ? `<div class="connrow">${I.clock}<span><b>${esc(c.text)}</b> layover in ${esc(c.city)} (${esc(c.code)})</span>
        ${c.terminalChange ? `<span class="tag warn">Terminal change T${esc(c.tFrom)} → T${esc(c.tTo)}</span>` : ""}${c.airportChange ? `<span class="tag warn">Airport change</span>` : ""}${c.long ? `<span class="tag">Long layover</span>` : ""}
        <label class="chk" style="margin-left:auto"><input type="checkbox" data-act="st" data-i="${i}" ${s.selfTransferAfter ? "checked" : ""}>Self-transfer</label>${it.flags && it.flags.selfTransferSource && s.selfTransferAfter ? `<span class="tag bad">Stated in booking</span>` : ""}</div>`
        : `<div class="connrow">${I.fwd}<span>${A.tripType === "Round trip" ? "Return journey" : "Next journey"} · ${esc(next.from.city)}, ${esc(next.from.date)}</span></div>`;
    }
  });
  return h;
}
function reviewConf() { return Object.fromEntries(Object.keys(S.cur.conf).filter(k => statusOf(k) === "review").map(k => [k, "review"])); }
function validationBox(cta) {
  const issues = validate(S.cur.it, reviewConf());
  const finds = (S.cur.findings || []).filter(f => statusOf(f.path) === "review").map(f => ({ level: "warn", path: f.path, msg: f.msg }));
  const blocks = issues.filter(i => i.level === "block"), warns = [...finds, ...issues.filter(i => i.level === "warn" && !finds.some(f => f.path === i.path))];
  const checks = [["Passenger details", /^passengers/], ["Booking reference", /^booking\.ref/], ["Flight details", /^segments\.\d+\.(airline|flight|duration)/], ["Travel dates", /\.date$/], ["Departure / arrival", /\.(code|city|time)$/], ["Airline information", /\.airline$/]];
  const ok = !blocks.length;
  const li = (cls, m) => `<li class="${cls}">${I.alert}<button data-act="jump" data-path="${m.path}">${esc(m.msg)}</button></li>`;
  return `<div class="card vbox ${ok ? "ok" : "bad"}" id="vbox"><h4>${ok ? I.check + "Ready to Generate" : I.alert + "Review Required"}</h4>
  <ul class="vlist">${checks.map(([l, re]) => { const b = blocks.find(x => re.test(x.path)); return b ? li("block", b) : `<li class="ok">${I.check}${l}</li>`; }).join("")}
  ${blocks.filter(b => !checks.some(([, re]) => re.test(b.path))).map(b => li("block", b)).join("")}${warns.map(w => li("warn", w)).join("")}</ul>
  ${cta ? `<button class="btn primary lg" data-act="to-ws" ${ok ? "" : "disabled"}>Generate Book Abhi Itinerary${I.fwd}</button>` : ""}
  ${ok ? "" : `<p class="note-s">Fill in the fields marked in red to continue. Amber items won't block you.</p>`}</div>`;
}
function intelHtml() {
  const A = analyze(S.cur.it);
  const total = Object.keys(S.cur.conf).filter(k => getP(S.cur.it, k)).length;
  const rev = Object.keys(S.cur.conf).filter(k => ["review", "missing"].includes(statusOf(k))).length;
  const warnTags = ["Baggage varies", "Terminal change", "Airport change"];
  return `<div class="card intel"><div><div class="eyebrow">Journey</div><div class="lead">${routeTitle(A)}</div></div>
  <div class="tags">${A.tags.map((t, i) => `<span class="tag ${i < 2 ? "key" : t === "Self-transfer" ? "bad" : warnTags.includes(t) ? "warn" : ""}">${esc(t)}</span>`).join("")}</div>
  <div class="stat"><b>${total}</b> fields extracted${rev ? ` · <b class="w">${rev}</b> to check` : " · all verified"}</div></div>`;
}
VIEWS.review = () => `<div class="page"><div class="ph"><div><h1>Review Booking Details</h1><p>${S.cur.method === "manual" ? `Type the details from <b>${esc(S.cur.sourceName)}</b>. Fields marked in red are needed for the itinerary.` : `Read from <b>${esc(S.cur.sourceName)}</b>${S.demo ? ' <span class="pill sample">Demo booking</span>' : ""}. Check the details and correct anything before you generate the itinerary.`}</p></div>${methodPill()}</div>
  ${intelHtml()}<div class="rv"><div id="form">${formHtml(false)}</div>
  <div class="side-col">${validationBox(true)}<div class="card legend"><span class="mk ok">${I.check} Read from the booking</span><span class="mk review">${I.alert} Review: please double-check</span><span class="mk missing">${I.alert} Needs review: not found in the document</span><span class="mk edited">Edited: changed by you</span><span class="mk absent">Not in booking: left out of the PDF</span></div>
  ${S.text ? `<details class="card srcdoc"><summary class="hd" style="cursor:pointer"><span>Source document text</span><span>Show</span></summary><pre>${highlight(S.text, marksFor(S.cur.it))}</pre></details>` : ""}</div></div></div>`;

function methodPill() {
  const m = S.cur.method;
  return m === "ai" ? `<span class="pill ready" title="Read with ${esc(S.cur.model || "AI")}; each value checked against the document, airport/airline data and time zones"><span class="dot"></span>Read with AI · checked against the document</span>`
    : m === "manual" ? `<span class="pill draft"><span class="dot"></span>Manual entry</span>` : `<span class="pill ready"><span class="dot"></span>Built-in reader</span>`;
}

/* ---------------- editing ---------------- */
main.addEventListener("input", e => {
  const el = e.target, path = el.dataset && el.dataset.path; if (!path || !S.cur) return;
  let v = el.value;
  if (el.dataset.upper) { const pos = el.selectionStart; v = v.toUpperCase(); if (v !== el.value) { el.value = v; try { el.setSelectionRange(pos, pos); } catch { /* select inputs */ } } }
  const orig = getP(S.cur.orig, path);
  if (v === (orig ?? "")) delete S.cur.edited[path]; else S.cur.edited[path] = orig ?? "";
  if (!(path in S.cur.conf)) S.cur.conf[path] = "absent";
  setP(S.cur.it, path, v); refreshField(path); scheduleLive();
});
main.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.act === "st") { S.cur.it.segments[+el.dataset.i].selfTransferAfter = el.checked; liveNow(true); }
  else if (el.tagName === "SELECT" && el.dataset.path) liveNow(false);
});
function refreshField(path) {
  const box = main.querySelector(`[data-f="${CSS.escape(path)}"]`); if (!box) return;
  const st = statusOf(path); box.className = box.className.replace(/st-\w+/, "st-" + st);
  const m = box.querySelector(".mk"); m.className = "mk " + st; m.innerHTML = MK[st];
  const inn = box.querySelector(".in"), rb = inn.querySelector(".rev");
  if (st === "edited" && !rb) inn.insertAdjacentHTML("beforeend", `<button class="rev" data-act="revert" data-path="${path}" title="Restore extracted value">${I.undo}</button>`);
  if (st !== "edited" && rb) rb.remove();
}
let liveTimer = null;
function scheduleLive() { clearTimeout(liveTimer); liveTimer = setTimeout(() => liveNow(false), 150); }
function liveNow(rerenderForm) {
  if (S.cur.check) {
    const v = reverify(S.cur.it, S.cur.check);
    // keep "not in booking" for fields the agent added; everything else follows the fresh checks
    S.cur.conf = v.conf; S.cur.findings = v.findings;
    if (!rerenderForm) main.querySelectorAll("[data-f]").forEach(el => refreshField(el.dataset.f));
  }
  const vb = $("#vbox"); if (vb) vb.outerHTML = validationBox(S.view === "review");
  const intel = main.querySelector(".intel"); if (intel) intel.outerHTML = intelHtml();
  if (rerenderForm) { const f = $("#form"); if (f) { const open = [...f.querySelectorAll("details")].map(d => d.open); f.innerHTML = formHtml(S.view === "workspace"); [...f.querySelectorAll("details")].forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; }); } }
  if (S.view === "workspace") renderPreview();
}

/* ================= WORKSPACE (preview) ================= */
VIEWS.workspace = () => `<div class="ws"><div class="ws-l"><div class="ws-lh"><button class="link back" data-act="back-review">${I.back}Back to review</button>
  <h2>Booking Details</h2><p class="updated">Edit any field. The customer preview updates as you type.</p></div>
  <div class="ws-lb">${validationBox(false)}<div id="form">${formHtml(true)}</div></div></div>
  <div class="ws-r"><div class="pv-bar"><span class="pv-title"><span class="live"></span>Customer Preview</span>
    <div class="grp"><button class="btn" data-act="zoom-out" title="Zoom out">${I.minus}</button><span class="zl" id="zl">100%</span><button class="btn" data-act="zoom-in" title="Zoom in">${I.plus}</button><button class="btn" data-act="zoom-fit" title="Fit to page">${I.fit}</button></div>
    <div class="grp"><button class="btn" data-act="pg-prev" title="Previous page">${I.back}</button><span class="zl pg" id="pgl">Page 1 of 1</span><button class="btn" data-act="pg-next" title="Next page">${I.fwd}</button></div>
    <div class="grp"><button class="btn ${S.mode === "desktop" ? "on" : ""}" data-act="mode" data-m="desktop" title="A4 page view">${I.desk}</button><button class="btn ${S.mode === "mobile" ? "on" : ""}" data-act="mode" data-m="mobile" title="Phone view">${I.phone}</button></div>
    <span class="sp"></span><button class="btn primary" data-act="generate" id="genBtn">${I.dl}Download PDF</button></div>
  <div class="pv${S.mode === "mobile" ? " mobile" : ""}" id="pv"></div></div></div>`;
AFTER.workspace = () => { renderPreview(); $("#pv").addEventListener("scroll", trackPage); };
function renderPreview() {
  const pv = $("#pv"); if (!pv) return;
  S.pages = ItineraryPreview.paginate(S.cur.it, measureEl);
  if (S.zoom == null) S.zoom = Math.max(.4, Math.min(1.1, (pv.clientWidth - 52) / PAGE_W));
  const st = pv.scrollTop;
  ItineraryPreview.mount(pv, S.pages, { zoom: S.zoom, mode: S.mode });
  pv.scrollTop = st;
  $("#zl").textContent = Math.round(S.zoom * 100) + "%";
  S.page = Math.min(S.page, S.pages.length); paintPageLabel();
}
const paintPageLabel = () => { const l = $("#pgl"); if (l) l.textContent = `Page ${S.page} of ${S.pages.length}`; };
function trackPage() {
  const pv = $("#pv"), ws = [...pv.querySelectorAll(".pwrap")]; let p = 1;
  ws.forEach(w => { if (w.offsetTop <= pv.scrollTop + 60) p = +w.dataset.pg; });
  if (p !== S.page) { S.page = p; paintPageLabel(); }
}
function gotoPage(p) {
  S.page = Math.max(1, Math.min(S.pages.length, p));
  const w = main.querySelector(`.pwrap[data-pg="${S.page}"]`); if (w) w.scrollIntoView({ behavior: "smooth", block: "start" });
  paintPageLabel();
}
async function buildPdf() {
  const blocks = validate(S.cur.it, {}).filter(i => i.level === "block");
  if (blocks.length) { jump(blocks[0].path); toast("Fill in the highlighted fields first"); return null; }
  const ov = document.createElement("div"); ov.className = "ovl";
  ov.innerHTML = `<div class="card box"><div class="spinner"></div><h3>Generating your Book Abhi itinerary…</h3><p>Laying out A4 pages and building the PDF</p></div>`;
  document.body.appendChild(ov);
  try { S.pdf = await generatePDF(S.cur.it, { measureEl, captureEl }); return S.pdf; }
  catch (e) { console.error(e); toast("The PDF couldn't be built. Please try again."); return null; }
  finally { ov.remove(); }
}

/* ================= DONE ================= */
VIEWS.done = () => {
  const it = S.cur.it, A = analyze(it), o = S.pdf;
  return `<div class="page"><div class="done-v"><div><div class="badge">${I.check}</div><div class="eyebrow">Itinerary Ready</div><h1>${routeTitle(A)}</h1>
  <p class="muted">${esc(it.passengers.map(p => p.name).join(", "))} · Booking ref <span class="mono">${esc(it.booking.ref)}</span></p>
  <div class="fn"><span class="ficon">PDF</span><span><b>${esc(o.name)}</b><br><small>${o.pages} page${o.pages > 1 ? "s" : ""} · ${fmtSize(o.blob.size)} · A4</small></span></div>
  <p class="muted" style="margin-top:12px">The download has started. If it didn't, use the button below.</p>
  <div class="acts"><button class="btn primary lg" data-act="dl-again">${I.dl}Download PDF</button><button class="btn lg" data-act="to-ws">${I.eye}Back to Preview</button><button class="btn lg" data-act="new">${I.plus}Create New</button></div></div>
  <div class="thumb"><img src="${o.thumbnail}" alt="First page of the customer itinerary" width="300"></div></div></div>`;
};

/* ================= ACTIONS ================= */
function jump(path) {
  const box = main.querySelector(`[data-f="${CSS.escape(path)}"]`); if (!box) return;
  const d = box.closest("details"); if (d) d.open = true;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  box.classList.remove("flash"); void box.offsetWidth; box.classList.add("flash");
  const inp = box.querySelector("input,select"); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
}
function reindexConf(removed) {
  const nc = {};
  Object.entries(S.cur.conf).forEach(([k, v]) => { const m = /^passengers\.(\d+)\.(.*)$/.exec(k); if (!m) return (nc[k] = v); const i = +m[1]; if (i !== removed) nc[`passengers.${i > removed ? i - 1 : i}.${m[2]}`] = v; });
  S.cur.conf = nc;
}
async function startDemo() {
  try {
    const file = await fetchSample(DEMO_PDF_URL.split("/").pop());
    S.file = { name: DEMO_PDF_NAME, size: file.size, type: "application/pdf", progress: 100, bytes: new Uint8Array(await file.arrayBuffer()) };
  } catch { S.file = { name: DEMO_PDF_NAME, size: 5822, type: "application/pdf", progress: 100, bytes: new Uint8Array() }; }
  runExtraction({ demo: true });
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  switch (b.dataset.act) {
    case "home": S.file = null; S.cur = null; go("landing"); break;
    case "new": S.file = null; S.cur = null; go("upload"); break;
    case "demo": startDemo(); break;
    case "manual": startManual(); break;
    case "replace": $("#upFile").click(); break;
    case "remove": S.file = null; render(); break;
    case "reupload": S.file = null; go("upload"); break;
    case "sample": try { setFile(await fetchSample(b.dataset.file)); } catch { toast("Couldn't load that sample"); } break;
    case "extract": if (S.file && S.file.bytes) runExtraction(); break;
    case "to-review-jump": S.zoom = null; go("review"); setTimeout(() => { const f = validate(S.cur.it, S.cur.conf).find(i => i.level === "block"); if (f) jump(f.path); }, 80); break;
    case "to-ws": go("workspace"); break;
    case "back-review": go("review"); break;
    case "jump": jump(b.dataset.path); break;
    case "revert": { const p = b.dataset.path; setP(S.cur.it, p, S.cur.edited[p] ?? getP(S.cur.orig, p)); delete S.cur.edited[p]; const inp = main.querySelector(`input[data-path="${CSS.escape(p)}"],select[data-path="${CSS.escape(p)}"]`); if (inp) inp.value = getP(S.cur.it, p) || ""; refreshField(p); liveNow(false); break; }
    case "add-pax": S.cur.it.passengers.push(emptyPassenger()); S.cur.conf[`passengers.${S.cur.it.passengers.length - 1}.name`] = "missing"; liveNow(true); break;
    case "del-pax": S.cur.it.passengers.splice(+b.dataset.i, 1); reindexConf(+b.dataset.i); liveNow(true); break;
    case "zoom-in": S.zoom = Math.min(2, S.zoom + .1); renderPreview(); break;
    case "zoom-out": S.zoom = Math.max(.3, S.zoom - .1); renderPreview(); break;
    case "zoom-fit": { const pv = $("#pv"); S.zoom = Math.min((pv.clientWidth - 52) / PAGE_W, (pv.clientHeight - 52) / PAGE_H); renderPreview(); break; }
    case "pg-prev": gotoPage(S.page - 1); break;
    case "pg-next": gotoPage(S.page + 1); break;
    case "mode": S.mode = b.dataset.m; render(); break;
    case "generate": { const out = await buildPdf(); if (out) { downloadPDF(out); go("done"); } break; }
    case "dl-again": if (S.pdf) downloadPDF(S.pdf); break;
  }
});
window.addEventListener("resize", () => { if (S.view === "workspace") { S.zoom = null; renderPreview(); } });

render();
aiStatus().then(a => { S.ai = a; if (S.view === "upload") render(); });
if (import.meta.env.DEV) window.__BA = S;
