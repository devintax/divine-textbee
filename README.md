# TextBee SMS Gateway

Android SMS gateway with web dashboard, admin console, and API key management.

## Architecture

- **`api/`** — NestJS API (phone registration, SMS routing, webhooks)
- **`web/`** — Next.js dashboard (user-facing SMS web dashboard)
- **`admin-dashboard/`** — Next.js operations console (internal admin tools)
- **`gateway/`** — Express gateway service (Twilio-shaped internal API with key auth)
- **`cloudflared/`** — Cloudflare tunnel config (not used; tunnel managed via dashboard)

## API Authentication

Only **three** auth endpoints are intentionally public (unauthenticated):

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /api/v1/auth/login` | Password login | Rate-limited: 5 attempts / 15 min per IP |
| `POST /api/v1/auth/google-login` | Google OAuth login | Rate-limited: 5 attempts / 15 min per IP |
| `POST /api/v1/auth/register` | Create account | **Disabled in production** (see below) |

**Every other endpoint** requires either:
- `Authorization: Bearer <JWT>` header (from login), or
- `x-api-key: <key>` header (API key generated in dashboard)

This includes all gateway routes (`/gateway/devices/*`), billing routes (`/billing/*`), user routes, and webhook management. Verified in Phase 0 — unauthenticated calls to protected routes return `401 Unauthorized`, not data.

`GET /api/v1/billing/plans` is intentionally unguarded (public pricing), `POST /api/v1/billing/webhook/polar` uses webhook signature validation. Neither exposes user data or SMS capabilities.

## Registration

Public registration is **disabled in production** (`NODE_ENV=production`). Existing accounts continue to work normally.

| Scenario | Registration Behavior |
|---|---|
| `NODE_ENV=production` (default) | **Blocked** — returns 403 `REGISTRATION_DISABLED` |
| `NODE_ENV=production, ALLOW_REGISTRATION=true` | Allowed (for temporary internal account creation) |
| Local dev (NODE_ENV unset or `development`) | Allowed by default |
| `ALLOW_REGISTRATION=false` | Blocked regardless of NODE_ENV |

### Creating an internal account in production

1. Temporarily set `ALLOW_REGISTRATION=true` in Coolify for the `textbee-api` service.
2. Register the account, then immediately set `ALLOW_REGISTRATION=false`.
3. The account can now login normally.

### Turnstile dependency

The registration flow uses Cloudflare Turnstile for bot protection. Since registration is disabled in production, the Turnstile dependency on `/register` is moot. If you temporarily re-enable registration, Turnstile must also be configured (set `CLOUDFLARE_TURNSTILE_SECRET_KEY`).

## Login Rate Limiting

The login endpoint is rate-limited per IP:

- **5 failed attempts** per **15-minute window**
- After the 5th failure, returns `429 Too Many Requests`
- Applies to both `POST /auth/login` and `POST /auth/google-login`
- A global rate limit of 500 requests per 60s also applies to all endpoints (managed by `ThrottlerByIpGuard`)

If a legitimate user is locked out, wait 15 minutes or restart the container (resets in-memory counters). The lockout is IP-based, so trying from a different network (e.g., mobile data) will work immediately.

## Swagger / API Docs

Swagger UI (auto-generated OpenAPI docs) is served at the API root (`/`).

| Environment | Swagger Available? | How to Access |
|---|---|---|
| **Development** (local, `NODE_ENV=development`) | Yes | `http://localhost:3001/` |
| **Production** (`NODE_ENV=production`) | No | Must run locally |

Swagger is disabled in production because the API subdomain (`api-textbee.dfgworld.net`) is publicly reachable (the Android device and internal apps authenticate via token/key, not via a browser). The docs UI would leak API surface to unauthenticated browsers.

### Env Configuration

- `NODE_ENV` — Set to `production` on Coolify to disable Swagger and registration.
- `ENABLE_SWAGGER` — (optional) Set to `false` to force-disable docs even in dev. Set to `true` to override `NODE_ENV=production` and re-enable docs.
- `ALLOW_REGISTRATION` — Set to `false` to block public signups. Set to `true` to temporarily allow registration in production.

### Coolify Setup

In the Coolify environment variables for the `textbee-api` service, set:

```
NODE_ENV=production
ALLOW_REGISTRATION=false
```

## Running Locally

```bash
# Copy env and customize
cp .env.example .env

# Start all services
docker compose up -d

# API docs: http://localhost:3001/
# Web dashboard: http://localhost:3000/
# Admin console: http://localhost:4000/
```
