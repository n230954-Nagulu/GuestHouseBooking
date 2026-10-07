import crypto from "node:crypto";
import Razorpay from "razorpay";
import pool from "../config/db.js";
import { findHoldForCustomer, createBookingFromHold, bookingDetails, findBookingByRequestId, holdDetails, markBookingPaid, updateHoldFacultyInCharge } from "../repository/bookingRepository.js";
import { createPaymentRecord, findPaymentByOrderId, findPaymentByRequestId, updatePaymentRecord } from "../repository/paymentRepository.js";
import { expireHolds } from "../repository/roomRepository.js";
import { bookingPrice } from "../service/pricingService.js";
import { sendBookingConfirmationEmails } from "../service/emailService.js";

const razorpayClient = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay secret key is not configured.");
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  return expected === razorpay_signature;
}

function normalizeRequestId(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function createPaymentOrder(req, res, next) {
  try {
    const requestId = normalizeRequestId(req.body.requestId);
    const facultyInChargeName = String(req.body.facultyInChargeName || "").trim();
    const facultyInChargeEmail = String(req.body.facultyInChargeEmail || "").trim().toLowerCase();

    if (!requestId) {
      return res.status(400).json({ success: false, message: "A valid booking request ID is required." });
    }
    if (facultyInChargeName.length < 2 || facultyInChargeName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(facultyInChargeEmail)) {
      return res.status(400).json({ success: false, message: "Valid faculty in-charge name and email are required." });
    }

    if (!razorpayClient) {
      return res.status(500).json({ success: false, message: "Razorpay is not configured on this server." });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await expireHolds(connection);
      const request = await findHoldForCustomer(connection, requestId, req.user.customerId);

      if (!request || request.RequestStatus !== "HOLD" || new Date(request.ExpiresAt) <= new Date()) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "This booking hold is expired or not available for payment." });
      }

      await updateHoldFacultyInCharge(connection, requestId, req.user.customerId, facultyInChargeName, facultyInChargeEmail);
      request.FacultyInChargeName = facultyInChargeName;
      request.FacultyInChargeEmail = facultyInChargeEmail;

      const hold = await holdDetails(requestId, req.user.customerId);
      const pricing = bookingPrice((hold?.rooms || []).length, request.InDate, request.OutDate);
      const amount = Number(pricing.totalAmount || 0);

      if (!amount || amount <= 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Booking amount could not be calculated." });
      }

      const existing = await findPaymentByRequestId(connection, requestId);
      if (existing?.PaymentMethod === "DEMO") {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "This booking request is already using demo mode." });
      }
      const order = await razorpayClient.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `req_${requestId}_${Date.now()}`,
      });

      if (existing) {
        await updatePaymentRecord(connection, existing.PaymentId, {
          RazorpayOrderId: order.id,
          Amount: amount,
          Currency: "INR",
          PaymentStatus: "CREATED",
          VerificationStatus: "PENDING",
          PaymentMethod: "RAZORPAY",
          FailureReason: null,
        });
      } else {
        await createPaymentRecord(connection, {
          requestId,
          razorpayOrderId: order.id,
          amount,
          currency: "INR",
          paymentStatus: "CREATED",
          verificationStatus: "PENDING",
          paymentMethod: "RAZORPAY",
        });
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: "Razorpay order created successfully.",
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
          receipt: order.receipt,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const requestId = normalizeRequestId(req.body.requestId || req.params.requestId);
    const razorpayOrderId = String(req.body.razorpay_order_id || "").trim();
    const razorpayPaymentId = String(req.body.razorpay_payment_id || "").trim();
    const razorpaySignature = String(req.body.razorpay_signature || "").trim();

    if (!requestId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: "Incomplete Razorpay payment details were provided." });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const payment = await findPaymentByRequestId(connection, requestId);

      if (!payment) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: "No payment record exists for this booking request." });
      }

      if (payment.PaymentMethod !== "RAZORPAY") {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "This payment record is not a Razorpay transaction." });
      }

      if (payment.PaymentStatus === "SUCCESS" && payment.VerificationStatus === "VERIFIED") {
        await connection.commit();
        return res.status(200).json({ success: true, message: "Payment already verified.", alreadyVerified: true });
      }

      const comparableOrder = await findPaymentByOrderId(connection, razorpayOrderId);
      if (!comparableOrder || Number(comparableOrder.RequestId) !== Number(requestId)) {
        await updatePaymentRecord(connection, payment.PaymentId, {
          PaymentStatus: "FAILED",
          VerificationStatus: "FAILED",
          FailureReason: "Razorpay order ID does not match the booking request.",
        });
        await connection.commit();
        return res.status(400).json({ success: false, message: "Razorpay order ID does not match this booking." });
      }

      const validSignature = verifySignature({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: razorpaySignature });

      if (!validSignature) {
        await updatePaymentRecord(connection, payment.PaymentId, {
          RazorpayPaymentId: razorpayPaymentId,
          RazorpaySignature: razorpaySignature,
          PaymentStatus: "FAILED",
          VerificationStatus: "FAILED",
          FailureReason: "Invalid Razorpay signature.",
        });
        await connection.commit();
        return res.status(400).json({ success: false, message: "Payment verification failed: invalid Razorpay signature." });
      }

      const request = await findHoldForCustomer(connection, requestId, req.user.customerId);
      if (!request || request.RequestStatus !== "HOLD" || new Date(request.ExpiresAt) <= new Date()) {
        await updatePaymentRecord(connection, payment.PaymentId, {
          RazorpayPaymentId: razorpayPaymentId,
          RazorpaySignature: razorpaySignature,
          PaymentStatus: "FAILED",
          VerificationStatus: "FAILED",
          FailureReason: "Booking hold has expired or is no longer valid.",
        });
        await connection.rollback();
        return res.status(409).json({ success: false, message: "This booking hold has expired before payment verification." });
      }

      const existingBooking = await findBookingByRequestId(connection, requestId);
      if (existingBooking) {
        await markBookingPaid(connection, existingBooking.BookingId);
        await updatePaymentRecord(connection, payment.PaymentId, {
          BookingId: existingBooking.BookingId,
          RazorpayPaymentId: razorpayPaymentId,
          RazorpaySignature: razorpaySignature,
          PaymentStatus: "SUCCESS",
          VerificationStatus: "VERIFIED",
        });
        await connection.commit();
        return res.status(200).json({ success: true, message: "This booking was already confirmed. Payment verification was accepted as idempotent.", alreadyVerified: true });
      }

      const booking = await createBookingFromHold(connection, request);
      await markBookingPaid(connection, booking.bookingId);
      const bookingData = await bookingDetails(booking.bookingId, connection);
      const pricing = bookingPrice(bookingData.rooms.length, request.InDate, request.OutDate);
      const bookingWithPricing = { ...bookingData, ...pricing };

      await updatePaymentRecord(connection, payment.PaymentId, {
        BookingId: booking.bookingId,
        RazorpayPaymentId: razorpayPaymentId,
        RazorpaySignature: razorpaySignature,
        PaymentStatus: "SUCCESS",
        VerificationStatus: "VERIFIED",
      });

      await connection.commit();

      let emailNotifications = [];
      try {
        emailNotifications = await sendBookingConfirmationEmails(bookingWithPricing, request.FacultyInChargeEmail);
      } catch (error) {
        console.error("Post-payment email workflow failed:", error.message);
      }

      return res.status(200).json({
        success: true,
        message: "Payment verified and booking confirmed.",
        booking: bookingWithPricing,
        emailNotifications: emailNotifications.map(({ recipientType, status }) => ({ recipientType, status })),
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
}
