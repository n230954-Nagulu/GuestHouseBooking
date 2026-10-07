import crypto from "node:crypto";
import pool from "../config/db.js";

const reference = (prefix) => `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;

async function hasColumn(connection, tableName, columnName) {
  const { rows } = await connection.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

export async function createHold(connection, { customerId, inDate, outDate, roomIds, facultyInChargeName = "", facultyInChargeEmail = "" }) {
  const requestReference = reference("REQ");
  const cleanFacultyName = String(facultyInChargeName || "").trim();
  const cleanFacultyEmail = String(facultyInChargeEmail || "").trim().toLowerCase();
  const supportsFacultyInCharge = await hasColumn(connection, "booking_requests", "FacultyInChargeName");
  const values = supportsFacultyInCharge
    ? [requestReference, customerId, cleanFacultyName || null, cleanFacultyEmail || null, inDate, outDate, Number(process.env.HOLD_MINUTES || 10)]
    : [requestReference, customerId, cleanFacultyEmail || null, inDate, outDate, Number(process.env.HOLD_MINUTES || 10)];
  const insert = supportsFacultyInCharge
    ? `INSERT INTO booking_requests
         ("RequestReference", "CustomerId", "FacultyInChargeName", "FacultyInChargeEmail", "InDate", "OutDate", "ExpiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + ($7::double precision * INTERVAL '1 minute'))
       RETURNING "RequestId"`
    : `INSERT INTO booking_requests
         ("RequestReference", "CustomerId", "FacultyInChargeEmail", "InDate", "OutDate", "ExpiresAt")
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + ($6::double precision * INTERVAL '1 minute'))
       RETURNING "RequestId"`;
  const { rows } = await connection.query(insert, values);
  const requestId = Number(rows[0].RequestId);

  for (const roomId of roomIds) {
    await connection.query(
      `INSERT INTO request_rooms ("RequestId", "RoomId") VALUES ($1, $2)`,
      [requestId, roomId]
    );
  }

  return { requestId, requestReference };
}

export async function updateHoldFacultyInCharge(connection, requestId, customerId, name, email) {
  const hasName = await hasColumn(connection, "booking_requests", "FacultyInChargeName");
  const hasEmail = await hasColumn(connection, "booking_requests", "FacultyInChargeEmail");
  if (!hasName || !hasEmail) {
    throw new Error("Booking faculty fields are missing. Apply the booking schema adjustments before confirming.");
  }

  await connection.query(
    `UPDATE booking_requests
     SET "FacultyInChargeName" = $1, "FacultyInChargeEmail" = $2
     WHERE "RequestId" = $3 AND "CustomerId" = $4`,
    [name, email, requestId, customerId]
  );
}

export async function findHoldForCustomer(connection, requestId, customerId) {
  const { rows } = await connection.query(
    `SELECT * FROM booking_requests
     WHERE "RequestId" = $1 AND "CustomerId" = $2
     FOR UPDATE`,
    [requestId, customerId]
  );

  return rows[0] || null;
}

export async function createBookingFromHold(connection, request) {
  const bookingReference = reference("BKG");
  const supportsFacultyInCharge = await hasColumn(connection, "bookings", "FacultyInChargeName");
  const insert = supportsFacultyInCharge
    ? `INSERT INTO bookings
         ("BookingReference", "RequestId", "CustomerId", "FacultyInChargeName", "FacultyInChargeEmail", "InDate", "OutDate", "BookingStatus", "PaymentStatus")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', 'PENDING')
       RETURNING "BookingId"`
    : `INSERT INTO bookings
         ("BookingReference", "RequestId", "CustomerId", "FacultyInChargeEmail", "InDate", "OutDate", "BookingStatus", "PaymentStatus")
     VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', 'PENDING')
       RETURNING "BookingId"`;
  const values = supportsFacultyInCharge
    ? [bookingReference, request.RequestId, request.CustomerId, request.FacultyInChargeName || null, request.FacultyInChargeEmail, request.InDate, request.OutDate]
    : [bookingReference, request.RequestId, request.CustomerId, request.FacultyInChargeEmail, request.InDate, request.OutDate];
  const { rows } = await connection.query(insert, values);
  const bookingId = Number(rows[0].BookingId);

  await connection.query(
    `INSERT INTO booking_rooms ("BookingId", "RoomId")
     SELECT $1, "RoomId" FROM request_rooms WHERE "RequestId" = $2`,
    [bookingId, request.RequestId]
  );

  await connection.query(
    `UPDATE booking_requests SET "RequestStatus" = 'CONFIRMED' WHERE "RequestId" = $1`,
    [request.RequestId]
  );

  return { bookingId, bookingReference };
}

export async function findBookingByRequestId(connection, requestId) {
  const { rows } = await connection.query(
    `SELECT * FROM bookings WHERE "RequestId" = $1 LIMIT 1`,
    [requestId]
  );

  return rows[0] || null;
}

export async function bookingDetails(bookingId, connection = pool) {
  const supportsFacultyInCharge = await hasColumn(connection, "bookings", "FacultyInChargeName");
  const { rows: bookings } = await connection.query(
    `SELECT b."BookingId", b."BookingReference", b."InDate", b."OutDate", b."ConfirmedAt",
            b."BookingStatus", b."PaymentStatus",
            ${supportsFacultyInCharge ? 'b."FacultyInChargeName"' : 'NULL AS "FacultyInChargeName"'},
            b."FacultyInChargeEmail",
            c."CustomerId", c."FullName", c."Email", c."Phone"
     FROM bookings b
     JOIN customers c ON c."CustomerId" = b."CustomerId"
     WHERE b."BookingId" = $1`,
    [bookingId]
  );

  if (!bookings[0]) return null;

  const { rows: rooms } = await connection.query(
    `SELECT r."RoomId", r."RoomNo", r."Floor"
     FROM booking_rooms br
     JOIN rooms r ON r."RoomId" = br."RoomId"
     WHERE br."BookingId" = $1
     ORDER BY r."Floor", r."RoomNo"`,
    [bookingId]
  );

  return {
    ...bookings[0],
    BookingId: Number(bookings[0].BookingId),
    CustomerId: Number(bookings[0].CustomerId),
    rooms: rooms.map((room) => ({ ...room, RoomId: Number(room.RoomId) })),
  };
}

export async function markBookingPaid(connection, bookingId) {
  await connection.query(
    `UPDATE bookings
     SET "PaymentStatus" = 'SUCCESS',
         "ConfirmedAt" = COALESCE("ConfirmedAt", CURRENT_TIMESTAMP)
     WHERE "BookingId" = $1`,
    [bookingId]
  );
}

/** Returns the verified guest and every room in a newly created temporary hold. */
export async function holdDetails(requestId, customerId, connection = pool) {
  const supportsFacultyInCharge = await hasColumn(connection, "booking_requests", "FacultyInChargeName");
  const { rows: requests } = await connection.query(
    `SELECT br."RequestId", br."RequestReference", br."RequestStatus",
            br."InDate", br."OutDate", br."CreatedAt", br."ExpiresAt",
            ${supportsFacultyInCharge ? 'br."FacultyInChargeName"' : 'NULL AS "FacultyInChargeName"'},
            br."FacultyInChargeEmail",
            c."CustomerId", c."FullName", c."Email", c."Phone"
     FROM booking_requests br
     JOIN customers c ON c."CustomerId" = br."CustomerId"
     WHERE br."RequestId" = $1 AND br."CustomerId" = $2`,
    [requestId, customerId]
  );

  if (!requests[0]) {
    return null;
  }

  const { rows: rooms } = await connection.query(
    `SELECT r."RoomId", r."RoomNo", r."Floor"
     FROM request_rooms rr
     JOIN rooms r ON r."RoomId" = rr."RoomId"
     WHERE rr."RequestId" = $1
     ORDER BY r."Floor", r."RoomNo"`,
    [requestId]
  );

  return {
    ...requests[0],
    RequestId: Number(requests[0].RequestId),
    CustomerId: Number(requests[0].CustomerId),
    rooms: rooms.map((room) => ({ ...room, RoomId: Number(room.RoomId) })),
  };
}
