# HTTP API Reference

Base URL:

- **Production:** `https://us-central1-trddk-54c45.cloudfunctions.net/api`
- **Emulator:** `http://127.0.0.1:5001/trddk-54c45/us-central1/api`

All paths below are relative to base (Express mounts routes under `/api/...`).

**Admin panel:** browser should use BFF routes (`/api/proxy/...`, `/api/auth/...`) on the Admin host, not call Cloud Functions directly.

## Response envelope

Most endpoints return:

```json
{
  "success": true,
  "data": { }
}
```

Errors:

```json
{
  "success": false,
  "error": "Human-readable message"
}
```

HTTP status codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `429` rate limit, `500` server error.

## Authentication headers

| Header | Used by | Purpose |
|--------|---------|---------|
| `Authorization: Bearer <jwt>` | Admin (legacy/direct) | Admin JWT |
| `X-Tardadi-Admin-Token: <jwt>` | Admin BFF → API | Admin JWT when IAM uses Authorization |
| `Authorization: Bearer <identity-token>` | Service accounts | Cloud Run invoker (BFF) |
| Driver token | Driver routes | From driver login flow |

## Endpoints

### Health

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/health` | No | — | Service + Firestore connectivity |

Example response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "tardadi-api",
    "firestore": "ok",
    "latencyMs": 120,
    "region": "us-central1",
    "projectId": "trddk-54c45"
  }
}
```

### Auth

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| POST | `/api/auth/admin-login` | No | — | Admin username/password login |
| POST | `/api/auth/request-password-reset` | No | — | Start password reset |
| POST | `/api/auth/reset-password` | No | — | Complete reset with token |
| POST | `/api/auth/change-password` | Admin JWT | Admin | Change password while logged in |
| POST | `/api/auth/driver-login` | No | — | Driver phone OTP login |

Admin login request:

```json
{
  "login": "admin_username",
  "password": "example-password"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "user-id",
      "username": "admin_username",
      "role": "super_admin",
      "mustChangePassword": false
    }
  }
}
```

### Businesses

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/businesses` | Admin | super_admin | List businesses |
| GET | `/api/businesses/:businessId` | Admin | super / business | Get business |
| GET | `/api/businesses/:businessId/stats` | Admin | super / business | Dashboard stats |
| POST | `/api/businesses` | Admin | super_admin | Create business |
| PUT | `/api/businesses/:businessId` | Admin | super_admin | Update business |
| PATCH | `/api/businesses/:businessId/disable` | Admin | super_admin | Disable business |
| DELETE | `/api/businesses/:businessId` | Admin | super_admin | Delete business |

### Routes

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/routes` | Optional / scoped | — | List routes (query: business) |
| GET | `/api/routes/:routeId` | Optional | — | Route detail + stops |
| GET | `/api/routes/:routeId/live` | Optional | — | Live buses on route |
| POST | `/api/routes` | Admin | super / business | Create route |
| PUT | `/api/routes/:routeId` | Admin | super / business | Update route |
| DELETE | `/api/routes/:routeId` | Admin | super / business | Delete route |

### Buses

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/buses` | Scoped | — | List buses |
| POST | `/api/buses` | Admin | super / business | Create bus |
| PUT | `/api/buses/:busId` | Admin | super / business | Update bus |
| DELETE | `/api/buses/:busId` | Admin | super / business | Delete bus |

### Drivers

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/drivers` | Admin | super / business | List drivers |
| GET | `/api/drivers/me` | Driver | driver | Current driver profile |
| POST | `/api/drivers` | Admin | super / business | Create driver |
| PUT | `/api/drivers/:driverId` | Admin | super / business | Update driver |
| DELETE | `/api/drivers/:driverId` | Admin | super / business | Delete driver |

### Trips

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/trips` | Scoped | — | List trips (filters) |
| POST | `/api/trips/start` | Driver | driver | Start trip |
| POST | `/api/trips/arrived` | Driver | driver | Mark stop arrival |
| POST | `/api/trips/end` | Driver | driver | End trip |

Start trip example:

```json
{
  "businessId": "business-id",
  "routeId": "route-id",
  "busId": "bus-id"
}
```

### GPS

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| POST | `/api/gps` | Driver | driver | Upload GPS fix for active trip |

Example body:

```json
{
  "tripId": "trip-id",
  "lat": 24.7136,
  "lng": 46.6753,
  "heading": 90,
  "speedKmh": 42
}
```

### Reminders

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/reminders` | Passenger / scoped | — | List reminders |
| POST | `/api/reminders` | Passenger | — | Create reminder |
| DELETE | `/api/reminders/:reminderId` | Scoped | — | Delete reminder |

### Routing

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| POST | `/api/routing/route` | Admin / internal | — | Road-following polyline (Google Directions) |

## Admin BFF routes (Next.js)

These run on the Admin host, not Cloud Functions:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Admin + upstream health |
| POST | `/api/auth/login` | Admin login (sets cookie) |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/session` | Current session |
| POST | `/api/auth/forgot-password` | Proxy reset request |
| POST | `/api/auth/reset-password` | Proxy reset complete |
| POST | `/api/auth/change-password` | Proxy password change |
| GET/POST/… | `/api/proxy/[...path]` | Proxied backend API |
| GET | `/api/geocode/search` | Places search (server key) |
| POST | `/api/routing/route` | Admin routing helper |

## Source files

- `firebase/functions/src/index.ts` — mount point
- `firebase/functions/src/routes/*.ts` — route handlers
- `apps/admin/src/app/api/**` — BFF routes

## Error codes (common)

| HTTP | Meaning |
|------|---------|
| 401 | Missing or invalid auth |
| 403 | Valid auth but wrong role/tenant |
| 429 | Rate limit (auth endpoints) |
| 502 | BFF cannot reach upstream (Admin) |
| 503 | Health check upstream/deps failure |
