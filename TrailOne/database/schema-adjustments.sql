-- Run this once after creating the original schema supplied for this project.
-- FullName is required before verification. SecretKey values are bcrypt hashes.
ALTER TABLE TempCust ADD COLUMN FullName VARCHAR(100) NOT NULL AFTER requestId;
ALTER TABLE TempCust MODIFY SecretKey VARCHAR(255) NOT NULL;
ALTER TABLE customers MODIFY SecretKey VARCHAR(255) NOT NULL;

-- A request can result in only one confirmed booking.
ALTER TABLE bookings ADD CONSTRAINT uq_bookings_request UNIQUE (RequestId);

-- Indexes for availability checks.
CREATE INDEX idx_booking_requests_status_dates ON booking_requests (RequestStatus, InDate, OutDate, ExpiresAt);
CREATE INDEX idx_request_rooms_room_request ON request_rooms (RoomId, RequestId);
CREATE INDEX idx_booking_rooms_room_booking ON booking_rooms (RoomId, BookingId);
