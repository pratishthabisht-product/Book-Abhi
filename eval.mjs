/* =====================================================================
   Extraction accuracy runner
   ---------------------------------------------------------------------
   npm run eval              built-in reader only
   npm run eval -- --ai      also AI reading (needs ANTHROPIC_API_KEY in .env.local)
   npm run eval -- --write-expected   create missing *.expected.json from the
                                      current output (then CHECK THEM BY HAND)

   Put test documents in eval/cases/ (PDF, PNG, JPG) with a matching
   <name>.expected.json holding the correct ItineraryData. Real customer
   bookings go in eval/private/ (git-ignored) and are picked up too.

   The key number is SILENT ERRORS: wrong values that were NOT flagged for
   review. Those are the ones an agent could send to a customer.
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { linesFromItems, parseBookingText } from "../src/extraction/_parser.js";
import { verifyExtraction } from "../src/extraction/verify.js";
import { mapAiResult } from "../src/extraction/aiMapping.js";
import { extractWithClaude, DEFAULT_MODEL } from "../api/_lib/claude.js";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = new Set(process.argv.slice(2));
const USE_AI = args.has("--ai"), WRITE = args.has("--write-expected");

for (const f of [".env.local", ".env"]) {                       // tiny .env loader
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const airports = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/airports.json"), "utf8"));
const airlines = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/airlines.json"), "utf8"));

const FIELDS = it => [
  "booking.ref", "booking.bookedOn",
  ...it.passengers.flatMap((_, i) => [`passengers.${i}.name`, `passengers.${i}.ticket`]),
  ...it.segments.flatMap((_, i) => ["airline", "flight", "cabin", "duration", "bagCheckin", "bagCabin", "pnr", "ticket",
    ...["code", "city", "terminal", "date", "time"].flatMap(k => [`from.${k}`, `to.${k}`])].map(k => `segments.${i}.${k}`)),
];
const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const norm = v => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");

async function pdfText(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const pages = []; for (let p = 1; p <= doc.numPages; p++) pages.push(await (await doc.getPage(p)).getTextContent());
  return linesFromItems(pages);
}

async function run(method, file) {
  const isImage = /\.(png|jpe?g|webp)$/i.test(file);
  let text = "";
  if (!isImage) { try { text = await pdfText(file); } catch { return { error: "unreadable PDF" }; } }
  if (method === "rules") {
    if (isImage) return { error: "images need AI" };
    const r = parseBookingText(text);
    if (r.kind !== "flight" || !r.bookings.length) return { error: "layout not recognised" };
    const b = r.bookings[0], v = verifyExtraction(b.model, { sourceText: text, airports, airlines });
    return { it: b.model, conf: { ...b.conf, ...Object.fromEntries(Object.entries(v.conf).filter(([, x]) => x === "review")) } };
  }
  const data = fs.readFileSync(file).toString("base64");
  const mediaType = isImage ? (file.endsWith(".png") ? "image/png" : "image/jpeg") : "application/pdf";
  const t0 = Date.now();
  const { result, usage } = await extractWithClaude({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL, data, mediaType, needTranscript: isImage || text.length < 40 });
  const it = mapAiResult(result).itineraries[0];
  if (!it) return { error: "AI found no booking" };
  const v = verifyExtraction(it, { sourceText: text || result.document_text, sourceIsImage: isImage || !text.trim(), airports, airlines });
  return { it, conf: v.conf, ms: Date.now() - t0, usage };
}

const dirs = [path.join(ROOT, "eval/cases"), path.join(ROOT, "eval/private")].filter(d => fs.existsSync(d));
const files = dirs.flatMap(d => fs.readdirSync(d).filter(f => /\.(pdf|png|jpe?g|webp)$/i.test(f)).map(f => path.join(d, f)));
const methods = ["rules", ...(USE_AI ? ["ai"] : [])];
if (USE_AI && !process.env.ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY in .env.local to evaluate AI reading."); process.exit(1); }

const totals = Object.fromEntries(methods.map(m => [m, { docs: 0, read: 0, fields: 0, correct: 0, flaggedWrong: 0, silentWrong: 0 }]));
for (const file of files) {
  const expFile = file.replace(/\.(pdf|png|jpe?g|webp)$/i, ".expected.json");
  let expected = fs.existsSync(expFile) ? JSON.parse(fs.readFileSync(expFile, "utf8")) : null;
  console.log(`\n${path.relative(ROOT, file)}${expected ? "" : "  (no expected file)"}`);
  for (const m of methods) {
    const t = totals[m]; t.docs++;
    let out; try { out = await run(m, file); } catch (e) { out = { error: e.message }; }
    if (out.error) { console.log(`  ${m.padEnd(5)}  could not read: ${out.error}`); continue; }
    t.read++;
    if (!expected && WRITE && m === methods[methods.length - 1]) {
      fs.writeFileSync(expFile, JSON.stringify(out.it, null, 2)); expected = out.it;
      console.log(`  wrote ${path.relative(ROOT, expFile)}. Check every value against the document before trusting it.`);
    }
    if (!expected) { console.log(`  ${m.padEnd(5)}  read OK (no expected values to compare)`); continue; }
    const wrong = [];
    let n = 0, ok = 0;
    for (const p of FIELDS(expected)) {
      const want = norm(get(expected, p)), got = norm(get(out.it, p));
      if (!want && !got) continue;
      n++;
      if (want === got) ok++;
      else { const flagged = ["review", "missing"].includes(out.conf[p]); wrong.push({ p, want, got, flagged }); flagged ? t.flaggedWrong++ : t.silentWrong++; }
    }
    t.fields += n; t.correct += ok;
    console.log(`  ${m.padEnd(5)}  ${ok}/${n} fields correct${out.ms ? `  · ${(out.ms / 1000).toFixed(1)}s` : ""}${out.usage ? `  · ${out.usage.input_tokens}+${out.usage.output_tokens} tokens` : ""}`);
    wrong.forEach(w => console.log(`         ${w.flagged ? "flagged" : "SILENT "}  ${w.p}: expected "${w.want}", got "${w.got || "(empty)"}"`));
  }
}
console.log("\n==== Summary ====");
for (const [m, t] of Object.entries(totals)) {
  const pct = t.fields ? ((t.correct / t.fields) * 100).toFixed(1) : "–";
  console.log(`${m.padEnd(5)}  documents read ${t.read}/${t.docs} · field accuracy ${pct}% (${t.correct}/${t.fields}) · wrong but flagged ${t.flaggedWrong} · SILENT errors ${t.silentWrong}`);
}
