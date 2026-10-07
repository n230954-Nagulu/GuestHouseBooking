import pool from "../config/db.js";

export async function expireHolds(connection = pool) {
  await connection.query(
    `UPDATE booking_requests
     SET "RequestStatus" = 'EXPIRED'
     WHERE "RequestStatus" = 'HOLD'
       AND "ExpiresAt" <= CURRENT_TIMESTAMP`
  );
}

export async function getAllRooms() {
  const { rows } = await pool.query(
    `SELECT "RoomId", "RoomNo", "Floor", "RoomCondition"
     FROM rooms
     ORDER BY "Floor", "RoomNo"`
  );
  return rows.map((room) => ({ ...room, RoomId: Number(room.RoomId) }));
}

export async function getAvailableRooms(inDate, outDate, connection = pool) {
  const { rows } = await connection.query(
    `SELECT r."RoomId", r."RoomNo", r."Floor", r."RoomCondition" FROM rooms r
     WHERE r."RoomCondition" = 'AVAILABLE'
       AND NOT EXISTS (
         SELECT 1
         FROM request_rooms rr
         JOIN booking_requests br ON br."RequestId" = rr."RequestId"
         WHERE rr."RoomId" = r."RoomId"
           AND br."RequestStatus" = 'HOLD'
           AND br."ExpiresAt" > CURRENT_TIMESTAMP
           AND br."InDate" < $1
           AND br."OutDate" > $2
       )
       AND NOT EXISTS (
         SELECT 1
         FROM booking_rooms bor
         JOIN bookings b ON b."BookingId" = bor."BookingId"
         WHERE bor."RoomId" = r."RoomId"
           AND b."InDate" < $1
           AND b."OutDate" > $2
       )
     ORDER BY r."Floor", r."RoomNo"`,
    [outDate, inDate]
  );
  return rows.map((room) => ({ ...room, RoomId: Number(room.RoomId) }));
}

export async function lockSelectedRooms(connection, roomIds) {
  const { rows } = await connection.query(
    `SELECT "RoomId"
     FROM rooms
     WHERE "RoomId" = ANY($1::bigint[])
     ORDER BY "RoomId"
     FOR UPDATE`,
    [roomIds]
  );
  return rows;
}
