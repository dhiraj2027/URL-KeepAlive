# MERN URL KeepAlive

A small MERN dashboard for managing HTTP/HTTPS URLs that should be checked periodically.

## Architecture

React frontend
→ Express API
→ MongoDB Atlas

GitHub Actions
→ Express scheduler endpoint
→ MongoDB
→ each enabled URL

The dashboard does not need to stay open.

## Important separation

`GET /health` is the health endpoint for this application itself.

It is intentionally independent of the URLs being monitored.

The scheduler uses:

- `GET /api/urls/internal/targets`
- `POST /api/urls/internal/ping-result`

Those internal endpoints require `KEEPALIVE_SECRET`.

## Local setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend:
http://localhost:5173

Backend:
http://localhost:5000

Health:
http://localhost:5000/health

## GitHub Actions secrets

Add these repository secrets:

`BACKEND_URL`
- Example: `https://your-backend.onrender.com`

`KEEPALIVE_SECRET`
- Must match the backend environment variable.

## Render

Backend:
- Root directory: `backend`
- Build: `npm install`
- Start: `npm start`
- Health check: `/health`

Frontend:
- Root directory: `frontend`
- Build: `npm install && npm run build`
- Publish directory: `dist`

## Note

This project is suitable for a personal/hobby setup. A public multi-user service that makes outbound requests from user-supplied URLs needs additional SSRF protection, rate limiting, quotas, and URL/IP validation before production use.


## Current application limits

- Maximum 50 monitored URLs per user.
- The GitHub Actions schedule is approximate; scheduled workflows can be delayed.
- The scheduler is intended for a personal/hobby setup, not guaranteed production uptime.
