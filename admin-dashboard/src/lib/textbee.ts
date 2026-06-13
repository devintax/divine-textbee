const TEXTBEE_API_URL = process.env.TEXTBEE_API_URL || ''
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || ''
const GATEWAY_ADMIN_URL = process.env.GATEWAY_ADMIN_URL || ''
const GATEWAY_ADMIN_TOKEN = process.env.GATEWAY_ADMIN_TOKEN || ''

async function fetchTextBee(path: string, options?: RequestInit & { raw?: boolean }) {
  const url = `${TEXTBEE_API_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': TEXTBEE_API_KEY,
      ...(options?.headers || {}),
    },
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch {
    throw new Error(`TextBee API returned HTTP ${res.status} at ${path}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(json.error || json.message || `TextBee API error ${res.status} at ${path}`)
  }
  return options?.raw ? json : (json.data ?? json)
}

export async function fetchDevices() {
  return fetchTextBee('/gateway/devices', { next: { revalidate: 15 } }) as Promise<Device[]>
}

export async function fetchStats() {
  return fetchTextBee('/gateway/stats', { next: { revalidate: 15 } }) as Promise<Stats>
}

export async function sendSms(deviceId: string, message: string, recipients: string[]) {
  return fetchTextBee(`/gateway/devices/${deviceId}/send-sms`, {
    method: 'POST',
    body: JSON.stringify({ message, recipients }),
  })
}

export async function fetchMessages(
  deviceId: string,
  page = 1,
  limit = 50,
  type: 'all' | 'sent' | 'received' = 'all',
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), type })
  return fetchTextBee(`/gateway/devices/${deviceId}/messages?${params}`, {
    next: { revalidate: 10 },
    raw: true,
  }) as Promise<PaginatedMessages>
}

export function isDeviceOnline(device: Device): boolean {
  if (!device.lastHeartbeat) return false
  const interval = (device.heartbeatIntervalMinutes || 30) * 60 * 1000
  const elapsed = Date.now() - new Date(device.lastHeartbeat).getTime()
  return elapsed < interval * 2
}

export interface Device {
  _id: string
  user: string
  enabled: boolean
  fcmToken?: string
  brand?: string
  manufacturer?: string
  model?: string
  name?: string
  serial?: string
  buildId?: string
  os?: string
  osVersion?: string
  appVersionName?: string
  appVersionCode?: number
  sentSMSCount?: number
  receivedSMSCount?: number
  heartbeatEnabled?: boolean
  heartbeatIntervalMinutes?: number
  receiveSMSEnabled?: boolean
  smsSendDelaySeconds?: number
  lastHeartbeat?: string
  createdAt: string
  updatedAt: string
}

export interface Stats {
  totalSentSMSCount: number
  totalReceivedSMSCount: number
  totalDeviceCount: number
  totalApiKeyCount: number
}

export interface SMSRecord {
  _id: string
  device: { _id: string; brand?: string; model?: string; buildId?: string; enabled?: boolean }
  message: string
  type: 'SENT' | 'RECEIVED'
  recipient?: string
  sender?: string
  status: 'pending' | 'dispatched' | 'sent' | 'delivered' | 'failed' | 'unknown' | 'received'
  requestedAt?: string
  dispatchedAt?: string
  sentAt?: string
  deliveredAt?: string
  failedAt?: string
  errorCode?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedMessages {
  data: SMSRecord[]
  meta: PaginationMeta
}

// ── Gateway API Keys ──────────────────────────────────────────────────────────────────────

export interface GatewayApiKey {
  id: string
  label: string
  prefix: string
  active: boolean
  monthlyQuota: number
  createdAt: string
  thisMonth: { sent: number; failed: number }
}

export interface CreateKeyResult {
  id: string
  label: string
  prefix: string
  key: string
}

function gatewayHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GATEWAY_ADMIN_TOKEN}`,
  }
}

export async function fetchApiKeys(): Promise<GatewayApiKey[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/keys`, {
    headers: gatewayHeaders(),
    next: { revalidate: 5 },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to fetch keys: ${res.status}`)
  }
  const json = await res.json()
  return json.data as GatewayApiKey[]
}

export async function createApiKey(label: string): Promise<CreateKeyResult> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/keys`, {
    method: 'POST',
    headers: gatewayHeaders(),
    body: JSON.stringify({ label }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `Create key failed: ${res.status}`)
  }
  return json
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/keys/${id}/revoke`, {
    method: 'POST',
    headers: gatewayHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Revoke key failed: ${res.status}`)
  }
}

// ── TextBee API keys (for device pairing) ─────────────────────────────────────────────────

export async function generateTextBeeApiKey(): Promise<string> {
  const result = await fetchTextBee('/auth/api-keys', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  // Response is { data: "<uuid>" } where data is the string directly
  return typeof result === 'string' ? result : result.apiKey || result
}

// ── Device management ──────────────────────────────────────────────────────────────────────

// ── Suppression list ─────────────────────────────────────────────────────────────────────

export interface SuppressionEntry {
  id: string
  phoneNumber: string
  reason: string
  source: 'manual' | 'auto_stop'
  createdAt: string
}

export async function fetchSuppressions(): Promise<SuppressionEntry[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/suppressions`, {
    headers: gatewayHeaders(),
    next: { revalidate: 5 },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to fetch suppressions: ${res.status}`)
  }
  const json = await res.json()
  return json.data as SuppressionEntry[]
}

export async function createSuppression(phoneNumber: string, reason?: string): Promise<SuppressionEntry> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/suppressions`, {
    method: 'POST',
    headers: gatewayHeaders(),
    body: JSON.stringify({ phoneNumber, reason }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `Add suppression failed: ${res.status}`)
  }
  return json
}

export async function deleteSuppression(id: string): Promise<void> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/suppressions/${id}`, {
    method: 'DELETE',
    headers: gatewayHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Delete suppression failed: ${res.status}`)
  }
}

export async function checkSuppressed(phoneNumbers: string[]): Promise<string[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/suppressions/check`, {
    method: 'POST',
    headers: gatewayHeaders(),
    body: JSON.stringify({ phoneNumbers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Check suppression failed: ${res.status}`)
  }
  const json = await res.json()
  return (json.suppressed as { phoneNumber: string }[]).map((s) => s.phoneNumber)
}

export async function deleteTextBeeDevice(deviceId: string): Promise<void> {
  await fetchTextBee(`/gateway/devices/${deviceId}`, {
    method: 'DELETE',
  })
}

export async function patchTextBeeDevice(
  deviceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await fetchTextBee(`/gateway/devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
