import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { createCustomer, findByEmail, findByEmailForUpdate, updateCustomer } from "../repository/customerRepository.js";
import { deleteVerification, findVerification, upsertVerification } from "../repository/verificationRepository.js";
import { sendAccessCode } from "../service/emailService.js";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailOf = (email) => String(email || "").trim().toLowerCase();
const tokenFor = (c) => jwt.sign({ customerId: c.CustomerId, email: c.Email, name: c.FullName }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30m" });

/** POST /api/auth/request-code - creates and emails a short-lived verification code. */
export async function requestCode(req, res, next) {
  try {

    const fullName = String(req.body.fullName || "").trim()
    const email = emailOf(req.body.email)
    const phone = String(req.body.phone || "").trim();

    if (fullName.length < 2 || !validEmail.test(email) || phone.length < 6) 
        return res.status(400).json({ success: false, 
                                      message: "Provide a valid full name, email, and phone number." });

    const code = crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();

    await upsertVerification({ fullName, email, phone, 
                                codeHash: await bcrypt.hash(code, 12), 
                                expiresAt: new Date(Date.now() + 600000) });

    await sendAccessCode(email, code);

    return res.json({ success: true, 
                  message: "A verification code has been sent to your email." });
                  
  } catch (error) { return next(error); }
}

/** POST /api/auth/verify-code - verifies the code, creates/updates the customer, and returns a JWT. */
export async function verifyCode(req, res, next) {
  try {

    const email = emailOf(req.body.email)
    const code = String(req.body.code || "").trim();
    const verification = validEmail.test(email) && code ? await findVerification(email) : null;

    if (!verification || new Date(verification.expiresAt) <= new Date()) 
      return res.status(400).json({ success: false, 
                                    message: "This verification code has expired. Request a new one." });

    if (!(await bcrypt.compare(code, verification.SecretKey))) 
      return res.status(400).json({ success: false, 
                                    message: "Incorrect verification code." });

    const connection = await pool.getConnection();
    try {

      await connection.beginTransaction();
      let customer = await findByEmailForUpdate(connection, email);

      if (customer) { 
        await updateCustomer(connection, 
                            customer.CustomerId,
                              { fullName: verification.FullName, 
                                phone: verification.Phone, 
                                secretKeyHash: verification.SecretKey }
                            ); 
        customer = { ...customer, FullName: verification.FullName, Email: email }; 
      } else { 
        const customerId = await createCustomer(connection, 
                                  { fullName: verification.FullName,
                                  email, 
                                  phone: verification.Phone, 
                                  secretKeyHash: verification.SecretKey }
                                ); 
        customer = { CustomerId: customerId, FullName: verification.FullName, Email: email }; 
      }

      await deleteVerification(connection, verification.requestId); 
      await connection.commit();

      return res.json({ success: true, 
                        token: tokenFor(customer), 
                        customer: { customerId: customer.CustomerId, 
                                    fullName: customer.FullName, 
                                    email: customer.Email } 
                      });
    } catch (error) { 
      await connection.rollback(); 
      throw error; 
    } finally { 
      connection.release(); 
    }
  } catch (error) { 
    return next(error); 
  }
}

/** POST /api/auth/sign-in - authenticates a returning guest with their saved secret key. */
export async function signInWithSecret(req, res, next) {
  try { 
      const customer = await findByEmail(emailOf(req.body.email)), 
      secretKey = String(req.body.secretKey || "").trim(); 

      if (!customer || !secretKey || !(await bcrypt.compare(secretKey, customer.SecretKey))) 
        return res.status(401).json({ success: false, 
                                      message: "Email or secret key is incorrect." }); 
      else return res.json({ success: true, 
                            token: tokenFor(customer), 
                            customer: { customerId: customer.CustomerId, 
                                        fullName: customer.FullName, 
                                        email: customer.Email } 
                            }); 
    } catch (error) { 
      return next(error); 
    }
}
