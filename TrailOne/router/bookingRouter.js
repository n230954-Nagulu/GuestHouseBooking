import { Router } from "express";
import { confirmBooking, createHold } from "../controller/bookingController.js";
import { authenticate } from "../middleware/authenticate.js";
const bookingRouter = Router();

// All booking routes require: Authorization: Bearer <JWT>
bookingRouter.use(authenticate);

// POST /api/bookings/holds - final verified-user submission; creates a timed room hold.
bookingRouter.post("/holds", authenticate, createHold);

// POST /api/bookings/holds/:requestId/confirm - reserved for payment success later.
bookingRouter.post("/holds/:requestId/confirm", authenticate ,confirmBooking);

export default bookingRouter;
