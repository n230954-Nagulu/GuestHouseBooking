import crypto from "node:crypto";
import pool from "../config/db.js";

const reference = (prefix) => `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;

async function hasColumn(connectionOrPool, tableName, columnName) {
  const [rows] = await connectionOrPool.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

export async function createHold(connection, { customerId, inDate, outDate, roomIds, facultyInChargeName = "", facultyInChargeEmail }) {
  const requestReference = reference("REQ");
  const cleanFacultyName = String(facultyInChargeName || "").trim();
  const cleanFacultyEmail = String(facultyInChargeEmail || "").trim().toLowerCase();
  const supportsFacultyInCharge = await hasColumn(connection, "booking_requests", "FacultyInChargeName");

  const [result] = await connection.execute(
    supportsFacultyInCharge
    ? `INSERT INTO booking_requests (RequestReference, CustomerId, FacultyInChargeName, FacultyInChargeEmail, InDate, OutDate, ExpiresAt)
      VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`
    : `INSERT INTO booking_requests (RequestReference, CustomerId, FacultyInChargeEmail, InDate, OutDate, ExpiresAt)
      VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
    supportsFacultyInCharge
    ? [requestReference, customerId, cleanFacultyName, cleanFacultyEmail, inDate, outDate, Number(process.env.HOLD_MINUTES || 10)]
    : [requestReference, customerId, cleanFacultyEmail, inDate, outDate, Number(process.env.HOLD_MINUTES || 10)]
  );

  for (const roomId of roomIds) {
    await connection.execute("INSERT INTO request_rooms (RequestId, RoomId) VALUES (?, ?)", [result.insertId, roomId]);
  }

  return { requestId: result.insertId, requestReference };
}

export async function findHoldForCustomer(connection, requestId, customerId) {
  const [rows] = await connection.execute(
    `SELECT * FROM booking_requests WHERE RequestId = ? AND CustomerId = ? FOR UPDATE`,
    [requestId, customerId]
  );

  return rows[0] || null;
}

export async function createBookingFromHold(connection, request) {
  const bookingReference = reference("BKG");
  const supportsFacultyInCharge = await hasColumn(connection, "bookings", "FacultyInChargeName");
  const [result] = await connection.execute(
    supportsFacultyInCharge
      ? `INSERT INTO bookings (BookingReference, RequestId, CustomerId, FacultyInChargeName, FacultyInChargeEmail, InDate, OutDate, BookingStatus, PaymentStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', 'PENDING')`
      : `INSERT INTO bookings (BookingReference, RequestId, CustomerId, FacultyInChargeEmail, InDate, OutDate, BookingStatus, PaymentStatus)
        VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', 'PENDING')`,
    supportsFacultyInCharge
      ? [bookingReference, request.RequestId, request.CustomerId, request.FacultyInChargeName || null, request.FacultyInChargeEmail, request.InDate, request.OutDate]
      : [bookingReference, request.RequestId, request.CustomerId, request.FacultyInChargeEmail, request.InDate, request.OutDate]
  );

  await connection.execute(
    "INSERT INTO booking_rooms (BookingId, RoomId) SELECT ?, RoomId FROM request_rooms WHERE RequestId = ?",
    [result.insertId, request.RequestId]
  );

  await connection.execute("UPDATE booking_requests SET RequestStatus = 'CONFIRMED' WHERE RequestId = ?", [request.RequestId]);

  return { bookingId: result.insertId, bookingReference };
}

export async function findBookingByRequestId(connection, requestId) {
  const [rows] = await connection.execute(
    "SELECT * FROM bookings WHERE RequestId = ? LIMIT 1",
    [requestId]
  );

  return rows[0] || null;
}

export async function bookingDetails(bookingId, connection = pool) {
  const supportsFacultyInCharge = await hasColumn(connection, "bookings", "FacultyInChargeName");
  const [bookings] = await connection.execute(
    `SELECT b.BookingId, b.BookingReference, b.InDate, b.OutDate, b.ConfirmedAt,
            b.BookingStatus, b.PaymentStatus,
            ${supportsFacultyInCharge ? "b.FacultyInChargeName" : "NULL AS FacultyInChargeName"},
            b.FacultyInChargeEmail,
            c.CustomerId, c.FullName, c.Email, c.Phone
     FROM bookings b
     JOIN customers c ON c.CustomerId = b.CustomerId
     WHERE b.BookingId = ?`,
    [bookingId]
  );

  if (!bookings[0]) return null;

  const [rooms] = await connection.execute(
    `SELECT r.RoomId, r.RoomNo, r.Floor
     FROM booking_rooms br
     JOIN rooms r ON r.RoomId = br.RoomId
     WHERE br.BookingId = ?
     ORDER BY r.Floor, r.RoomNo`,
    [bookingId]
  );

  return { ...bookings[0], rooms };
}

export async function markBookingPaid(connection, bookingId) {
  await connection.execute(
    `UPDATE bookings
     SET PaymentStatus = 'SUCCESS', ConfirmedAt = COALESCE(ConfirmedAt, UTC_TIMESTAMP())
     WHERE BookingId = ?`,
    [bookingId]
  );
}

/** Returns the verified guest and every room in a newly created temporary hold. */
export async function holdDetails(requestId, customerId) {
  const supportsFacultyInCharge = await hasColumn(pool, "booking_requests", "FacultyInChargeName");
  const [requests] = await pool.execute(
    `SELECT br.RequestId, br.RequestReference, br.RequestStatus,
            br.InDate, br.OutDate, br.CreatedAt, br.ExpiresAt,
            ${supportsFacultyInCharge ? "br.FacultyInChargeName" : "NULL AS FacultyInChargeName"},
            br.FacultyInChargeEmail,
            c.CustomerId, c.FullName, c.Email, c.Phone
     FROM booking_requests br
     JOIN customers c ON c.CustomerId = br.CustomerId
     WHERE br.RequestId = ? AND br.CustomerId = ?`,
    [requestId, customerId]
  );

  if (!requests[0]) {
    return null;
  }

  const [rooms] = await pool.execute(
    `SELECT r.RoomId, r.RoomNo, r.Floor
     FROM request_rooms rr
     JOIN rooms r ON r.RoomId = rr.RoomId
     WHERE rr.RequestId = ?
     ORDER BY r.Floor, r.RoomNo`,
    [requestId]
  );

  return { ...requests[0], rooms };
}
