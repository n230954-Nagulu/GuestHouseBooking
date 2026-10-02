-- Run this once after creating the original schema supplied for this project.
-- FullName is required before verification. SecretKey values are bcrypt hashes.
ALTER TABLE TempCust ADD COLUMN FullName VARCHAR(100) NOT NULL AFTER requestId;
ALTER TABLE TempCust MODIFY SecretKey VARCHAR(255) NOT NULL;
ALTER TABLE customers MODIFY SecretKey VARCHAR(255) NOT NULL;

ALTER TABLE customers ADD COLUMN FacultyInChargeName VARCHAR(120) NULL AFTER Phone;
ALTER TABLE booking_requests ADD COLUMN FacultyInChargeName VARCHAR(120) NULL AFTER CustomerId;
ALTER TABLE booking_requests ADD COLUMN FacultyInChargeEmail VARCHAR(254) NULL AFTER FacultyInChargeName;
ALTER TABLE bookings ADD COLUMN FacultyInChargeName VARCHAR(120) NULL AFTER CustomerId;
ALTER TABLE bookings ADD COLUMN FacultyInChargeEmail VARCHAR(254) NULL AFTER FacultyInChargeName;
ALTER TABLE bookings ADD COLUMN BookingStatus VARCHAR(30) NOT NULL DEFAULT 'PENDING' AFTER OutDate;
ALTER TABLE bookings ADD COLUMN PaymentStatus VARCHAR(30) NOT NULL DEFAULT 'PENDING' AFTER BookingStatus;

-- A request can result in only one confirmed booking.
ALTER TABLE bookings ADD CONSTRAINT uq_bookings_request UNIQUE (RequestId);

-- Payment tables and notification tracking.
CREATE TABLE IF NOT EXISTS payments (
  PaymentId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  BookingId BIGINT UNSIGNED NULL,
  RequestId BIGINT UNSIGNED NULL,
  RazorpayOrderId VARCHAR(255) NOT NULL,
  RazorpayPaymentId VARCHAR(255) NULL,
  RazorpaySignature VARCHAR(255) NULL,
  Amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  Currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  PaymentStatus ENUM('CREATED','PENDING','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'CREATED',
  PaymentMethod VARCHAR(30) NOT NULL DEFAULT 'RAZORPAY',
  VerificationStatus ENUM('PENDING','VERIFIED','FAILED') NOT NULL DEFAULT 'PENDING',
  FailureReason VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  VerifiedAt TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (PaymentId),
  UNIQUE KEY uq_payments_order (RazorpayOrderId),
  KEY idx_payments_booking (BookingId),
  KEY idx_payments_request (RequestId),
  CONSTRAINT fk_payments_booking FOREIGN KEY (BookingId) REFERENCES bookings (BookingId) ON DELETE SET NULL,
  CONSTRAINT fk_payments_request FOREIGN KEY (RequestId) REFERENCES booking_requests (RequestId) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_notifications (
  NotificationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  BookingId BIGINT UNSIGNED NOT NULL,
  RecipientEmail VARCHAR(255) NOT NULL,
  RecipientName VARCHAR(120) NOT NULL,
  NotificationType VARCHAR(60) NOT NULL,
  NotificationStatus ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  SentAt TIMESTAMP NULL DEFAULT NULL,
  ErrorMessage TEXT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (NotificationId),
  KEY idx_notifications_booking (BookingId),
  CONSTRAINT fk_notifications_booking FOREIGN KEY (BookingId) REFERENCES bookings (BookingId) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes for availability checks.
CREATE INDEX idx_booking_requests_status_dates ON booking_requests (RequestStatus, InDate, OutDate, ExpiresAt);
CREATE INDEX idx_request_rooms_room_request ON request_rooms (RoomId, RequestId);
CREATE INDEX idx_booking_rooms_room_booking ON booking_rooms (RoomId, BookingId);
CREATE INDEX idx_payments_status ON payments (PaymentStatus, VerificationStatus);
CREATE INDEX idx_bookings_status ON bookings (BookingStatus, PaymentStatus);
