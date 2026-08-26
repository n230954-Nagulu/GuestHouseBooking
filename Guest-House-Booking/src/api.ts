const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "")

export type Session = {
  token: string
  customer: { customerId: number; fullName: string; email: string }
}

export type ApiRoom = {
  RoomId: number
  RoomNo: string
  Floor: number
  RoomCondition: string
  isAvailable: boolean
}

export type Booking = {
  BookingId: number
  BookingReference: string
  InDate: string
  OutDate: string
  rooms: ApiRoom[]
  pricePerRoomPerDay: number
  roomCount: number
  nights: number
  totalAmount: number
}

type ApiResponse<T> = T & { success: boolean; message?: string }

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  })
  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>
  if (!response.ok || !data.success) throw new Error(data.message || "The booking service is unavailable.")
  return data
}

export async function getAvailableRooms(inDate: string, outDate: string) {
  return request<{ rooms: ApiRoom[]; pricePerRoomPerDay: number }>(`/rooms/available?inDate=${encodeURIComponent(inDate)}&outDate=${encodeURIComponent(outDate)}`)
}

export async function requestCode(fullName: string, email: string, phone: string) {
  return request<{}>("/auth/request-code", { method: "POST", body: JSON.stringify({ fullName, email, phone }) })
}

export async function verifyCode(email: string, code: string) {
  return request<Session>("/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code }) })
}

export type BookingHold = {
  bookingRequest: {
    requestId: number
    requestReference: string
    status: string
    inDate: string
    outDate: string
    expiresAt: string
    rooms: ApiRoom[]
    pricePerRoomPerDay: number
    roomCount: number
    nights: number
    totalAmount: number
  }
}

export async function createBookingHold(session: Session, inDate: string, outDate: string, roomIds: number[]) {
  const headers = { Authorization: `Bearer ${session.token}` }
  return request<BookingHold>("/bookings/holds", {
    method: "POST",
    headers,
    body: JSON.stringify({ customerId: session.customer.customerId, inDate, outDate, roomIds }),
  })
}

export async function confirmBooking(session: Session, requestId: number) {
  const headers = { Authorization: `Bearer ${session.token}` }
  return request<{ booking: Booking }>(`/bookings/holds/${requestId}/confirm`, { method: "POST", headers })
}
