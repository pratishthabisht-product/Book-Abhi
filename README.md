# Book Abhi — AI Flight Itinerary Generator

Turns a flight booking confirmation (any portal PDF, a scan, a screenshot or a photo) into a branded,
customer-ready Book Abhi itinerary:

**Upload → Read → Verify → Review → Preview → Download PDF**

## How a document is read

```
document ──► 1. Built-in reader ──(known portal format, all fields found)──► checks ──► agent review
                 │ not recognised / gaps
                 ▼
             2. AI reading (/api/extract → Claude)  ── only if ANTHROPIC_API_KEY is set
                 │ not available / failed
                 ▼
             3. Manual entry (preview and PDF still work)
```

**Checks** (`src/extraction/verify.js`) run on every result, whichever way it was read:

- **Found in the document:** each value (or a standard rewrite of it: 21:30 ↔ 2130, 3h 25m ↔ 03:25, 35 KG ↔ 35K) must appear in the source text. If it doesn't, the field is marked *Review*.
- **Reference data:** airport code ↔ city, airline code ↔ airline name, flight number prefix, ticket prefix (176 = Emirates, 618 = Singapore Airlines…).
- **Time zones:** departure time + duration must equal the arrival time in the arrival airport's time zone.
- **Scans and photos:** free-text fields (names, references, tickets) are always marked for a human look.

The AI step only reads. It is told to copy values exactly, leave missing ones empty and never guess. It
returns a fixed JSON schema (`api/_lib/claude.js`), and nothing reaches the customer PDF until the
agent has reviewed it.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev            # http://localhost:5173
```

To switch on AI reading locally, create a file called `.env.local` next to `package.json`:

```
ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL=claude-sonnet-5-5
```

Never commit this file (it's in `.gitignore`).

## Deploy to Vercel

Upload the project to GitHub and import it in Vercel. Then, to switch on AI reading:

1. Vercel → your project → **Settings → Environment Variables**
2. Add `ANTHROPIC_API_KEY` with your key from console.anthropic.com
3. **Deployments → ⋯ → Redeploy**

Without the key, the site still works with the built-in reader and manual entry. The upload page shows
"AI reading on" or "Built-in reader only".

## Measuring accuracy

```bash
npm run eval             # built-in reader on every file in eval/cases/
npm run eval -- --ai     # also AI reading (uses ANTHROPIC_API_KEY from .env.local)
```

Each test document needs a `<name>.expected.json` with the correct values. Put real customer bookings in
`eval/private/` (git-ignored). `npm run eval -- --write-expected` drafts expected files from the current
output, but you must check them by hand. The number that matters most is **SILENT errors**: wrong values
that were not flagged for review.

## Code map

| Path | Role |
| --- | --- |
| `src/extraction/extractBookingData.js` | Pipeline: built-in reader → AI → manual, then checks |
| `src/extraction/_parser.js` | Built-in reader for the portal's "TRAVEL SUMMARY" format |
| `api/extract.js`, `api/_lib/claude.js` | Server function that calls Claude (key stays on the server) |
| `src/extraction/aiMapping.js` | AI JSON → ItineraryData |
| `src/extraction/verify.js` | Checks and confidence flags |
| `src/data/airports.json`, `airlines.json` | Reference data from OpenFlights (openflights.org, ODbL licence) |
| `src/model/`, `src/journey/`, `src/render/`, `src/pdf/` | Data model, journey logic, Book Abhi design, PDF builder |
| `scripts/eval.mjs`, `eval/cases/` | Accuracy runner and test documents |

## Cost and privacy (AI reading)

- **Cost and speed:** a typical 1–2 page booking is a few thousand tokens, so roughly a few US cents per document with Claude Sonnet. Check current pricing.
- **What gets sent:** the document goes to the Anthropic API only when the built-in reader can't handle it. Nothing is stored by this app.
- **Personal data:** bookings contain passenger names and ticket numbers. Tell the business owner where documents are processed.
