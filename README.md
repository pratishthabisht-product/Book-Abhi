# Book Abhi — AI Flight Itinerary Generator

Interview prototype. Turns a raw booking-portal flight confirmation PDF into a branded,
customer-ready Book Abhi itinerary:

**Upload → Extract → Review → Preview → Download PDF**

Everything runs in the browser. No backend, database, API key or environment variables.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build check:

```bash
npm run build
npm run preview      # http://localhost:4173
```

## Deploy to Vercel (CLI, no GitHub needed)

```bash
npm install -g vercel
vercel login         # first time only
vercel               # preview deployment; accept the detected Vite settings
vercel --prod        # production URL to share
```

`vercel.json` already sets the framework (Vite), the build command and the output folder (`dist`).

## Demo script

1. Open the URL and click **Use Demo Booking**. This loads the real Emirates EK512 confirmation (PARSHOTAM KUMAR, 9UJ4L6).
2. Watch the extraction steps and the highlighted source text.
3. **Review Booking Details**: every field is editable and marked ✓ / Review / Needs review / Edited.
4. Click **Generate Book Abhi Itinerary**. Edit a field on the left (for example baggage 35 KG → 30 KG) and the preview updates.
5. Click **Download PDF** to get an A4 Book Abhi itinerary.

Other journey types: **Create New Itinerary** → *More sample confirmations* (round trip, one stop,
two stops, multiple airlines, self-transfer, missing arrival time, damaged file). You can also upload any
of the PDFs in `public/samples/` from your computer.

## Code map

| Module | Role |
| --- | --- |
| `src/extraction/extractBookingData.js` | `extractBookingData()`: pdf.js text layer, then parser, then `ItineraryData` and a confidence map. **Swap-in point for a future AI extraction service.** |
| `src/extraction/_parser.js` | Deterministic parser for the portal's Amadeus-style "TRAVEL SUMMARY" format |
| `src/model/ItineraryData.js` | Data model, empty factories, validation, nested journey view |
| `src/model/demoBooking.js` | `demoBooking`: the EK512 sample as data (fallback if PDF parsing ever fails) |
| `src/journey/classifyJourney.js` | `classifyJourney()`: one-way / round trip / multi-city, stops, layovers, airlines, PNRs, baggage differences, self-transfer, terminal and airport changes, next-day arrival, alerts |
| `src/render/ItineraryPreview.js` + `_blocks.js` | `ItineraryPreview`: Book Abhi design system laid out into A4 pages |
| `src/pdf/generatePDF.js` | `generatePDF()` / `downloadPDF()`: html2canvas + jsPDF, all in the browser |
| `src/config.js` | Optional support phone and email for the PDF footer (hidden when empty) |
| `src/main.js` | Agent UI and workflow |
