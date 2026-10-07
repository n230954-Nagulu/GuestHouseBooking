import { Router } from "express";
import { confirmBooking, confirmDemoBooking, createHold } from "../controller/bookingController.js";
import { authenticate } from "../middleware/authenticate.js";
const bookingRouter = Router();

// All booking routes require: Authorization: Bearer <JWT>
bookingRouter.use(authenticate);

// POST /api/bookings/holds - final verified-user submission; creates a timed room hold.
bookingRouter.post("/holds", authenticate, createHold);
bookingRouter.post("/holds/:requestId/confirm-demo", confirmDemoBooking);

// Retained for compatibility; booking confirmation only occurs in payment verification.
bookingRouter.post("/holds/:requestId/confirm", authenticate ,confirmBooking);

export default bookingRouter;
