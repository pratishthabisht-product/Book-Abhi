/* =====================================================================
   extractBookingData()  —  STEP 1-3: ingest → extract → understand
   ---------------------------------------------------------------------
   Runs entirely in the browser:
     1. pdf.js reads the text layer of the uploaded PDF
     2. the text is rebuilt line-by-line (keeps the portal's column layout)
     3. a deterministic parser maps it into ItineraryData

   PRODUCTION SWAP-IN POINT
   To use an AI extraction service later, replace the body of
   extractBookingData() with a call to that service. It only has to return
   the same ExtractionResult shape; review, journey classification,
   preview and PDF generation stay unchanged.
   ===================================================================== */
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { linesFromItems, parseBookingText } from "./_parser.js";
import { validate } from "../model/ItineraryData.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Read the text layer of a PDF into layout-preserving plain text. */
export async function readPdfText(bytes) {
  const doc = await pdfjsLib.getDocument({ data: bytes, verbosity: 0, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
    const page = await doc.getPage(p);
    pages.push(await page.getTextContent());
  }
  return linesFromItems(pages);
}

/**
 * @typedef {Object} ExtractionResult
 * @property {"ok"|"partial"|"invalid"|"empty"|"unsupported"} status
 * @property {import("../model/ItineraryData.js").ItineraryData} [itinerary]
 * @property {Object<string,"ok"|"review"|"missing"|"absent">} [confidence]  field path → status
 * @property {string} [text]            rebuilt source text (shown to the agent, never the customer)
 * @property {number} [bookingsFound]   >1 when the PDF holds several bookings (first one is used)
 * @property {Array} [issues]           validation issues for the extracted itinerary
 */

/**
 * @param {File|ArrayBuffer|Uint8Array} input
 * @returns {Promise<ExtractionResult>}
 */
export async function extractBookingData(input) {
  const bytes = input instanceof Uint8Array ? input
    : input instanceof ArrayBuffer ? new Uint8Array(input)
    : new Uint8Array(await input.arrayBuffer());

  let text;
  try { text = await readPdfText(bytes.slice(0)); }
  catch { return { status: "invalid" }; }

  const parsed = parseBookingText(text);
  if (parsed.kind === "empty") return { status: "empty", text };
  if (parsed.kind !== "flight" || !parsed.bookings.length) return { status: "unsupported", text };

  const { model, conf } = parsed.bookings[0];
  const issues = validate(model, conf);
  return {
    status: issues.some(i => i.level === "block") ? "partial" : "ok",
    itinerary: model, confidence: conf, text, issues, bookingsFound: parsed.bookings.length,
  };
}
