# TextBee SMS Gateway

Android SMS gateway with web dashboard, admin console, and API key management.

## Architecture

- **`api/`** — NestJS API (phone registration, SMS routing, webhooks)
- **`web/`** — Next.js dashboard (user-facing SMS web dashboard)
- **`admin-dashboard/`** — Next.js operations console (internal admin tools)
- **`gateway/`** — Express gateway service (Twilio-shaped internal API with key auth)
- **`cloudflared/`** — Cloudflare tunnel config (not used; tunnel managed via dashboard)

## API Authentication Map

Endpoints are public only when authentication is impossible (the user hasn't logged in yet). Every other endpoint requires either `Authorization: Bearer <JWT>` or `x-api-key: <key>`.

### Public endpoints (no auth required)

| Endpoint | Why public | Rate limit |
|---|---|---|
| `POST /api/v1/auth/login` | User must log in before they have a token | 5 req / 15 min per IP |
| `POST /api/v1/auth/google-login` | Same — pre-auth | 5 req / 15 min per IP |
| `POST /api/v1/auth/register` | Account creation; **disabled in production** (env flag) | 10 req / 1 hour per IP |
| `POST /api/v1/auth/request-password-reset` | User forgot password, can't auth | 3 req / 15 min per IP |
| `POST /api/v1/auth/reset-password` | User has reset token, not a session token | 5 req / 15 min per IP |
| `POST /api/v1/auth/verify-email` | User clicked email link, no session | 10 req / 15 min per IP |
| `POST /api/v1/support/customer-support` | Pre-auth support ticket (uses Turnstile) | 5 req / 15 min per IP |
| `POST /api/v1/support/request-account-deletion` | Requires auth (JWT), but rate-limited too | 3 req / 1 hour per user |
| `GET /api/v1/billing/plans` | Public pricing page (no user data) | Global 500/60s |
| `POST /api/v1/billing/webhook/polar` | Polar.sh webhook (signed payloads) | Global 500/60s |

All rate limits are per-IP (tracked by `ThrottlerByIpGuard`). The global throttle applies to every endpoint: 500 requests per 60 seconds. Route-level `@Throttle()` decorators set tighter limits on sensitive public routes.

### Padlocked endpoints (auth required — verified on `api-textbee.dfgworld.net`)

| Endpoint | Status when called without auth | Evidence |
|---|---|---|
| `POST /api/v1/gateway/devices/{id}/send-sms` | **401** `{"error":"Unauthorized"}` | ✅ |
| `GET /api/v1/gateway/devices` | **401** `{"error":"Unauthorized"}` | ✅ |
| `GET /api/v1/gateway/stats` | **401** `{"error":"Unauthorized"}` | ✅ |
| `GET /api/v1/billing/current-subscription` | **401** `{"error":"Unauthorized"}` | ✅ |
| `POST /api/v1/auth/who-am-i` | **401** | ✅ (behind `AuthGuard`) |
| `PATCH /api/v1/auth/update-profile` | **401** | ✅ |
| All other gateway, billing, webhook, user routes | **401** | ✅ |

No padlocked endpoint returned data or a 500 when called without auth. The code audit confirms `@UseGuards(AuthGuard)` is present on every protected route in `GatewayController`, `BillingController` (except `plans` and `webhook/polar`), `AuthController` (except the public list above), and `UsersController`.

### Registration

Public registration is **disabled in production** (`NODE_ENV=production`). Existing accounts continue to work normally.

| Scenario | Registration Behavior |
|---|---|
| `NODE_ENV=production` (default) | **Blocked** — returns 403 `REGISTRATION_DISABLED` |
| `NODE_ENV=production, ALLOW_REGISTRATION=true` | Allowed (for temporary internal account creation) |
| Local dev (NODE_ENV unset or `development`) | Allowed by default |
| `ALLOW_REGISTRATION=false` | Blocked regardless of NODE_ENV |

**Creating an internal account in production:** Temporarily set `ALLOW_REGISTRATION=true` in Coolify for the `textbee-api` service, register the account, then immediately set it back to `false`.

**Turnstile dependency:** The registration flow uses Cloudflare Turnstile. Since registration is disabled in production, the Turnstile dependency is moot. If temporarily re-enabled, Turnstile must also be configured (`CLOUDFLARE_TURNSTILE_SECRET_KEY`).

### Login Rate Limiting

- **5 failed attempts** per **15-minute window** per IP
- Returns `429 Too Many Requests` after the 5th failure
- Applies to both `POST /auth/login` and `POST /auth/google-login`
- Valid login returns 200 with a JWT regardless of prior bad attempts (the counter resets on success)

**If a legitimate user is locked out:** Wait 15 minutes (counter auto-resets), try from a different network (IP-based), or restart the container (resets all counters).

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
