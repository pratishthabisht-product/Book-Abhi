/* =====================================================================
   ItineraryData — the booking model every screen works from
   ---------------------------------------------------------------------
   Editable source data (what extraction fills and the agent corrects):

   ItineraryData
    ├── booking      { ref, bookedOn, status }
    ├── passengers[] { name, title, type, ticket }
    ├── segments[]   { airline, airlineCode, flight, cabin, bookingClass, status,
    │                  duration, stops, aircraft, meal, bagCheckin, bagCabin,
    │                  pnr, ticket, checkinNote, selfTransferAfter,
    │                  from { city, code, airport, terminal, date, time },
    │                  to   { city, code, airport, terminal, date, time } }
    ├── extras       { co2 }
    ├── notes[]      notes printed in the source booking
    └── flags        { selfTransferSource }

   Derived view (classifyJourney → toItineraryView):

   Itinerary
    ├── passengers[]
    ├── booking
    ├── journeys[]  { type: "Outbound"|"Return"|"Journey n"|null,
    │                 segments[], layovers[] }
    └── alerts[]    { level: "danger"|"warn"|"info", title, text }

   Dates are "DD Mon YYYY", times "HH:MM" (local airport time), durations "3h 25m".
   ===================================================================== */
export { validate, labelFor } from "./_validate.js";
import { classifyJourney } from "../journey/classifyJourney.js";

/** @typedef {ReturnType<typeof createItinerary>} ItineraryData */

const point = () => ({ city: "", code: "", airport: "", terminal: "", date: "", time: "" });
export const emptySegment = () => ({
  airline: "", airlineCode: "", flight: "", cabin: "", bookingClass: "", status: "", duration: "", stops: "",
  aircraft: "", meal: "", bagCheckin: "", bagCabin: "", pnr: "", ticket: "", checkinNote: "", selfTransferAfter: false,
  from: point(), to: point(),
});
export const emptyPassenger = () => ({ name: "", title: "", type: "Adult", ticket: "" });
export function createItinerary(partial = {}) {
  return { booking: { ref: "", bookedOn: "", status: "" }, passengers: [], segments: [], extras: {}, notes: [], flags: {}, ...partial };
}
export const cloneItinerary = it => JSON.parse(JSON.stringify(it));

/** Nested, customer-oriented view of the itinerary (journeys → segments + layovers, alerts). */
export function toItineraryView(itinerary) {
  const it = cloneItinerary(itinerary);
  const c = classifyJourney(it);
  return {
    passengers: it.passengers, booking: it.booking, tripType: c.tripType, tags: c.tags,
    journeys: c.journeys.map(j => ({ type: j.label || null, segments: j.segments, layovers: j.connections })),
    alerts: c.notes.map(([level, title, text]) => ({ level, title, text })),
  };
}
