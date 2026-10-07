import pool from "../config/db.js";

export async function upsertVerification({
  fullName,
  email,
  phone,
  codeHash,
  expiresAt
}) {
  await pool.query(
    `INSERT INTO "TempCust"
      ("FullName", "Email", "Phone", "SecretKey", "expiresAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("Email") DO UPDATE
     SET "FullName" = EXCLUDED."FullName",
         "Phone" = EXCLUDED."Phone",
         "SecretKey" = EXCLUDED."SecretKey",
         "expiresAt" = EXCLUDED."expiresAt"`,
    [fullName, email, phone, codeHash, expiresAt]
  );
}

export async function findVerification(email) {
  const { rows } = await pool.query(
    `SELECT * FROM "TempCust" WHERE "Email" = $1 LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

export async function deleteVerification(connection, requestId) {
  await connection.query(
    `DELETE FROM "TempCust" WHERE "requestId" = $1`,
    [requestId]
  );
}
