DROP DATABASE IF EXISTS hotel_booking;
CREATE DATABASE hotel_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel_booking;

-- ==========================================================
-- 1) Customers and email verification temp table
-- ==========================================================
CREATE TABLE customers (
  CustomerId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  FullName VARCHAR(120) NOT NULL,
  Email VARCHAR(180) NOT NULL,
  Phone VARCHAR(30) NOT NULL,
  SecretKey VARCHAR(255) NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (CustomerId),
  UNIQUE KEY uq_customers_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE TempCust (
  requestId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  FullName VARCHAR(120) NOT NULL,
  Email VARCHAR(180) NOT NULL,
  Phone VARCHAR(30) NOT NULL,
  SecretKey VARCHAR(255) NOT NULL,
  expiresAt DATETIME NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (requestId),
  UNIQUE KEY uq_tempcust_email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- 2) Rooms
-- ==========================================================
CREATE TABLE rooms (
  RoomId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  RoomNo VARCHAR(20) NOT NULL,
  Floor INT NOT NULL,
  RoomCondition ENUM('AVAILABLE','MAINTENANCE','BOOKED') NOT NULL DEFAULT 'AVAILABLE',
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (RoomId),
  UNIQUE KEY uq_rooms_roomno (RoomNo),
  KEY idx_rooms_floor (Floor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- 3) Booking requests and request-room mapping
-- ==========================================================
CREATE TABLE booking_requests (
  RequestId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  RequestReference VARCHAR(80) NOT NULL,
  CustomerId BIGINT UNSIGNED NOT NULL,
  FacultyInChargeName VARCHAR(120) NULL,
  FacultyInChargeEmail VARCHAR(254) NULL,
  InDate DATE NOT NULL,
  OutDate DATE NOT NULL,
  RequestStatus ENUM('HOLD','CONFIRMED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'HOLD',
  ExpiresAt DATETIME NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (RequestId),
  UNIQUE KEY uq_booking_requests_reference (RequestReference),
  KEY idx_booking_requests_customer (CustomerId),
  KEY idx_booking_requests_status_dates (RequestStatus, InDate, OutDate, ExpiresAt),
  CONSTRAINT fk_booking_requests_customer
    FOREIGN KEY (CustomerId) REFERENCES customers(CustomerId)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE request_rooms (
  RequestRoomId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  RequestId BIGINT UNSIGNED NOT NULL,
  RoomId BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (RequestRoomId),
  UNIQUE KEY uq_request_rooms_pair (RequestId, RoomId),
  KEY idx_request_rooms_room (RoomId),
  CONSTRAINT fk_request_rooms_request
    FOREIGN KEY (RequestId) REFERENCES booking_requests(RequestId)
    ON DELETE CASCADE,
  CONSTRAINT fk_request_rooms_room
    FOREIGN KEY (RoomId) REFERENCES rooms(RoomId)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- 4) Bookings and booking-room mapping
-- ==========================================================
CREATE TABLE bookings (
  BookingId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  BookingReference VARCHAR(80) NOT NULL,
  RequestId BIGINT UNSIGNED NOT NULL,
  CustomerId BIGINT UNSIGNED NOT NULL,
  FacultyInChargeName VARCHAR(120) NULL,
  FacultyInChargeEmail VARCHAR(254) NULL,
  InDate DATE NOT NULL,
  OutDate DATE NOT NULL,
  BookingStatus ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  PaymentStatus ENUM('PENDING','CREATED','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  ConfirmedAt TIMESTAMP NULL DEFAULT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (BookingId),
  UNIQUE KEY uq_bookings_reference (BookingReference),
  UNIQUE KEY uq_bookings_request (RequestId),
  KEY idx_bookings_customer (CustomerId),
  KEY idx_bookings_status (BookingStatus, PaymentStatus),
  CONSTRAINT fk_bookings_request
    FOREIGN KEY (RequestId) REFERENCES booking_requests(RequestId)
    ON DELETE CASCADE,
  CONSTRAINT fk_bookings_customer
    FOREIGN KEY (CustomerId) REFERENCES customers(CustomerId)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE booking_rooms (
  BookingRoomId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  BookingId BIGINT UNSIGNED NOT NULL,
  RoomId BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (BookingRoomId),
  UNIQUE KEY uq_booking_rooms_pair (BookingId, RoomId),
  KEY idx_booking_rooms_room (RoomId),
  CONSTRAINT fk_booking_rooms_booking
    FOREIGN KEY (BookingId) REFERENCES bookings(BookingId)
    ON DELETE CASCADE,
  CONSTRAINT fk_booking_rooms_room
    FOREIGN KEY (RoomId) REFERENCES rooms(RoomId)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- 5) Payment verification tables
-- ==========================================================
CREATE TABLE payments (
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
  KEY idx_payments_status (PaymentStatus, VerificationStatus),
  CONSTRAINT fk_payments_booking
    FOREIGN KEY (BookingId) REFERENCES bookings(BookingId)
    ON DELETE SET NULL,
  CONSTRAINT fk_payments_request
    FOREIGN KEY (RequestId) REFERENCES booking_requests(RequestId)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE booking_notifications (
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
  CONSTRAINT fk_notifications_booking
    FOREIGN KEY (BookingId) REFERENCES bookings(BookingId)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- 6) Seed room data
-- ==========================================================
INSERT INTO rooms (RoomNo, Floor, RoomCondition) VALUES
('101', 1, 'AVAILABLE'),
('102', 1, 'AVAILABLE'),
('103', 1, 'AVAILABLE'),
('104', 1, 'MAINTENANCE'),
('105', 1, 'AVAILABLE'),
('201', 2, 'AVAILABLE'),
('202', 2, 'AVAILABLE'),
('203', 2, 'AVAILABLE'),
('204', 2, 'MAINTENANCE'),
('205', 2, 'AVAILABLE'),
('301', 3, 'AVAILABLE'),
('302', 3, 'AVAILABLE'),
('303', 3, 'AVAILABLE'),
('304', 3, 'AVAILABLE'),
('305', 3, 'MAINTENANCE'),
('401', 4, 'AVAILABLE'),
('402', 4, 'AVAILABLE'),
('403', 4, 'MAINTENANCE'),
('404', 4, 'AVAILABLE'),
('405', 4, 'AVAILABLE');

-- ==========================================================
-- 7) Optional indexes for the app
-- ==========================================================
CREATE INDEX idx_request_rooms_room_request ON request_rooms (RoomId, RequestId);
CREATE INDEX idx_booking_rooms_room_booking ON booking_rooms (RoomId, BookingId);
CREATE INDEX idx_booking_requests_expires ON booking_requests (RequestStatus, ExpiresAt);
CREATE INDEX idx_bookings_dates ON bookings (InDate, OutDate);

SELECT 'Database schema created successfully.' AS status;
