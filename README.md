# URL KeepAlive

A full-stack URL monitoring application built with the MERN stack. Users can register, add web service URLs, enable or disable monitoring, and view the latest health status from a simple dashboard.

The backend runs an automatic monitoring scheduler, retries temporary failures such as HTTP 503 responses, handles Render cold starts, limits concurrent checks, validates monitored URLs against common SSRF targets, and stores the latest monitoring result in MongoDB.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Render Cold-Start Handling](#render-cold-start-handling)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Documentation](#api-documentation)
- [Monitoring and Retry Logic](#monitoring-and-retry-logic)
- [Security](#security)
- [Database Design](#database-design)
- [Deployment](#deployment)
- [Render Free-Tier Setup](#render-free-tier-setup)
- [Troubleshooting](#troubleshooting)
- [Design Decisions](#design-decisions)
- [Limitations](#limitations)
- [Future Improvements](#future-improvements)
- [Screenshots](#screenshots)
- [License](#license)
- [Author](#author)

---

## Overview

URL KeepAlive is designed to solve a practical problem faced when deploying small web services on platforms such as Render Free.

Services that are inactive for a period of time can sleep. When a request arrives after sleeping, the service needs time to start again and may temporarily return a `503 Service Unavailable` response.

A basic monitor might do this:

```text
Request
   |
   v
503
   |
   v
Mark service as FAILED
```

URL KeepAlive instead treats temporary server errors as retryable:

```text
Request
   |
   v
503
   |
   v
Wait
   |
   v
Retry
   |
   v
503
   |
   v
Wait
   |
   v
Retry
   |
   v
200
   |
   v
HEALTHY
```

This reduces false failure reports caused by temporary cold starts.

---

## Features

### Authentication

- User registration
- User login
- JWT-based authentication
- Password hashing with bcrypt
- Protected URL management APIs
- Persistent frontend session using browser storage
- Automatic logout when an API request returns `401`

### URL Management

- Add URLs for monitoring
- Optional custom URL names
- View all URLs belonging to the logged-in user
- Enable or disable monitoring
- Delete monitored URLs
- Maximum of 50 URLs per user
- Duplicate URL protection
- MongoDB ownership checks on update/delete operations

### Monitoring

- Immediate monitoring cycle when the backend starts
- Automatic monitoring at a configurable interval
- Retry temporary HTTP failures
- Configurable total retry window
- Configurable single-request timeout
- HTTP redirect handling
- Response status tracking
- Last ping timestamp
- Last error tracking
- Maximum concurrent ping limit
- Protection against duplicate pings for the same URL within the same Node.js process

### Render Cold-Start Support

Temporary responses such as:

- `500`
- `502`
- `503`
- `504`
- `429`

can be retried.

A `503` is not automatically treated as a permanent outage.

The application gives the target service time to recover before finally recording the URL as failed.

### Security

- JWT verification
- Password hashing
- HTTP/HTTPS URL validation
- Private/local network protection
- Basic SSRF protection
- DNS resolution before outbound requests
- Redirect target validation
- Rejects URLs containing embedded credentials
- User ownership checks
- MongoDB unique indexes
- JSON request-size limits
- Express fingerprinting disabled

### Dashboard

- Total URL count
- Healthy URL count
- Failed URL count
- Pending URL state
- Last ping time
- HTTP status code
- Error message
- Enable/disable controls
- Delete confirmation
- Loading states
- Error states
- Responsive UI

---

# How It Works

## 1. User Authentication

The user registers or logs in.

The backend:

1. Validates credentials.
2. Hashes the password during registration.
3. Verifies the password during login.
4. Generates a JWT.
5. Returns the authenticated user and token.

The frontend stores the token and sends it with protected API requests:

```http
Authorization: Bearer <JWT>
```

---

## 2. Adding a URL

When a user adds a URL:

```text
Frontend
   |
   | POST /api/urls
   v
Express Controller
   |
   +--> Validate URL
   |
   +--> Check URL quota
   |
   +--> Check duplicate
   |
   +--> Create MongoDB document
   |
   v
MongoDB
```

A URL document contains monitoring information such as:

```text
url
name
enabled
lastStatus
lastStatusCode
lastPingAt
lastError
```

---

## 3. Scheduler

After MongoDB connects and the Express server starts, the scheduler starts.

It immediately runs one monitoring cycle.

After that, it waits for the configured interval and starts the next cycle.

For example:

```text
Server starts
     |
     v
Immediate cycle
     |
     v
Wait 12 minutes
     |
     v
Cycle
     |
     v
Wait 12 minutes
     |
     v
Cycle
     |
     v
...
```

The scheduler uses an interval-based loop instead of relying on wall-clock cron ticks.

This avoids a situation such as:

```text
10:11 - Server starts
10:11 - Immediate cycle
10:12 - Cron tick
```

which could cause two monitoring cycles to run very close together.

---

## 4. URL Ping

For every enabled URL:

```text
URL
 |
 v
Validate URL
 |
 v
Resolve hostname
 |
 v
Check for private/local IP
 |
 v
HTTP request
 |
 +---- 2xx ----> HEALTHY
 |
 +---- 3xx ----> Validate redirect and follow
 |
 +---- 429 ----> Retry
 |
 +---- 500 ----> Retry
 |
 +---- 502 ----> Retry
 |
 +---- 503 ----> Retry
 |
 +---- 504 ----> Retry
 |
 +---- Other --> FAILED
```

---

# Architecture

```text
                         ┌───────────────────────┐
                         │      React Frontend   │
                         │                       │
                         │ Login / Dashboard     │
                         │ URL Management        │
                         └───────────┬───────────┘
                                     │
                                     │ REST API
                                     v
                         ┌───────────────────────┐
                         │    Express Backend    │
                         │                       │
                         │ Auth Controllers      │
                         │ URL Controllers       │
                         │ Middleware            │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    v                v                v
             ┌────────────┐   ┌─────────────┐  ┌──────────────┐
             │  MongoDB   │   │  Scheduler  │  │ Ping Service │
             │            │   │             │  │              │
             │ Users      │   │ Cycles      │  │ HTTP checks  │
             │ URLs       │   │ Concurrency │  │ Retry logic  │
             │ Status     │   │ Control     │  │ SSRF checks  │
             └────────────┘   └──────┬──────┘  └───────┬──────┘
                                     │                  │
                                     └────────┬─────────┘
                                              v
                                      Monitored URLs
```

---

# Render Cold-Start Handling

A key part of this project is handling sleeping Render services.

When a monitored service is asleep, the first request can temporarily return:

```http
503 Service Unavailable
```

The monitoring service does not immediately mark the target as permanently failed.

Instead:

```text
Attempt 1
   |
   +--> 503
         |
         +--> wait 5 seconds

Attempt 2
   |
   +--> 503
         |
         +--> wait 10 seconds

Attempt 3
   |
   +--> 503
         |
         +--> wait 10 seconds

Attempt 4
   |
   +--> 503
         |
         +--> wait 10 seconds

Attempt N
   |
   +--> 200
         |
         +--> HEALTHY
```

The total retry window is controlled by:

```env
PING_TIMEOUT_MS=70000
```

This is different from the timeout of a single HTTP request.

For example:

```env
PING_TIMEOUT_MS=70000
SINGLE_REQUEST_TIMEOUT_MS=15000
```

means:

- The entire monitoring attempt can take up to approximately 70 seconds.
- One individual HTTP request can take up to 15 seconds.
- If a request hangs, it is aborted and the remaining retry window can be used.

This distinction is important because an HTTP `503` is a response, not a request timeout.

---

# Tech Stack

## Frontend

- React
- Vite
- JavaScript
- Tailwind CSS
- Fetch API

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs
- node-cron / scheduler logic
- Native `fetch`
- Node.js DNS APIs

## Deployment

- Render
- MongoDB Atlas
- External uptime monitoring service

---

# Project Structure

```text
url-keepalive/
│
├── backend/
│   │
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   └── urlController.js
│   │
│   ├── middleware/
│   │   └── authMiddleware.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   └── Url.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── urlRoutes.js
│   │
│   ├── scheduler/
│   │   └── keepAlive.js
│   │
│   ├── services/
│   │   └── urlPingService.js
│   │
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddUrl.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   └── UrlCard.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── package.json
│   └── .env
│
├── .gitignore
└── README.md
```

---

# Getting Started

## Prerequisites

Install:

- Node.js 18 or newer
- npm
- Git
- MongoDB Atlas account or local MongoDB

Check Node:

```bash
node --version
```

Check npm:

```bash
npm --version
```

---

# Installation

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/url-keepalive.git

cd url-keepalive
```

---

# 2. Backend Setup

```bash
cd backend
npm install
```

Create:

```text
backend/.env
```

Example:

```env
PORT=5000

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/url_keepalive

JWT_SECRET=replace_with_a_long_random_secret

FRONTEND_URL=http://localhost:5173

PING_INTERVAL_MINUTES=12
PING_TIMEOUT_MS=70000
SINGLE_REQUEST_TIMEOUT_MS=15000
MAX_CONCURRENT_PINGS=5
```

Start the backend:

```bash
npm run dev
```

or:

```bash
npm start
```

Backend:

```text
http://localhost:5000
```

Health endpoint:

```text
http://localhost:5000/health
```

Expected response:

```json
{
  "success": true,
  "status": "healthy",
  "service": "url-keepalive-backend",
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

---

# 3. Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
```

Create:

```text
frontend/.env
```

Add:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

The frontend will normally run at:

```text
http://localhost:5173
```

---

# Environment Variables

## Backend

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | No | Backend port | `5000` |
| `MONGODB_URI` | Yes | MongoDB connection string | MongoDB Atlas URI |
| `JWT_SECRET` | Yes | Secret used to sign JWTs | Long random secret |
| `FRONTEND_URL` | Yes | Allowed frontend origin | `https://your-app.com` |
| `PING_INTERVAL_MINUTES` | No | Time between monitoring cycles | `12` |
| `PING_TIMEOUT_MS` | No | Total retry window | `70000` |
| `SINGLE_REQUEST_TIMEOUT_MS` | No | Timeout for one HTTP request | `15000` |
| `MAX_CONCURRENT_PINGS` | No | Maximum simultaneous URL checks | `5` |

## Frontend

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL | `https://api.example.com` |

### Security Warning

Never put these variables in the frontend:

```text
MONGODB_URI
JWT_SECRET
```

Anything beginning with `VITE_` is exposed to the browser.

---

# Running Locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

Register an account and add a URL such as:

```text
https://example.com
```

For testing the application's health endpoint:

```text
http://localhost:5000/health
```

---

# API Documentation

## Authentication

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "success": true,
  "token": "JWT_TOKEN",
  "user": {
    "id": "USER_ID",
    "email": "user@example.com"
  }
}
```

---

## Login

```http
POST /api/auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

---

# URL APIs

Protected URL endpoints require:

```http
Authorization: Bearer <JWT>
```

---

## Get URLs

```http
GET /api/urls
Authorization: Bearer <JWT>
```

Returns all URLs belonging to the authenticated user.

---

## Add URL

```http
POST /api/urls
Authorization: Bearer <JWT>
Content-Type: application/json
```

Request:

```json
{
  "url": "https://example.com/health",
  "name": "Production API"
}
```

---

## Update URL

```http
PATCH /api/urls/:id
Authorization: Bearer <JWT>
Content-Type: application/json
```

Enable:

```json
{
  "enabled": true
}
```

Disable:

```json
{
  "enabled": false
}
```

Rename:

```json
{
  "name": "Production Backend"
}
```

---

## Delete URL

```http
DELETE /api/urls/:id
Authorization: Bearer <JWT>
```

---

# Health Endpoint

```http
GET /health
```

This endpoint does not require authentication.

Example:

```json
{
  "success": true,
  "status": "healthy",
  "service": "url-keepalive-backend",
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

The endpoint is intentionally lightweight.

It should not:

- Ping monitored URLs
- Run the scheduler
- Perform expensive database queries
- Execute monitoring jobs

Its purpose is to quickly indicate that the Express application is responding.

---

# Internal Scheduler Endpoints

The project also contains internal scheduler-related routes:

```text
GET  /api/urls/internal/targets
POST /api/urls/internal/ping-result
```

These are protected by a dedicated internal secret when used.

The current built-in scheduler does not need an HTTP round-trip to these endpoints. It accesses MongoDB directly and updates monitoring results through the same backend process.

This avoids unnecessary:

```text
Backend
  ↓
HTTP request to itself
  ↓
Backend
  ↓
MongoDB
```

Instead:

```text
Scheduler
   ↓
Ping Service
   ↓
MongoDB
```

---

# Monitoring and Retry Logic

## Successful Response

Any HTTP `2xx` response is considered healthy.

Examples:

```text
200 OK
201 Created
204 No Content
```

---

## Retryable Responses

The following statuses are treated as temporary:

```text
429 Too Many Requests
500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
504 Gateway Timeout
```

These responses are retried within the configured total timeout.

---

## Non-Retryable Responses

Other HTTP errors are recorded as failures without repeatedly retrying them.

For example:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
```

This prevents wasting the entire retry window on an endpoint that is consistently returning a permanent application-level error.

---

# Monitoring Configuration

Default configuration:

```env
PING_INTERVAL_MINUTES=12
PING_TIMEOUT_MS=70000
SINGLE_REQUEST_TIMEOUT_MS=15000
MAX_CONCURRENT_PINGS=5
```

### Monitoring interval

```text
12 minutes
```

After one cycle finishes, the scheduler waits for the configured interval before starting the next cycle.

### Total retry window

```text
70 seconds
```

### Single request timeout

```text
15 seconds
```

### Maximum concurrent pings

```text
5 URLs
```

---

# Monitoring Logs

The backend logs detailed timing information.

Example:

```text
[Server] [2026-08-13T15:30:02.100Z] Starting server...
[Server] [2026-08-13T15:30:02.110Z] Connecting to MongoDB...
[Server] [2026-08-13T15:30:03.420Z] MongoDB connection ready after 1320ms
[Server] [2026-08-13T15:30:03.430Z] Server running on port 5000

[KeepAlive] [2026-08-13T15:30:03.440Z] Scheduler started
[KeepAlive] [2026-08-13T15:30:03.450Z] ===== CYCLE START =====

[KeepAlive] [2026-08-13T15:30:03.510Z] Starting ping:
https://example.onrender.com/health

[KeepAlive] [2026-08-13T15:30:03.520Z]
[Attempt 1] Pinging https://example.onrender.com/health
| elapsed=0ms
| remaining=70000ms

[KeepAlive] [2026-08-13T15:30:04.100Z]
[Attempt 1] ✗ ... → 503
| requestTime=580ms
| totalElapsed=580ms

[KeepAlive] [2026-08-13T15:30:04.100Z]
[Attempt 1] Retry scheduled in 5000ms

[KeepAlive] [2026-08-13T15:30:09.700Z]
[Attempt 2] ✗ ... → 503

[KeepAlive] [2026-08-13T15:30:54.300Z]
[Attempt 5] ✓ ... → 200
| requestTime=1100ms
| totalElapsed=50800ms
```

These logs make it possible to determine whether a service:

- Responded successfully
- Returned an HTTP error
- Was temporarily unavailable
- Timed out
- Needed multiple retries
- Took a long time to respond

---

# Security

## JWT Authentication

Protected routes require a valid JWT.

The authentication middleware:

1. Reads the `Authorization` header.
2. Extracts the bearer token.
3. Verifies it using `JWT_SECRET`.
4. Adds the authenticated user ID to the request.
5. Allows the request to continue.

---

## Password Hashing

Passwords are never stored as plaintext.

During registration:

```text
Plain password
      |
      v
bcrypt
      |
      v
Password hash
      |
      v
MongoDB
```

During login:

```text
Password entered
      |
      v
bcrypt.compare()
      |
      v
Valid / Invalid
```

---

# SSRF Protection

The monitoring feature accepts user-controlled URLs.

Without protection, an attacker could attempt to make the server access internal resources.

For example:

```text
http://localhost:3000
http://127.0.0.1:5000
http://192.168.1.1
http://10.0.0.1
```

The ping service therefore performs validation before making outbound requests.

It checks:

- Protocol
- Hostname
- DNS resolution
- Resolved IP addresses
- Private IPv4 ranges
- Common private IPv6 ranges
- Localhost
- Link-local addresses
- Embedded URL credentials

Redirects are also handled manually so redirect destinations can be validated instead of blindly following them.

---

# User Data Isolation

Every user-owned URL query includes the authenticated user's ID.

For example:

```text
GET /api/urls
```

queries only:

```text
user = authenticatedUserId
```

Similarly, update and delete operations verify both:

```text
URL ID
+
User ID
```

This prevents a user from modifying another user's monitored URL simply by knowing its MongoDB ID.

---

# Concurrency Control

Suppose the user has 50 monitored URLs.

The scheduler does not necessarily start 50 requests at once.

With:

```env
MAX_CONCURRENT_PINGS=5
```

the workload is limited:

```text
Worker 1 → URL
Worker 2 → URL
Worker 3 → URL
Worker 4 → URL
Worker 5 → URL
```

When one finishes, that worker processes another URL.

This helps control outbound traffic and prevents a large URL list from creating an unnecessary request burst.

---

# Duplicate Ping Protection

The ping service keeps track of currently active URL IDs within the Node.js process.

If the same URL is already being checked:

```text
Ping A
   |
   +--> URL 123

Ping B
   |
   +--> URL 123
```

the second request is skipped.

This protects against accidental duplicate monitoring within the same process.

Note that this is an in-memory safeguard and is not a distributed lock.

---

# Database Design

## User Schema

```text
User
├── _id
├── email
├── password
├── createdAt
└── updatedAt
```

The email field is unique.

---

## URL Schema

```text
Url
├── _id
├── user
├── url
├── name
├── enabled
├── lastStatus
├── lastStatusCode
├── lastPingAt
├── lastError
├── createdAt
└── updatedAt
```

`lastStatus` supports:

```text
unknown
healthy
failed
```

---

# Database Index

A compound unique index is used:

```text
(user, url)
```

This prevents the same user from adding the same URL multiple times.

It also protects against race conditions where two requests attempt to create the same URL simultaneously.

---

# Deployment

## Backend on Render

Create a Render Web Service.

Typical configuration:

```text
Root Directory:
backend

Build Command:
npm install

Start Command:
npm start
```

Add the required environment variables in Render.

Set the Render health-check path to:

```text
/health
```

---

## Frontend Deployment

Build the frontend:

```bash
npm run build
```

Configure:

```env
VITE_API_URL=https://your-backend.onrender.com
```

Then deploy the generated frontend using your preferred static hosting provider.

---

# Render Free-Tier Setup

If the backend is deployed on Render Free, the service can sleep after a period without inbound traffic.

An external uptime monitor can periodically request:

```text
https://your-backend.onrender.com/health
```

A practical interval is around:

```text
10 minutes
```

The architecture separates this keep-alive request from URL monitoring:

```text
                External Monitor
                       |
                       | every ~10 min
                       v
                    /health
                       |
                       v
                Render Backend
                       |
              ┌────────┴────────┐
              |                 |
              v                 v
          Express          Scheduler
                                |
                                v
                         Ping monitored URLs
```

The `/health` endpoint is intentionally lightweight.

---

# Important Render Behavior

Increasing the ping timeout in the Node.js application does not control how long Render's platform waits before returning a response while waking a sleeping service.

For example:

```env
PING_TIMEOUT_MS=70000
```

controls the monitoring service's total retry window.

It does not mean:

```text
Render will wait 70 seconds before responding.
```

That is why the monitoring implementation retries temporary `503` responses instead of relying only on a single long HTTP timeout.

---

# Troubleshooting

## MongoDB Connection Failed

Check:

```text
MONGODB_URI
```

Verify:

- MongoDB Atlas cluster is running.
- Database user credentials are correct.
- MongoDB Atlas network access allows the deployment.
- The connection string is valid.

---

## Frontend Cannot Connect to Backend

Check:

```env
VITE_API_URL=https://your-backend.onrender.com
```

Also check:

```env
FRONTEND_URL=https://your-frontend-domain.com
```

Make sure the browser is not reporting a CORS error.

---

## Backend Returns 404

Test:

```text
GET /health
```

For example:

```text
https://your-backend.onrender.com/health
```

If `/health` works but an API endpoint does not, verify the route path.

---

## URL Immediately Shows 503

Check backend logs.

A temporary cold start should produce multiple attempts:

```text
Attempt 1 → 503
Attempt 2 → 503
Attempt 3 → 503
Attempt 4 → 503
Attempt N → 200
```

If all attempts fail after the configured retry window, the URL is recorded as failed.

---

## Scheduler Is Not Running

Look for:

```text
Scheduler started
```

Then:

```text
CYCLE START
```

and:

```text
CYCLE COMPLETE
```

The scheduler only runs while the Node.js process is running.

---

## A Newly Added URL Is Not Immediately Pinged

The scheduler performs its monitoring cycles independently of the HTTP request that creates a URL.

Therefore, a newly added URL may wait until the next scheduled cycle.

If immediate per-add monitoring is required, the create URL controller can enqueue a background ping after successful creation.

For the current architecture, the scheduler remains responsible for monitoring to keep responsibilities separated.

---

# Design Decisions

## Why MongoDB?

The application stores independent monitoring documents containing:

- URL configuration
- User ownership
- Current monitoring status
- Last response
- Last error
- Last ping time

MongoDB fits this document-oriented model well.

Mongoose provides:

- Schema validation
- MongoDB models
- Query helpers
- Index definitions
- Convenient document operations

---

## Why JWT?

JWT provides a straightforward stateless authentication mechanism for the REST API.

The backend does not need to maintain a server-side session for every logged-in browser.

---

## Why a Separate Ping Service?

Monitoring logic is separated from controllers and scheduling logic.

Instead of putting HTTP monitoring directly into the scheduler:

```text
Scheduler
   |
   +--> fetch()
   +--> retry
   +--> validation
   +--> database update
```

the project uses:

```text
Scheduler
    |
    v
Ping Service
    |
    +--> URL validation
    +--> SSRF protection
    +--> HTTP request
    +--> retry handling
    +--> result persistence
```

This keeps responsibilities separated and makes the monitoring implementation easier to maintain.

---

## Why Retry HTTP 503?

A `503` can be temporary.

This is especially relevant to services that are waking from a sleeping state.

Therefore:

```text
503 != automatically permanent outage
```

The application retries temporary statuses before recording a final failure.

---

## Why Limit Concurrency?

Without concurrency control, a large number of URLs could produce a large burst of outbound requests.

The configurable concurrency limit makes the monitoring workload more predictable.

---

## Why Use an Interval-Based Scheduler?

The scheduler performs:

```text
Immediate cycle
      |
      v
Wait configured interval
      |
      v
Next cycle
```

instead of relying on wall-clock cron expressions.

This avoids back-to-back cycles after a server starts at an unfortunate point in the clock schedule.

It also makes the behavior easier to reason about on an ephemeral deployment platform.

---

# Limitations

This project is intentionally designed as a lightweight monitoring application.

Current limitations include:

- Scheduler state is in memory.
- Monitoring runs from a single Node.js process.
- No distributed job queue.
- No distributed scheduler lock.
- No historical uptime charts.
- No incident management.
- No email/SMS notifications.
- No Slack/Discord notifications.
- No SSL certificate monitoring.
- No domain expiry monitoring.
- No multi-region monitoring.
- Client-side token storage is used instead of HttpOnly authentication cookies.
- In-memory duplicate-ping protection only applies to one Node.js process.

These limitations are acceptable for a small personal/portfolio deployment but would need to be addressed for a larger production monitoring platform.

---

# Future Improvements

Possible future enhancements:

### Monitoring

- Uptime percentage
- Response-time history
- Historical charts
- Incident detection
- Configurable retry policies
- Configurable monitoring intervals
- Custom HTTP methods
- Custom headers
- Request authentication

### Notifications

- Email alerts
- Discord alerts
- Slack alerts
- Telegram alerts
- Webhooks

### Infrastructure

- Redis-backed distributed locks
- BullMQ job queue
- Dedicated worker service
- Multiple monitoring workers
- Retry queues
- Dead-letter queue
- Prometheus metrics
- Grafana dashboards

### Security

- Refresh-token rotation
- HttpOnly cookies
- CSRF protection
- Stronger SSRF isolation
- Network sandboxing
- Authentication rate limiting
- Password reset
- Email verification
- API keys

### Product Features

- Teams
- Shared monitors
- Role-based access control
- Public status pages
- Maintenance windows
- Custom alert rules
- SLA reports

---

# Screenshots

Add screenshots of the application here.

Recommended:

```text
screenshots/
├── login.png
├── dashboard.png
├── healthy-url.png
└── failed-url.png
```

Then reference them:

```md
![Login](screenshots/login.png)

![Dashboard](screenshots/dashboard.png)
```

---

# API Summary

| Method | Endpoint | Auth | Purpose |
|---|---|---:|---|
| `POST` | `/api/auth/register` | No | Register user |
| `POST` | `/api/auth/login` | No | Login |
| `GET` | `/api/urls` | JWT | Get user's URLs |
| `POST` | `/api/urls` | JWT | Add URL |
| `PATCH` | `/api/urls/:id` | JWT | Update URL |
| `DELETE` | `/api/urls/:id` | JWT | Delete URL |
| `GET` | `/health` | No | Backend health check |
| `GET` | `/api/urls/internal/targets` | Internal secret | Internal targets |
| `POST` | `/api/urls/internal/ping-result` | Internal secret | Internal result update |

---

# Example Monitoring Result

A healthy URL may be stored as:

```json
{
  "lastStatus": "healthy",
  "lastStatusCode": 200,
  "lastPingAt": "2026-08-13T15:30:54.300Z",
  "lastError": null
}
```

A failed URL may contain:

```json
{
  "lastStatus": "failed",
  "lastStatusCode": 503,
  "lastPingAt": "2026-08-13T15:31:14.300Z",
  "lastError": "HTTP 503 Service Unavailable"
}
```

---

# Production Considerations

For a larger deployment, the monitoring worker should be separated from the API server.

A more scalable architecture would be:

```text
                    ┌───────────────┐
                    │ React Client  │
                    └───────┬───────┘
                            |
                            v
                    ┌───────────────┐
                    │ API Server(s) │
                    └───────┬───────┘
                            |
                    ┌───────┴────────┐
                    |                |
                    v                v
                MongoDB           Redis
                                     |
                                     v
                               Job Queue
                                     |
                     ┌───────────────┼───────────────┐
                     |               |               |
                     v               v               v
                  Worker 1        Worker 2        Worker 3
                     |               |               |
                     └───────────────┴───────────────┘
                                     |
                                     v
                              Monitored URLs
```

This would provide better:

- Scalability
- Fault isolation
- Retry management
- Distributed locking
- Monitoring throughput
- Worker recovery

The current project intentionally keeps the architecture simpler for a small deployment.

---

# License

This project is intended for educational, personal, and portfolio use.

If you want to open-source the repository, add an explicit license such as MIT.

---

# Author

## Dhiraj Kumar Sah

Full-stack developer and Computer Science student.

Built this project to explore:

- MERN stack development
- REST API design
- JWT authentication
- MongoDB data modeling
- Background job scheduling
- HTTP monitoring
- Retry strategies
- Render deployment behavior
- SSRF protection
- Concurrent task processing
- Production-oriented backend design

---

## GitHub Repository

Replace this with your actual repository URL:

```text
https://github.com/YOUR_USERNAME/url-keepalive
```

## Live Application

Replace this with your deployed frontend:

```text
https://YOUR_FRONTEND_URL
```

## Backend Health Check

Replace this with your deployed backend:

```text
https://YOUR_BACKEND_URL/health
```
