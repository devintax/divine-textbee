# TextBee SMS Gateway — Runbook

Operational procedures for the production deployment.

## Creating a New Internal Account

Registration is **disabled by default** in production. Two options:

### Option A: Temporary registration (any admin with Coolify access)

1. In Coolify, edit the `textbee-api` service environment variables.
2. Set `ALLOW_REGISTRATION=true`.
3. Deploy or restart the service.
4. Have the user register at `https://sms.yourdomain.com/register` (the user-facing web dashboard).
5. **Immediately** set `ALLOW_REGISTRATION=false` and redeploy.

### Option B: Direct MongoDB insert (DB access required)

```javascript
// Connect to MongoDB production (via tunnel or direct)
use textbee;
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('temporary-password', 10);
db.users.insertOne({
  name: 'New User',
  email: 'user@company.com',
  password: hash,
  role: 'REGULAR',
  isBanned: false,
  onboarding: { currentStepId: 'completed', skippedStepIds: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

The user can then login at `https://sms.yourdomain.com/login` and change their password.

## Login Lockout

The login endpoint rate-limits to 5 failed attempts per 15 minutes per IP.

**If a legitimate user is locked out:**

1. Wait 15 minutes — the counter resets automatically.
2. Try from a different network (e.g., mobile hotspot) — the throttle is per IP.
3. If urgent, restart the `textbee-api` container — this clears all in-memory throttle counters.
4. As a last resort, temporarily increase the limit in `auth.controller.ts`:
   - Find `@Throttle({ default: { limit: 5, ttl: 900000 } })`
   - Increase `limit` or decrease `ttl`, rebuild and restart.
   - Set back after the user logs in.

## Verifying Auth Guards Are Working

```bash
# These should ALL return 401 Unauthorized:
curl -s -o /dev/null -w "%{http_code}" https://api-textbee.dfgworld.net/api/v1/gateway/devices
curl -s -o /dev/null -w "%{http_code}" -X POST https://api-textbee.dfgworld.net/api/v1/gateway/devices/fakeid/send-sms
curl -s -o /dev/null -w "%{http_code}" https://api-textbee.dfgworld.net/api/v1/billing/current-subscription
# Expected: 401 401 401

# These should succeed with valid credentials:
curl -s -o /dev/null -w "%{http_code}" -X POST https://api-textbee.dfgworld.net/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
# Expected: 200
```

## Swagger Docs Disabled

If Swagger is unexpectedly visible in production:
- Check `NODE_ENV` is set to `production` in Coolify for `textbee-api`.
- Check `ENABLE_SWAGGER` is NOT set to `true`.

If Swagger is unexpectedly missing in development:
- Check `NODE_ENV` is NOT set to `production`.
- Check `ENABLE_SWAGGER` is NOT set to `false`.

## Registration Disabled

If registration is unexpectedly open in production:
- Check `NODE_ENV` is set to `production` in Coolify for `textbee-api`.
- Check `ALLOW_REGISTRATION` is NOT set to `true`.

If registration is unexpectedly blocked in development:
- Check `ALLOW_REGISTRATION` is not `false`.
- Check `NODE_ENV` is not `production`.

## Restarting Services

```bash
# Restart API only (fastest)
docker compose restart textbee-api

# Full rebuild and restart (after code changes)
docker compose build textbee-api && docker compose up -d textbee-api

# Full stack
docker compose up -d
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `production` disables Swagger docs and registration |
| `ENABLE_SWAGGER` | No | — | `false` force-disables docs; `true` force-enables |
| `ALLOW_REGISTRATION` | No | `true` | `false` blocks public signup; `true` allows it |
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret (rotate on compromise) |
| `TEXTBEE_API_URL` | Yes | — | Internal TextBee API URL |
| `TEXTBEE_API_KEY` | Yes | — | Internal API key for TextBee calls |

## Monitoring

- **401 rate**: A spike in 401s on `/auth/login` may indicate a brute-force attempt in progress. The throttle will handle it, but investigate the source IP.
- **429 rate**: If legitimate users report lockouts, check whether multiple services share the same public IP (e.g., office NAT). Consider increasing the limit or shortening the window.
- **Registration attempts in production**: Should be zero. If logs show `POST /auth/register` traffic, verify `ALLOW_REGISTRATION=false`.
