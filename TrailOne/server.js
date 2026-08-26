import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./config/db.js";
import authRouter from "./router/authRouter.js";
import roomRouter from "./router/roomRouter.js";
import bookingRouter from "./router/bookingRouter.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be set in .env");
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:8443")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("This website is not allowed to use the booking API."));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400
  })
);
app.use(express.json({ limit: "20kb" }));
app.disable("x-powered-by");

// GET /health - confirms that the API and database connection are available.
app.get("/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ success: true, service: "guest-room-booking-api" });
  } catch (error) {
    return next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomRouter);
app.use("/api/bookings", bookingRouter);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Guest room booking API listening on port ${port}`));
