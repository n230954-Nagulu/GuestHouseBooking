import pool from "../config/db.js";

export async function findByEmail(email) {
    const [rows] = await pool.execute(
        "SELECT * FROM customers WHERE Email = ? LIMIT 1",
        [email]
    );

    return rows[0] || null;
}

export async function findByEmailForUpdate(connection, email) {
    const [rows] = await connection.execute(
        "SELECT * FROM customers WHERE Email = ? LIMIT 1 FOR UPDATE",
        [email]
    );

    return rows[0] || null;
}

export async function createCustomer(
    connection,
    { fullName, email, phone, secretKeyHash }
) {
    const [result] = await connection.execute(
        `INSERT INTO customers
        (FullName, Email, Phone, SecretKey)
        VALUES (?, ?, ?, ?)`,
        [fullName, email, phone, secretKeyHash]
    );

    return result.insertId;
}

export async function updateCustomer(
    connection,
    customerId,
    { fullName, phone, secretKeyHash }
) {
    await connection.execute(
        `UPDATE customers
         SET FullName = ?, Phone = ?, SecretKey = ?
         WHERE CustomerId = ?`,
        [fullName, phone, secretKeyHash, customerId]
    );
}