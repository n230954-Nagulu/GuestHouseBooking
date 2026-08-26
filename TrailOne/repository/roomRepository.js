import pool from "../config/db.js";

export async function expireHolds(connection = pool) {
  await connection.execute(
    `UPDATE booking_requests
     SET RequestStatus = 'EXPIRED'
     WHERE RequestStatus = 'HOLD'
       AND ExpiresAt <= UTC_TIMESTAMP()`
  );
}
export async function getAllRooms() {
  const [rows] = await pool.execute("SELECT RoomId, RoomNo, Floor, RoomCondition FROM rooms ORDER BY Floor, RoomNo");
  return rows;
}
export async function getAvailableRooms(inDate, outDate, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT r.RoomId, r.RoomNo, r.Floor, r.RoomCondition FROM rooms r
     WHERE r.RoomCondition = 'AVAILABLE'
       AND NOT EXISTS (SELECT 1 FROM request_rooms rr JOIN booking_requests br ON br.RequestId = rr.RequestId WHERE rr.RoomId = r.RoomId AND br.RequestStatus = 'HOLD' AND br.ExpiresAt > UTC_TIMESTAMP() AND br.InDate < ? AND br.OutDate > ?)
       AND NOT EXISTS (SELECT 1 FROM booking_rooms bor JOIN bookings b ON b.BookingId = bor.BookingId WHERE bor.RoomId = r.RoomId AND b.InDate < ? AND b.OutDate > ?)
     ORDER BY r.Floor, r.RoomNo`, [outDate, inDate, outDate, inDate]
  );
  return rows;
}
export async function lockSelectedRooms(connection, roomIds) {
  const marks = roomIds.map(() => "?").join(",");
  const [rows] = await connection.execute(`SELECT RoomId FROM rooms WHERE RoomId IN (${marks}) FOR UPDATE`, roomIds);
  return rows;
}
