# TextBee SMS Gateway

Android SMS gateway with web dashboard, admin console, and API key management.

## Architecture

- **`api/`** — NestJS API (phone registration, SMS routing, webhooks)
- **`web/`** — Next.js dashboard (user-facing SMS web dashboard)
- **`admin-dashboard/`** — Next.js operations console (internal admin tools)
- **`gateway/`** — Express gateway service (Twilio-shaped internal API with key auth)
- **`cloudflared/`** — Cloudflare tunnel config (not used; tunnel managed via dashboard)

## Swagger / API Docs

Swagger UI (auto-generated OpenAPI docs) is served at the API root (`/`).

| Environment | Swagger Available? | How to Access |
|---|---|---|
| **Development** (local, `NODE_ENV=development`) | Yes | `http://localhost:3001/` |
| **Production** (`NODE_ENV=production`) | No | Must run locally |

Swagger is disabled in production because the API subdomain (`api-textbee.dfgworld.net`) is publicly reachable (the Android device and internal apps authenticate via token/key, not via a browser). The docs UI would leak API surface to unauthenticated browsers.

### Env Configuration

- `NODE_ENV` — Set to `production` on Coolify to disable Swagger.
- `ENABLE_SWAGGER` — (optional) Set to `false` to force-disable docs even in dev. Set to `true` to override `NODE_ENV=production` and re-enable docs.

### Coolify Setup

In the Coolify environment variables for the `textbee-api` service, set:

```
NODE_ENV=production
```

All API endpoints remain token/key-protected in all environments regardless of the Swagger setting. No other auth changes are required.

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
