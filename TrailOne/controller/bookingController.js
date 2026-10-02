import pool from "../config/db.js";
import {
  bookingDetails,
  createBookingFromHold,
  createHold as persistHold,
  findHoldForCustomer,
  holdDetails,
} from "../repository/bookingRepository.js";
import { expireHolds, getAvailableRooms, lockSelectedRooms } from "../repository/roomRepository.js";
import { sendBookingConfirmation } from "../service/emailService.js";
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
  const facultyInChargeName = normalizeFacultyInCharge(req.body.facultyInChargeName);
  const facultyInChargeEmail = normalizeFacultyEmail(req.body.facultyInChargeEmail);

  if (!Number.isSafeInteger(customerId) || customerId !== req.user.customerId)
    return res.status(403).json({ success: false, message: "Customer ID does not match the authenticated user." });

  if (!validDates(inDate, outDate) || !roomIds)
    return res.status(400).json({ success: false, message: "Provide valid dates and at least one room ID." });

  if (facultyInChargeName.length < 2 || facultyInChargeName.length > 120)
    return res.status(400).json({ success: false, message: "Provide a faculty in-charge name between 2 and 120 characters." });

  if (facultyInChargeEmail.length > 254 || !validEmail.test(facultyInChargeEmail))
    return res.status(400).json({ success: false, message: "Provide a valid faculty in-charge email address." });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await expireHolds(connection);
    await lockSelectedRooms(connection, roomIds);

    const availableRooms = await getAvailableRooms(inDate, outDate, connection);
    const ids = new Set(availableRooms.map((r) => r.RoomId));
    const unavailableRoomIds = roomIds.filter((id) => !ids.has(id));

    if (unavailableRoomIds.length) {
      await connection.rollback();
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
      facultyInChargeName,
      facultyInChargeEmail,
    });

    await connection.commit();

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
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}

/** POST /api/bookings/holds/:requestId/confirm - legacy confirmation endpoint kept for compatibility. */
export async function confirmBooking(req, res, next) {
  const requestId = Number(req.params.requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1)
    return res.status(400).json({ success: false, message: "A valid request ID is required." });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await expireHolds(connection);
    const request = await findHoldForCustomer(connection, requestId, req.user.customerId);

    if (!request || request.RequestStatus !== "HOLD" || new Date(request.ExpiresAt) <= new Date()) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "This room hold has expired or cannot be confirmed." });
    }

    const booking = await createBookingFromHold(connection, request);
    await connection.commit();
    const details = await bookingDetails(booking.bookingId);
    const pricing = bookingPrice(details.rooms.length, request.InDate, request.OutDate);
    const bookingWithPricing = { ...details, ...pricing };

    let emailNotifications = [];
    try {
      emailNotifications = await sendBookingConfirmation(bookingWithPricing, request.FacultyInChargeEmail);
    } catch (error) {
      console.error("Booking saved but confirmation email failed:", error.message);
    }

    return res.status(201).json({
      success: true,
      message: "Booking confirmed.",
      booking: bookingWithPricing,
      emailNotifications: emailNotifications.map(({ recipientType, status }) => ({ recipientType, status })),
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}
