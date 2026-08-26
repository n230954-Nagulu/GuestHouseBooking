# RGUKT Nuzvid Guest Room Booking API

Node.js and MySQL backend for the college guest-room booking page. The API verifies a guest by email, issues a JWT, provides live room availability, creates temporary holds, and confirms bookings.

## Project structure

| Folder | Responsibility |
| --- | --- |
| `config/` | Database and email-provider configuration. |
| `controller/` | HTTP request validation and API responses. |
| `router/` | Maps public URLs to controller functions. |
| `repository/` | All MySQL queries and transactions. |
| `middleware/` | JWT verification, errors, and request protection. |
| `service/` | Email message construction and delivery. |
| `database/` | SQL required by this API. |

## Setup

1. Create the original `hotel_db` tables shared earlier.
2. Run [`database/schema-adjustments.sql`](database/schema-adjustments.sql) once.
3. Keep the existing database and JWT settings in `.env`.
4. Add the following email, pricing, and deployment settings to `.env` (use `.env.example` as the template).
5. Run `npm start` for production or `npm run dev` during development.

```env
# Existing values: PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET

<com>

HOLD_MINUTES=10
JWT_EXPIRES_IN=30m
ROOM_PRICE_PER_DAY=300
CORS_ORIGINS=https://rguktn.ac.in,https://your-college-booking-page.example
```

Use a Gmail **App Password**, not the normal Gmail password. `CORS_ORIGINS` must contain the exact frontend origins, including `http://localhost:5173` or `http://localhost:8443` for local development.

## Guest booking flow

1. Frontend submits name, email, and phone to request an email code.
2. Guest submits the emailed code and receives a JWT.
3. Frontend stores the JWT and sends it as `Authorization: Bearer <token>` for every room/booking request.
4. Guest checks available rooms for a stay period.
5. Guest selects rooms. The server checks again inside a database transaction and creates a 10-minute hold after the email code is verified.
6. The website shows the held booking details. When the guest submits that final review page, the server converts the hold to a confirmed booking and emails confirmation with the calculated total.

The code is stored as a bcrypt hash. It cannot be read from the database or returned by the API. Requesting a new code safely replaces the old secret after verification.

## API reference

All responses are JSON. Every endpoint after authentication requires the bearer token.

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | API/database health check. |
| `POST` | `/api/auth/request-code` | No | Email a new verification code. |
| `POST` | `/api/auth/verify-code` | No | Verify code and receive JWT. |
| `POST` | `/api/auth/sign-in` | No | Sign in using email and current secret key. |
| `GET` | `/api/rooms/available` | No | Show free rooms for two dates and the ₹300 room-night rate. |
| `GET` | `/api/rooms` | No | List every physical room. |
| `POST` | `/api/bookings/holds` | Yes | Recheck rooms and create a timed hold with its price total. |
| `POST` | `/api/bookings/holds/:requestId/confirm` | Yes | Confirm the caller's active hold. |

### Request examples

```http
POST /api/auth/request-code
Content-Type: application/json

{ "fullName": "Guest Name", "email": "guest@example.com", "phone": "9876543210" }
```

```http
POST /api/auth/verify-code
Content-Type: application/json

{ "email": "guest@example.com", "code": "AB12CD34" }
```

```http
GET /api/rooms/available?inDate=2026-09-10&outDate=2026-09-12
Authorization: Bearer <token>
```

```http
POST /api/bookings/holds
Authorization: Bearer <token>
Content-Type: application/json

{ "customerId": 1, "inDate": "2026-09-10", "outDate": "2026-09-12", "roomIds": [1, 4] }
```

```http
POST /api/bookings/holds/25/confirm
Authorization: Bearer <token>
```

## Important maintenance notes

- Room availability treats both unexpired holds and confirmed bookings as unavailable.
- A guest can only confirm their own hold; the customer ID comes from the JWT, never the request body.
- The database transaction and row lock prevent two guests from successfully holding the same room at the same time.
- This version deliberately contains no price or payment functionality. Add payment only after creating a payment table and Razorpay webhook verification.
- Change `HOLD_MINUTES` in `.env` to adjust how long a room stays reserved before confirmation.
