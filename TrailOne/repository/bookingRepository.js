import crypto from "node:crypto";
import pool from "../config/db.js";

const reference = (prefix) => `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
export async function createHold(connection, { customerId, inDate, outDate, roomIds }) {

  const requestReference = reference("REQ");
  const [result] = await connection.execute("INSERT INTO booking_requests (RequestReference, CustomerId, InDate, OutDate, ExpiresAt) VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))",
                   [requestReference, customerId, inDate, outDate, Number(process.env.HOLD_MINUTES || 10)]);

  for (const roomId of roomIds) 
    await connection.execute("INSERT INTO request_rooms (RequestId, RoomId) VALUES (?, ?)", [result.insertId, roomId]);

  return { requestId: result.insertId,
           requestReference };

}
export async function findHoldForCustomer(connection, requestId, customerId) { 

  const [rows] = await connection.execute("SELECT * FROM booking_requests WHERE RequestId = ? AND CustomerId = ? FOR UPDATE", 
                                          [requestId, customerId]); return rows[0] || null;

  }
export async function createBookingFromHold(connection, request) {

  const bookingReference = reference("BKG");
  const [result] = await connection.execute("INSERT INTO bookings (BookingReference, RequestId, CustomerId, InDate, OutDate) VALUES (?, ?, ?, ?, ?)",
                                            [bookingReference, request.RequestId, request.CustomerId, request.InDate, request.OutDate]);

  await connection.execute("INSERT INTO booking_rooms (BookingId, RoomId) SELECT ?, RoomId FROM request_rooms WHERE RequestId = ?",
                           [result.insertId, request.RequestId]);

  await connection.execute("UPDATE booking_requests SET RequestStatus = 'CONFIRMED' WHERE RequestId = ?", 
                            [request.RequestId]);

  return { bookingId: result.insertId, bookingReference };

}
export async function bookingDetails(bookingId) {
  const [bookings] = await pool.execute("SELECT b.BookingId, b.BookingReference, b.InDate, b.OutDate, b.ConfirmedAt, c.FullName, c.Email FROM bookings b JOIN customers c ON c.CustomerId = b.CustomerId WHERE b.BookingId = ?", 
                                        [bookingId]);
  if (!bookings[0]) return null;
  const [rooms] = await pool.execute("SELECT r.RoomId, r.RoomNo, r.Floor FROM booking_rooms br JOIN rooms r ON r.RoomId = br.RoomId WHERE br.BookingId = ? ORDER BY r.Floor, r.RoomNo", 
                                      [bookingId]);
  return { ...bookings[0], rooms };
}

/** Returns the verified guest and every room in a newly created temporary hold. */
export async function holdDetails(requestId, customerId) {
  const [requests] = await pool.execute(
    `SELECT br.RequestId, br.RequestReference, br.RequestStatus,
            br.InDate, br.OutDate, br.CreatedAt, br.ExpiresAt,
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
