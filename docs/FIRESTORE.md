# Firestore Data Model

Project: **`trddk-54c45`** · Database: **`(default)`**

## Collection tree

```text
admin_users/{userId}
  username, passwordHash, role, businessId?, name, phone?, status,
  mustChangePassword, createdAt

businesses/{businessId}/
  name, status, adminUserId?, createdAt, ...

  drivers/{driverId}
    name, phone, status, assignedRouteId?, ...

  buses/{busId}
    plateNumber, capacity, routeId?, currentLocation?, status, ...

  routes/{routeId}/
    name, code, color, status, polyline?, ...

    stops/{stopId}
      name, order, lat, lng, ...

  trips/{tripId}/
    routeId, busId, driverId, status, startedAt, endedAt?, ...

    gps_logs/{logId}
      lat, lng, heading?, speedKmh?, recordedAt

  reminders/{reminderId}
    passengerPhone, routeId, stopId?, active, ...

password_reset_tokens/{tokenHash}   # Admin SDK only — not in client rules
  userId, expiresAt, used
```

> Legacy constant `organizations` in `packages/shared` resolves to collection id **`businesses`**. Do not create a separate `organizations` collection.

## Ownership and isolation

| Collection | Scoped by | Notes |
|------------|-----------|-------|
| `admin_users` | Global | Super admins have no `businessId`; business admins have `businessId` set |
| `businesses/*` | `businessId` | Root tenant document |
| Subcollections | Parent `businessId` | All operational data lives under business |

**Business admin** JWT must match document path `businesses/{businessId}` for writes.

**Super admin** may access any business.

## Security rules summary

File: `firebase/firestore.rules`

| Path | Read | Write |
|------|------|-------|
| `admin_users/*` | super_admin | super_admin |
| `businesses/{id}` | super_admin, business_admin(id) | super_admin |
| `drivers`, `buses`, `routes`, `stops` | **public read** | super_admin or business_admin(id) |
| `trips`, `gps_logs` | **public read** | super_admin or business_admin(id); gps_logs create-only |
| `reminders` | public read | create/update public; delete admin |

Most admin writes go through **Cloud Functions (Admin SDK)**, which bypasses rules. Rules protect direct client SDK access (mobile apps).

## Indexes

Defined in `firebase/firestore.indexes.json`. Deploy with:

```bash
firebase deploy --only firestore:indexes --project trddk-54c45
```

Add composite indexes when Firestore errors include an index creation link.

## Common queries (API layer)

- List routes for business: `businesses/{id}/routes`
- Active trips: `trips` where `status == active`
- Live bus location: bus document `currentLocation` updated on GPS POST
- GPS history: `trips/{tripId}/gps_logs` ordered by time

## Admin user document example (fields only)

```json
{
  "username": "example_admin",
  "role": "super_admin",
  "status": "active",
  "mustChangePassword": true,
  "passwordHash": "scrypt:<salt>:<hash>"
}
```

Never store plaintext passwords.

## Emulator seed

`scripts/seed-demo.ts` creates sample documents under business id **`demo-org`** for local development only.

## Migration notes

- Renaming `businesses` → another collection id requires data migration + rules + constants update in `@tardadi/shared`.
- Changing field names on active mobile clients requires coordinated app release.

## Related

- [API.md](API.md)
- [SECURITY.md](SECURITY.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
