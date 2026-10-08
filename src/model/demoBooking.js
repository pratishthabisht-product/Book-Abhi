/* demoBooking — the uploaded Emirates EK512 confirmation, already extracted.
   "Use Demo Booking" first runs the real extractor on the bundled sample PDF
   (public/samples/Emirates_EK512_9UJ4L6.pdf). If that ever fails, this object is
   used instead, so the demo always works. Values are copied from the source PDF. */
export const DEMO_PDF_URL = "/samples/Emirates_EK512_9UJ4L6.pdf";
export const DEMO_PDF_NAME = "Emirates_EK512_9UJ4L6.pdf";

export const demoBooking = {
  itinerary: {
    booking: { ref: "9UJ4L6", bookedOn: "01 May 2026", status: "Confirmed" },
    passengers: [{ name: "PARSHOTAM KUMAR", title: "Mr", type: "Adult", ticket: "1765896713027" }],
    segments: [{
      airline: "Emirates", airlineCode: "EK", flight: "EK512", cabin: "Economy", bookingClass: "X", status: "Confirmed",
      duration: "3h 25m", stops: "Non-stop", aircraft: "Boeing 777-300ER", meal: "Meal", bagCheckin: "35 KG", bagCabin: "",
      pnr: "MMUVGF", ticket: "", checkinNote: "", selfTransferAfter: false,
      from: { city: "Dubai", code: "DXB", airport: "Dubai International", terminal: "3", date: "06 May 2026", time: "21:30" },
      to: { city: "Delhi", code: "DEL", airport: "Indira Gandhi International", terminal: "3", date: "07 May 2026", time: "02:25" },
    }],
    extras: { co2: "158.15 kg per person (ICAO estimate)" }, notes: [], flags: {},
  },
  confidence: Object.fromEntries([
    "booking.ref", "booking.bookedOn", "booking.status", "passengers.0.name", "passengers.0.ticket",
    ...["airline", "flight", "cabin", "status", "duration", "aircraft", "meal", "bagCheckin", "pnr",
      ...["city", "code", "airport", "terminal", "date", "time"].flatMap(k => [`from.${k}`, `to.${k}`])].map(k => `segments.0.${k}`),
  ].map(k => [k, "ok"]).concat([["segments.0.bagCabin", "absent"], ["segments.0.ticket", "absent"], ["segments.0.checkinNote", "absent"]])),
};
