import pool from "../config/db.js";

export async function upsertVerification({
    fullName,
    email,
    phone,
    codeHash,
    expiresAt
}) {
    await pool.execute(
        `INSERT INTO TempCust
        (FullName, Email, Phone, SecretKey, expiresAt)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            FullName = VALUES(FullName),
            Phone = VALUES(Phone),
            SecretKey = VALUES(SecretKey),
            expiresAt = VALUES(expiresAt)`,
        [
            fullName,
            email,
            phone,
            codeHash,
            expiresAt
        ]
    );
}

export async function findVerification(email) {
    const [rows] = await pool.execute(
        "SELECT * FROM TempCust WHERE Email = ? LIMIT 1",
        [email]
    );

    return rows[0] || null;
}

export async function deleteVerification(connection, requestId) {
    await connection.execute(
        "DELETE FROM TempCust WHERE requestId = ?",
        [requestId]
    );
}