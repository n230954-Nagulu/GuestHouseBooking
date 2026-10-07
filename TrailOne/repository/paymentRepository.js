import pool from "../config/db.js";

export async function findPaymentByRequestId(connection, requestId) {
  const { rows } = await connection.query(
    `SELECT * FROM payments
     WHERE "RequestId" = $1
     ORDER BY "CreatedAt" DESC
     LIMIT 1
     FOR UPDATE`,
    [requestId]
  );

  return rows[0] || null;
}

export async function findDemoPaymentByRequestId(connection, requestId) {
  const { rows } = await connection.query(
    `SELECT * FROM payments
     WHERE "RequestId" = $1 AND "PaymentMethod" = 'DEMO'
     ORDER BY "PaymentId" DESC
     LIMIT 1
     FOR UPDATE`,
    [requestId]
  );

  return rows[0] || null;
}

export async function findPaymentByOrderId(connection, razorpayOrderId) {
  const { rows } = await connection.query(
    `SELECT * FROM payments WHERE "RazorpayOrderId" = $1 LIMIT 1 FOR UPDATE`,
    [razorpayOrderId]
  );

  return rows[0] || null;
}

export async function findPaymentById(connection, paymentId) {
  const { rows } = await connection.query(
    `SELECT * FROM payments WHERE "PaymentId" = $1 LIMIT 1`,
    [paymentId]
  );

  return rows[0] || null;
}

export async function createPaymentRecord(
  connection,
  { requestId, bookingId = null, razorpayOrderId, amount, currency = "INR", paymentStatus = "CREATED", verificationStatus = "PENDING", paymentMethod = "RAZORPAY", failureReason = null }
) {
  const { rows } = await connection.query(
    `INSERT INTO payments
      ("RequestId", "BookingId", "RazorpayOrderId", "RazorpayPaymentId", "RazorpaySignature", "Amount", "Currency", "PaymentStatus", "PaymentMethod", "VerificationStatus", "FailureReason", "CreatedAt")
     VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
     RETURNING "PaymentId"`,
    [requestId, bookingId, razorpayOrderId, Number(amount), currency, paymentStatus, paymentMethod, verificationStatus, failureReason]
  );

  return { paymentId: Number(rows[0].PaymentId) };
}

export async function updatePaymentRecord(connection, paymentId, updates) {
  const allowedColumns = new Set([
    "BookingId",
    "RazorpayOrderId",
    "RazorpayPaymentId",
    "RazorpaySignature",
    "Amount",
    "Currency",
    "PaymentStatus",
    "PaymentMethod",
    "VerificationStatus",
    "FailureReason",
  ]);
  const entries = Object.entries(updates || {});

  if (!entries.length) {
    return;
  }
  if (entries.some(([key]) => !allowedColumns.has(key))) {
    throw new Error("Unsupported payment field update.");
  }

  const assignments = entries.map(([key], index) => `"${key}" = $${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);
  const verificationStatus = entries.find(([key]) => key === "VerificationStatus")?.[1] || "PENDING";
  const verificationIndex = values.length + 1;
  const paymentIdIndex = values.length + 2;

  await connection.query(
    `UPDATE payments
     SET ${assignments},
         "VerifiedAt" = COALESCE(
           "VerifiedAt",
           CASE WHEN $${verificationIndex} = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE "VerifiedAt" END
         )
     WHERE "PaymentId" = $${paymentIdIndex}`,
    [...values, verificationStatus, paymentId]
  );
}

export async function createNotificationLog(
  connection,
  { bookingId, recipientEmail, recipientName, notificationType, notificationStatus = "PENDING", sentAt = null, errorMessage = null }
) {
  const { rows } = await connection.query(
    `INSERT INTO booking_notifications
      ("BookingId", "RecipientEmail", "RecipientName", "NotificationType", "NotificationStatus", "SentAt", "ErrorMessage", "CreatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
     RETURNING "NotificationId"`,
    [bookingId, recipientEmail, recipientName, notificationType, notificationStatus, sentAt, errorMessage]
  );

  return { notificationId: Number(rows[0].NotificationId) };
}

export async function updateNotificationStatus(connection, notificationId, updates) {
  const allowedColumns = new Set(["RecipientEmail", "RecipientName", "NotificationType", "NotificationStatus", "SentAt", "ErrorMessage"]);
  const entries = Object.entries(updates || {});

  if (!entries.length) {
    return;
  }
  if (entries.some(([key]) => !allowedColumns.has(key))) {
    throw new Error("Unsupported notification field update.");
  }

  const assignments = entries.map(([key], index) => `"${key}" = $${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);

  await connection.query(
    `UPDATE booking_notifications SET ${assignments} WHERE "NotificationId" = $${values.length + 1}`,
    [...values, notificationId]
  );
}

export async function getNotificationLogsForBooking(connection, bookingId) {
  const { rows } = await connection.query(
    `SELECT * FROM booking_notifications
     WHERE "BookingId" = $1
     ORDER BY "CreatedAt" DESC`,
    [bookingId]
  );

  return rows;
}

export async function getPrimaryPaymentForBooking(connection, bookingId) {
  const { rows } = await connection.query(
    `SELECT * FROM payments
     WHERE "BookingId" = $1
     ORDER BY "CreatedAt" DESC
     LIMIT 1`,
    [bookingId]
  );

  return rows[0] || null;
}

export async function getConnection() {
  return pool.connect();
}
