import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const requiredVariables = ["DB_HOST", "DB_USER", "DB_NAME"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (process.env.DB_PASSWORD === undefined) missingVariables.push("DB_PASSWORD");
if (missingVariables.length) {
  throw new Error(`Missing required database environment variables: ${missingVariables.join(", ")}`);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true"
    ? {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA || undefined,
      }
    : undefined,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: "Z"
});


export default pool;
