/* =====================================================================
   generatePDF() — client-side A4 PDF from the ItineraryPreview pages
   html2canvas rasterises each page at ~2.2x, then jsPDF assembles an A4
   document. No server, no storage. downloadPDF() saves it in the browser.
   ===================================================================== */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ItineraryPreview, PAGE_W, PAGE_H } from "../render/ItineraryPreview.js";

export function pdfFileName(itinerary) {
  const p = itinerary.passengers[0];
  const name = (p && p.name ? p.name : "Customer").split(/\s+/).filter(Boolean).map(w => w[0] + w.slice(1).toLowerCase()).join("");
  return `BookAbhi_Itinerary_${name}_${itinerary.booking.ref || "booking"}.pdf`.replace(/[^\w.-]/g, "");
}

/** @returns {Promise<{blob: Blob, name: string, pages: number, thumbnail: string}>} */
export async function generatePDF(itinerary, { measureEl, captureEl }) {
  const pages = ItineraryPreview.paginate(itinerary, measureEl);
  captureEl.innerHTML = pages.join("");
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  // html2canvas draws inline SVG from serialised markup: pin computed colours on each icon
  captureEl.querySelectorAll("svg").forEach(svg => {
    const cs = getComputedStyle(svg); svg.setAttribute("color", cs.color); svg.style.color = cs.color;
    const r = svg.getBoundingClientRect(); if (r.width) { svg.setAttribute("width", r.width); svg.setAttribute("height", r.height); }
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: `Book Abhi Itinerary · ${itinerary.booking.ref}`, author: "Book Abhi", creator: "Book Abhi", subject: "Flight itinerary" });
  let thumbnail = "";
  const els = [...captureEl.querySelectorAll(".dpage")];
  for (let i = 0; i < els.length; i++) {
    const canvas = await html2canvas(els[i], { scale: 2.2, backgroundColor: "#ffffff", logging: false, width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W });
    if (i) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    if (!i) thumbnail = canvas.toDataURL("image/jpeg", 0.8);
  }
  captureEl.innerHTML = "";
  return { blob: pdf.output("blob"), name: pdfFileName(itinerary), pages: els.length, thumbnail };
}

/** Standard browser download. */
export function downloadPDF({ blob, name }) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
