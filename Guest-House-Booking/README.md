# RGUKT Guest House Booking Frontend

## Local run

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend URL plus `/api`.
3. Run `npm install` and `npm run dev`.

For the local backend, use `VITE_API_BASE_URL=http://localhost:5000/api`.

## Deployment

Set `VITE_API_BASE_URL` in the hosting provider's environment settings to the deployed backend URL, for example `https://booking-api.example.com/api`. Build with `npm run build` and publish the generated `dist` folder.
