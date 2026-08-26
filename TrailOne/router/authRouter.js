import { Router } from "express";
import { requestCode, signInWithSecret, verifyCode } from "../controller/authController.js";
const authRouter = Router();

// POST /api/auth/request-code - sends an 8-character access code by email.
authRouter.post("/request-code", requestCode);

// POST /api/auth/verify-code - verifies the access code and returns a JWT.
authRouter.post("/verify-code", verifyCode);

// POST /api/auth/sign-in - returns a JWT for a returning guest using their secret key.
authRouter.post("/sign-in", signInWithSecret);

export default authRouter;
