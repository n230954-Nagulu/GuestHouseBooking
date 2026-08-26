const configuredPrice = Number(process.env.ROOM_PRICE_PER_DAY || 300);

if (!Number.isFinite(configuredPrice) || configuredPrice < 0) {
  throw new Error("ROOM_PRICE_PER_DAY must be a non-negative number.");
}

export const ROOM_PRICE_PER_DAY = configuredPrice;

export function bookingPrice(roomCount, inDate, outDate) {
  const nights = (Date.parse(`${outDate}T00:00:00.000Z`) - Date.parse(`${inDate}T00:00:00.000Z`)) / 86400000;
  return {
    pricePerRoomPerDay: ROOM_PRICE_PER_DAY,
    roomCount,
    nights,
    totalAmount: ROOM_PRICE_PER_DAY * roomCount * nights
  };
}
