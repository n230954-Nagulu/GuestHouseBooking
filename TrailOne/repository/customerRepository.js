import pool from "../config/db.js";

export async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM customers WHERE "Email" = $1 LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

export async function findByEmailForUpdate(connection, email) {
  const { rows } = await connection.query(
    `SELECT * FROM customers WHERE "Email" = $1 LIMIT 1 FOR UPDATE`,
    [email]
  );

  return rows[0] || null;
}

export async function createCustomer(
  connection,
  { fullName, email, phone, secretKeyHash }
) {
  const { rows } = await connection.query(
    `INSERT INTO customers ("FullName", "Email", "Phone", "SecretKey")
     VALUES ($1, $2, $3, $4)
     RETURNING "CustomerId"`,
    [fullName, email, phone, secretKeyHash]
  );

  return Number(rows[0].CustomerId);
}

export async function updateCustomer(
  connection,
  customerId,
  { fullName, phone, secretKeyHash }
) {
  await connection.query(
    `UPDATE customers
     SET "FullName" = $1, "Phone" = $2, "SecretKey" = $3
     WHERE "CustomerId" = $4`,
    [fullName, phone, secretKeyHash, customerId]
  );
}
