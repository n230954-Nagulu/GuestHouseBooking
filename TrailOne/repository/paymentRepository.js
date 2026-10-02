import pool from "../config/db.js";

export async function findPaymentByRequestId(connection, requestId) {
  const [rows] = await connection.execute(
    "SELECT * FROM payments WHERE RequestId = ? ORDER BY CreatedAt DESC LIMIT 1 FOR UPDATE",
    [requestId]
  );

  return rows[0] || null;
}

export async function findPaymentByOrderId(connection, razorpayOrderId) {
  const [rows] = await connection.execute(
    "SELECT * FROM payments WHERE RazorpayOrderId = ? LIMIT 1 FOR UPDATE",
    [razorpayOrderId]
  );

  return rows[0] || null;
}

export async function findPaymentById(connection, paymentId) {
  const [rows] = await connection.execute(
    "SELECT * FROM payments WHERE PaymentId = ? LIMIT 1",
    [paymentId]
  );

  return rows[0] || null;
}

export async function createPaymentRecord(
  connection,
  { requestId, bookingId = null, razorpayOrderId, amount, currency = "INR", paymentStatus = "CREATED", verificationStatus = "PENDING", paymentMethod = "RAZORPAY", failureReason = null }
) {
  const [result] = await connection.execute(
    `INSERT INTO payments
      (RequestId, BookingId, RazorpayOrderId, RazorpayPaymentId, RazorpaySignature, Amount, Currency, PaymentStatus, PaymentMethod, VerificationStatus, FailureReason, CreatedAt)
     VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [requestId, bookingId, razorpayOrderId, Number(amount), currency, paymentStatus, paymentMethod, verificationStatus, failureReason]
  );

  return { paymentId: result.insertId };
}

export async function updatePaymentRecord(connection, paymentId, updates) {
  const entries = Object.entries(updates || {});

  if (!entries.length) {
    return;
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await connection.execute(
    `UPDATE payments SET ${assignments}, VerifiedAt = COALESCE(VerifiedAt, CASE WHEN ? = 'VERIFIED' THEN UTC_TIMESTAMP() ELSE VerifiedAt END) WHERE PaymentId = ?`,
    [...values, entries.find(([key]) => key === "VerificationStatus")?.[1] || "PENDING", paymentId]
  );
}

export async function createNotificationLog(
  connection,
  { bookingId, recipientEmail, recipientName, notificationType, notificationStatus = "PENDING", sentAt = null, errorMessage = null }
) {
  const [result] = await connection.execute(
    `INSERT INTO booking_notifications
      (BookingId, RecipientEmail, RecipientName, NotificationType, NotificationStatus, SentAt, ErrorMessage, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [bookingId, recipientEmail, recipientName, notificationType, notificationStatus, sentAt, errorMessage]
  );

  return { notificationId: result.insertId };
}

export async function updateNotificationStatus(connection, notificationId, updates) {
  const entries = Object.entries(updates || {});

  if (!entries.length) {
    return;
  }

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await connection.execute(
    `UPDATE booking_notifications SET ${assignments} WHERE NotificationId = ?`,
    [...values, notificationId]
  );
}

export async function getNotificationLogsForBooking(connection, bookingId) {
  const [rows] = await connection.execute(
    "SELECT * FROM booking_notifications WHERE BookingId = ? ORDER BY CreatedAt DESC",
    [bookingId]
  );

  return rows;
}

export async function getPrimaryPaymentForBooking(connection, bookingId) {
  const [rows] = await connection.execute(
    "SELECT * FROM payments WHERE BookingId = ? ORDER BY CreatedAt DESC LIMIT 1",
    [bookingId]
  );

  return rows[0] || null;
}

export async function getConnection() {
  return pool.getConnection();
}
