/* =====================================================================
   ItineraryPreview — renders ItineraryData into A4 pages using the
   Book Abhi customer design system (styles/itinerary.css).
   The same pages feed the live preview and generatePDF(), so what the
   agent sees is exactly what the customer receives.
   ===================================================================== */
import { docBlocks } from "./_blocks.js";
import { classifyJourney } from "../journey/classifyJourney.js";
import { cloneItinerary } from "../model/ItineraryData.js";
import { esc } from "../lib/format.js";
import { SUPPORT } from "../config.js";

export const PAGE_W = 794, PAGE_H = 1123;           // A4 at 96 dpi
const PAD_TOP = 38, CONTENT_LIMIT = PAGE_H - PAD_TOP - 46;

export const ItineraryPreview = {
  /** Lay the itinerary out into A4 pages. `measureEl` is an off-screen element used to measure blocks. */
  paginate(itinerary, measureEl) {
    const it = cloneItinerary(itinerary);
    const classification = classifyJourney(it);
    const blocks = docBlocks(it, classification, SUPPORT);
    measureEl.className = "doc";
    measureEl.innerHTML = blocks.map(b => `<div class="blk" style="padding-top:${b.gap}px">${b.html}</div>`).join("");
    const H = [...measureEl.children].map(e => e.offsetHeight);
    const pages = [[]]; let h = 0;
    blocks.forEach((b, i) => {
      const cur = pages[pages.length - 1];
      const inner = H[i] - b.gap;
      const need = (cur.length ? H[i] : inner) + (b.keep && blocks[i + 1] ? H[i + 1] - blocks[i + 1].gap : 0);
      if (cur.length && h + need > CONTENT_LIMIT) { pages.push([]); h = 0; }
      const first = !pages[pages.length - 1].length;
      pages[pages.length - 1].push(`<div class="blk"${first ? "" : ` style="padding-top:${b.gap}px"`}>${b.html}</div>`);
      h += first ? inner : H[i];
    });
    measureEl.innerHTML = "";
    const n = pages.length;
    return pages.map((p, i) => `<div class="dpage doc">${p.join("")}<div class="dfoot"><span><b>BOOK ABHI</b> &nbsp;·&nbsp; Booking Ref ${esc(it.booking.ref)}</span><span>Page ${i + 1} of ${n}</span></div></div>`);
  },

  /** Paint pages into a scrollable container at a zoom level. */
  mount(container, pages, { zoom = 1, mode = "desktop" } = {}) {
    const wrap = (p, z, i) => `<div class="pwrap" data-pg="${i + 1}" style="width:${PAGE_W * z}px;height:${PAGE_H * z}px">${p.replace('class="dpage doc"', `class="dpage doc" style="transform:scale(${z})"`)}</div>`;
    if (mode === "mobile") {
      const z = 358 / PAGE_W;
      container.innerHTML = `<div class="phone"><div class="pbar">Book Abhi itinerary · PDF</div><div class="pscroll">${pages.map((p, i) => wrap(p, z, i)).join("")}</div></div>`;
    } else container.innerHTML = pages.map((p, i) => wrap(p, zoom, i)).join("");
  },
};
