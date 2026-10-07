import pool from "../config/db.js";
import crypto from "node:crypto";
import {
  bookingDetails,
  createBookingFromHold,
  createHold as persistHold,
  findBookingByRequestId,
  findHoldForCustomer,
  holdDetails,
  updateHoldFacultyInCharge,
} from "../repository/bookingRepository.js";
import { expireHolds, getAvailableRooms, lockSelectedRooms } from "../repository/roomRepository.js";
import { createPaymentRecord, findDemoPaymentByRequestId, findPaymentByRequestId } from "../repository/paymentRepository.js";
import { sendBookingConfirmationEmails } from "../service/emailService.js";
import { bookingPrice } from "../service/pricingService.js";
import { validDates } from "./roomController.js";

const parseRoomIds = (ids) =>
  Array.isArray(ids) && ids.length && ids.every((id) => Number.isSafeInteger(Number(id)) && Number(id) > 0)
    ? [...new Set(ids.map(Number))]
    : null;

const normalizeFacultyInCharge = (value) => {
  const name = String(value || "").trim();
  return name && name.length >= 2 ? name : "";
};
const normalizeFacultyEmail = (value) => String(value || "").trim().toLowerCase();
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/bookings/holds - atomically rechecks selected rooms and holds them for this guest. */
export async function createHold(req, res, next) {
  const { inDate, outDate } = req.body;
  const customerId = Number(req.body.customerId);
  const roomIds = parseRoomIds(req.body.roomIds);

  if (!Number.isSafeInteger(customerId) || customerId !== req.user.customerId)
    return res.status(403).json({ success: false, message: "Customer ID does not match the authenticated user." });

  if (!validDates(inDate, outDate) || !roomIds)
    return res.status(400).json({ success: false, message: "Provide valid dates and at least one room ID." });

  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    await expireHolds(connection);
    await lockSelectedRooms(connection, roomIds);

    const availableRooms = await getAvailableRooms(inDate, outDate, connection);
    const ids = new Set(availableRooms.map((r) => r.RoomId));
    const unavailableRoomIds = roomIds.filter((id) => !ids.has(id));

    if (unavailableRoomIds.length) {
      await connection.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Selected rooms are no longer available.",
        unavailableRoomIds,
        availableRooms,
      });
    }

    const hold = await persistHold(connection, {
      customerId,
      inDate,
      outDate,
      roomIds,
    });

    await connection.query("COMMIT");

    const details = await holdDetails(hold.requestId, customerId);
    const pricing = bookingPrice(details.rooms.length, inDate, outDate);

    return res.status(201).json({
      success: true,
      message: "Rooms are held temporarily. Continue to payment before the hold expires.",
      customer: {
        customerId: details.CustomerId,
        fullName: details.FullName,
        email: details.Email,
        phone: details.Phone,
      },
      bookingRequest: {
        requestId: details.RequestId,
        requestReference: details.RequestReference,
        status: details.RequestStatus,
        inDate: details.InDate,
        outDate: details.OutDate,
        createdAt: details.CreatedAt,
        expiresAt: details.ExpiresAt,
        facultyInChargeName: details.FacultyInChargeName || null,
        facultyInChargeEmail: details.FacultyInChargeEmail,
        rooms: details.rooms,
        ...pricing,
      },
    });
  } catch (error) {
    await connection.query("ROLLBACK");
    return next(error);
  } finally {
    connection.release();
  }
}

/** Legacy endpoint retained but cannot confirm a booking without verified payment. */
export function confirmBooking(req, res) {
  return res.status(409).json({
    success: false,
    message: "Use the authenticated demo-confirm or verified Razorpay payment flow to confirm a booking.",
  });
}

