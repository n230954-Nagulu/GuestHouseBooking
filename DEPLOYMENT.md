# Deployment guide

This repository contains two independently deployed applications:

```text
GuestRoom_Booking/
├── Guest-House-Booking/   React + Vite frontend (Render Static Site)
├── TrailOne/              Express API (Render Web Service)
└── render.yaml            Render Blueprint for both services
```

The API uses PostgreSQL. The Render Blueprint provisions a PostgreSQL
database alongside the API and frontend.

## Local setup

Prerequisites: Node.js 22 (or a compatible current LTS release), npm, and a
PostgreSQL server/client.

1. Create the `hotel_booking` PostgreSQL database. Create `TrailOne/.env` from
   `TrailOne/.env.example`, set `DATABASE_URL` and `JWT_SECRET`, and provide
   email/Razorpay test settings as required.
2. From the repository root, initialize the database:

   ```sh
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f TrailOne/database/full_schema.sql
   ```
3. Install and start the API:

   ```sh
   cd TrailOne
   npm ci
   npm run dev
   ```

   The API listens on `http://localhost:5000`; its health route is
   `http://localhost:5000/health`.
4. In another terminal, install and start the frontend:

   ```sh
   cd Guest-House-Booking
   npm ci
   npm run dev
   ```

   Vite serves the frontend on port 8443. Its `/api` requests are proxied to
   the local API at port 5000. `VITE_API_BASE_URL` is only needed for a
   production frontend build.

## Backend environment

Set these in `TrailOne/.env` locally and in the Render API service environment.
Never commit `.env` files or put backend secrets in `VITE_*` variables.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production | Set to `production` on Render. |
| `PORT` | No | Render supplies this automatically; local default is `5000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection URL. Render can inject this from its PostgreSQL service. |
| `PGSSL` | No | Set to `true` when the PostgreSQL provider requires TLS; Render Blueprint enables it. TLS certificate validation remains enabled. |
| `DB_CONNECTION_LIMIT` | No | Pool size; defaults to `10`. |
| `JWT_SECRET` | Yes | Long, random signing secret; do not reuse a sample value. |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `30m`. |
| `HOLD_MINUTES` | No | Booking hold lifetime; defaults to `10`. |
| `ROOM_PRICE_PER_DAY` | No | Room price; defaults to `300`. |
| `CORS_ORIGINS` | Production | Comma-separated exact frontend origins, without paths or trailing slash. |
| `FRONTEND_URL` | No | Optional single frontend origin; local example is port 8443. |
| `EMAIL_USER` | Yes | Gmail sender account used by Nodemailer. |
| `EMAIL_APP_PASSWORD` | Yes | Gmail App Password, not the account password. |
| `SECURITY_EMAIL` | No | Security notification recipient; the service has an existing fallback. |
| `RAZORPAY_KEY_ID` | Yes | Razorpay key ID, also returned to the frontend by the API. |
| `RAZORPAY_KEY_SECRET` | Yes | Backend-only Razorpay secret used to verify payment signatures. |

The API also accepts `http://localhost:5173` and `http://localhost:8443` as
CORS origins outside production. In production it allows only the configured
`CORS_ORIGINS` and optional `FRONTEND_URL` values.

## PostgreSQL setup and schema

Provision a reachable PostgreSQL database named `hotel_booking`. Set
`DATABASE_URL` to its connection URL; never place that URL in frontend
environment variables. Local PostgreSQL can use:

```sh
DATABASE_URL=postgresql://user:password@localhost:5432/hotel_booking
```

For a **new, empty PostgreSQL database**, apply the schema once from the
repository root:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f TrailOne/database/full_schema.sql
```

The schema creates the tables and seed room records in the selected database;
it does not create or drop the database itself. Do not rerun it over populated
tables. `schema-adjustments.sql` is only for an older PostgreSQL schema and
should be applied after a backup after reviewing the target schema.

This changes the application database driver/schema, not existing MySQL data.
Existing data must be exported from MySQL and imported into PostgreSQL with
the target column types and quoted mixed-case names accounted for. Back up
the source and verify migrated row counts/relationships before switching
`DATABASE_URL`; do not run the PostgreSQL scripts against a MySQL server.

## Razorpay and email

Configure Razorpay test keys for initial verification. Set both
`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the API environment; keep the
secret exclusively on the backend. Payment signature verification remains in
the API. Switch to live keys only after successful end-to-end testing and the
required Razorpay account setup.

Set `EMAIL_USER` and `EMAIL_APP_PASSWORD` for the Gmail account used by the
application. Configure `SECURITY_EMAIL` to the current security in-charge
address. Razorpay booking notifications are sent only after the API verifies
Razorpay's signature and records successful payment. The separate demo booking
path also sends notifications after recording the booking, but marks them
`[DEMO]` and states that payment was not processed. Existing Razorpay orders
and demo confirmation are deliberately mutually exclusive for the same hold.

## Render frontend (Static Site)

`render.yaml` defines the static site. The equivalent dashboard settings are:

- **Root Directory:** `Guest-House-Booking`
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Environment:** `VITE_API_BASE_URL=https://<your-api-service>.onrender.com/api`

`VITE_API_BASE_URL` is baked into the frontend at build time. Set it in Render
before the static-site build. It must point to the API's `/api` base path, and
must not contain secrets. The Render rewrite route in `render.yaml` sends
unknown frontend paths to `index.html`, allowing refresh/direct navigation.

## Render backend (Web Service)

`render.yaml` defines the API service. The equivalent dashboard settings are:

- **Root Directory:** `TrailOne`
- **Build Command:** `npm ci --omit=dev`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`
- **Database:** `guest-house-booking-db` PostgreSQL, connected to the API as `DATABASE_URL`

Set all required backend variables above in the Render service. `CORS_ORIGINS`
must contain the exact deployed static-site origin, for example
`https://<your-frontend-service>.onrender.com`. You may add additional trusted
origins as a comma-separated list. Do not use `*` for production.

The Blueprint currently selects Render's free PostgreSQL plan for testing.
Free databases have limited lifetime/availability and are not suitable for
durable production bookings; select an appropriate paid database plan before
relying on this service for production data.

## Post-deployment checks

1. Open `https://<your-api-service>.onrender.com/health`. A healthy response
   includes `{"success":true,...}`; the route also checks the PostgreSQL connection.
2. Load the frontend and confirm the browser can retrieve available rooms
   from the API without CORS errors.
3. Test login/code verification and a booking hold.
4. Use Razorpay test mode to create an order, complete payment, and confirm
   that the API accepts the valid signature and returns the confirmed booking.
5. Alternatively, enter faculty in-charge details and choose **Confirm Booking
   (Demo)**. Confirm that the booking reference is shown and payment remains
   pending/demo; the demo path must work without Razorpay keys.
6. Confirm booking notifications are sent to the occupant, faculty in-charge,
   security in-charge, and booking initiator only after successful demo booking
   creation or verified real payment, and that demo messages carry a `[DEMO]`
   label.
   Cancelled or failed payments must not send booking notifications.
6. Confirm a direct URL/refresh on a frontend route returns the app rather than
   a static-site 404.
7. Confirm invalid payment signatures are rejected and do not confirm bookings.

The health route performs `SELECT 1`; it intentionally does not return
credentials or other secret configuration.

## Before pushing

From the repository root, run:

```sh
cd Guest-House-Booking
npm ci
npm run build
cd ../TrailOne
npm ci
node --check server.js
node --check controller/bookingController.js
node --check controller/paymentController.js
```

Then verify `git status` does not list `.env`, `node_modules`, or build output.
Render deployment is not performed by these local checks.
