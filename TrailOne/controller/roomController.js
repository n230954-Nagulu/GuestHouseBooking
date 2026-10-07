import { expireHolds,
         getAllRooms,
         getAvailableRooms } from "../repository/roomRepository.js";
import { ROOM_PRICE_PER_DAY } from "../service/pricingService.js";

/** Validates API date strings and MySQL DATE values for a non-empty stay. */
export function validDates(inDate, outDate) {
  const toCalendarDate = (value) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return [
        String(value.getUTCFullYear()).padStart(4, "0"),
        String(value.getUTCMonth() + 1).padStart(2, "0"),
        String(value.getUTCDate()).padStart(2, "0"),
      ].join("-");
    }

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
      ? value
      : null;
  };

  const checkIn = toCalendarDate(inDate);
  const checkOut = toCalendarDate(outDate);
  return Boolean(checkIn && checkOut && checkOut > checkIn);
}

/** GET /api/rooms - returns all physical guest rooms. */
export async function listRooms(req, res, next) {
  try {
    return res.json({ success: true, rooms: await getAllRooms() });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/rooms/available - returns rooms free for the requested stay. */
export async function availableRooms(req, res, next) {
  try {
    
    const { inDate, outDate } = req.query;
    if (!validDates(inDate, outDate)) {
      return res.status(400).json({ success: false,
                                     message: "Provide valid inDate and outDate (YYYY-MM-DD), with outDate after inDate." });
    }
    await expireHolds();
    const [allRooms, availableRooms] = await Promise.all([
      getAllRooms(),
      getAvailableRooms(inDate, outDate)
    ]);
    const availableRoomIds = new Set(availableRooms.map((room) => room.RoomId));
    return res.json({
      success: true,
      inDate,
      outDate,
      pricePerRoomPerDay: ROOM_PRICE_PER_DAY,
      rooms: allRooms.map((room) => ({ ...room, isAvailable: availableRoomIds.has(room.RoomId) }))
    });
  } catch (error) {
    return next(error);
  }
}
