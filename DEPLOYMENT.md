# Deployment guide

This repository contains two independently deployed applications:

```text
GuestRoom_Booking/
├── Guest-House-Booking/   React + Vite frontend (Render Static Site)
├── TrailOne/              Express API (Render Web Service)
└── render.yaml            Render Blueprint for both services
```

The API requires an externally hosted MySQL database. Render does not provide
a managed MySQL service in this setup.

## Local setup

Prerequisites: Node.js 22 (or a compatible current LTS release), npm, and a
MySQL database.

1. Create `TrailOne/.env` from `TrailOne/.env.example` and provide local
   database, JWT, email, and Razorpay test settings.
2. Install and start the API:

   ```sh
   cd TrailOne
   npm ci
   npm run dev
   ```

   The API listens on `http://localhost:5000`; its health route is
   `http://localhost:5000/health`.
3. In another terminal, install and start the frontend:

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
| `DB_HOST` | Yes | External MySQL hostname. |
| `DB_PORT` | No | MySQL port; defaults to `3306`. |
| `DB_USER` | Yes | MySQL username. |
| `DB_PASSWORD` | Yes | MySQL password. |
| `DB_NAME` | Yes | MySQL database/schema name. |
| `DB_SSL` | No | Set to `true` when the database provider requires TLS. |
| `DB_SSL_CA` | No | Optional PEM CA certificate when required by the provider. |
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

## MySQL setup and schema

Provision a reachable MySQL database with a user authorized to create a
database and modify its tables. The supplied fresh-install schema creates and
uses a database named `hotel_booking`; set `DB_NAME=hotel_booking`. Configure
`DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` from the provider. Enable
`DB_SSL=true` when required; supply its CA certificate in `DB_SSL_CA` if the
provider's TLS certificate is not trusted by the host.

For a **new, empty database server**, import the fresh-install schema once:

```sh
mysql --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" \
  --password < TrailOne/database/full_schema.sql
```

`full_schema.sql` creates the `hotel_booking` database and its tables. It does
not drop an existing database. Do not rerun it over a database with existing
tables; take a backup and use a deliberate migration for existing data.

`schema-adjustments.sql` is for an older database created from the original
schema. Apply it only once, after verifying which columns/tables are missing;
it contains non-idempotent `ALTER TABLE` statements and should not be run after
the current full schema:

```sh
mysql --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" \
  --password --database=hotel_booking < TrailOne/database/schema-adjustments.sql
```

Use the database provider's secure SQL console or import facility if it does
not permit direct MySQL CLI connections. The CLI prompts for the password;
do not put it in a command argument or commit database credentials.

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

Set all required backend variables above in the Render service. `CORS_ORIGINS`
must contain the exact deployed static-site origin, for example
`https://<your-frontend-service>.onrender.com`. You may add additional trusted
origins as a comma-separated list. Do not use `*` for production.

## Post-deployment checks

1. Open `https://<your-api-service>.onrender.com/health`. A healthy response
   includes `{"success":true,...}`; the route also checks the MySQL connection.
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
