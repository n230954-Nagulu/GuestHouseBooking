import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { createPaymentOrder, verifyPayment } from "../controller/paymentController.js";

const paymentRouter = Router();
paymentRouter.use(authenticate);

paymentRouter.post("/create-order", createPaymentOrder);
paymentRouter.post("/verify", verifyPayment);

export default paymentRouter;