export async function confirmDemoBooking(req, res, next) {
  const requestId = Number(req.params.requestId);
  const facultyInChargeName = normalizeFacultyInCharge(req.body.facultyInChargeName);
  const facultyInChargeEmail = normalizeFacultyEmail(req.body.facultyInChargeEmail);

  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    return res.status(400).json({ success: false, message: "A valid booking request ID is required." });
  }
  if (facultyInChargeName.length < 2 || facultyInChargeName.length > 120) {
    return res.status(400).json({ success: false, message: "Provide a faculty in-charge name between 2 and 120 characters." });
  }
  if (facultyInChargeEmail.length > 254 || !validEmail.test(facultyInChargeEmail)) {
    return res.status(400).json({ success: false, message: "Provide a valid faculty in-charge email address." });
  }

  let connection;
  try {
    connection = await pool.connect();
    await connection.query("BEGIN");
    await expireHolds(connection);

    const request = await findHoldForCustomer(connection, requestId, req.user.customerId);
    if (!request) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Booking request was not found for this customer." });
    }

    const existingBooking = await findBookingByRequestId(connection, requestId);
    if (existingBooking) {
      const demoPayment = await findDemoPaymentByRequestId(connection, requestId);
      if (demoPayment && existingBooking.BookingStatus === "CONFIRMED") {
        const existingDetails = await bookingDetails(existingBooking.BookingId, connection);
        const existingPricing = bookingPrice(existingDetails.rooms.length, existingDetails.InDate, existingDetails.OutDate);
        await connection.query("COMMIT");
        return res.status(200).json({
          success: true,
          message: "Demo booking was already confirmed.",
          paymentMode: "DEMO",
          payment: { method: "DEMO", status: "PENDING", verificationStatus: "PENDING" },
          booking: { ...existingDetails, ...existingPricing },
          emailNotifications: [],
        });
      }
      await connection.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "This booking request has already been confirmed using another payment method." });
    }

    const existingPayment = await findPaymentByRequestId(connection, requestId);
    if (existingPayment?.PaymentMethod === "RAZORPAY") {
      await connection.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "A Razorpay payment attempt already exists for this hold. Complete that payment or start a new booking to use demo mode." });
    }

    if (request.RequestStatus !== "HOLD" || new Date(request.ExpiresAt) <= new Date()) {
      await connection.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "This booking hold has expired or is no longer available." });
    }
    if (!validDates(request.InDate, request.OutDate)) {
      await connection.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "The booking dates are invalid." });
    }

    const details = await holdDetails(requestId, req.user.customerId, connection);
    if (!details || details.FullName?.trim().length < 2 || !validEmail.test(details.Email || "") || !details.Phone?.trim()) {
      await connection.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Verified occupant name, email, and phone details are required." });
    }
    if (!details.rooms?.length) {
      await connection.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "At least one room must be selected before confirming the booking." });
    }

    await updateHoldFacultyInCharge(connection, requestId, req.user.customerId, facultyInChargeName, facultyInChargeEmail);
    request.FacultyInChargeName = facultyInChargeName;
    request.FacultyInChargeEmail = facultyInChargeEmail;
    const booking = await createBookingFromHold(connection, request);
    const pricing = bookingPrice(details.rooms.length, request.InDate, request.OutDate);
    await createPaymentRecord(connection, {
      requestId,
      bookingId: booking.bookingId,
      razorpayOrderId: `DEMO-${requestId}-${crypto.randomUUID()}`,
      amount: pricing.totalAmount,
      currency: "INR",
      paymentStatus: "PENDING",
      verificationStatus: "PENDING",
      paymentMethod: "DEMO",
      failureReason: "Demo booking: payment was not processed through Razorpay.",
    });
    const bookingDetailsResult = await bookingDetails(booking.bookingId, connection);
    await connection.query("COMMIT");

    let emailNotifications = [];
    try {
      emailNotifications = await sendBookingConfirmationEmails(
        {
          ...bookingDetailsResult,
          ...pricing,
          PaymentMethod: "DEMO",
          PaymentStatus: "DEMO - PAYMENT NOT PROCESSED THROUGH RAZORPAY",
        },
        facultyInChargeEmail
      );
    } catch (error) {
      console.error("Demo booking saved but confirmation email workflow failed:", error.message);
    }

    return res.status(201).json({
      success: true,
      message: "Booking Confirmed — Demo Mode. Payment was not processed through Razorpay.",
      paymentMode: "DEMO",
      payment: { method: "DEMO", status: "PENDING", verificationStatus: "PENDING" },
      booking: { ...bookingDetailsResult, ...pricing },
      emailNotifications: emailNotifications.map(({ recipientType, status }) => ({ recipientType, status })),
    });
  } catch (error) {
    if (connection) await connection.query("ROLLBACK");
    return next(error);
  } finally {
    connection?.release();
  }
}
