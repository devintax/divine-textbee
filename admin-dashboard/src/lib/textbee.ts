const TEXTBEE_API_URL = process.env.TEXTBEE_API_URL || ''
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || ''
const GATEWAY_ADMIN_URL = process.env.GATEWAY_ADMIN_URL || ''
const GATEWAY_ADMIN_TOKEN = process.env.GATEWAY_ADMIN_TOKEN || ''

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': TEXTBEE_API_KEY,
  }
}

export async function fetchDevices() {
  const res = await fetch(`${TEXTBEE_API_URL}/gateway/devices`, {
    headers: headers(),
    next: { revalidate: 15 },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to fetch devices: ${res.status}`)
  }
  const json = await res.json()
  return json.data as Device[]
}

export async function fetchStats() {
  const res = await fetch(`${TEXTBEE_API_URL}/gateway/stats`, {
    headers: headers(),
    next: { revalidate: 15 },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to fetch stats: ${res.status}`)
  }
  const json = await res.json()
  return json.data as Stats
}

export async function sendSms(deviceId: string, message: string, recipients: string[]) {
  const res = await fetch(
    `${TEXTBEE_API_URL}/gateway/devices/${deviceId}/send-sms`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ message, recipients }),
    },
  )
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || json.message || `Send failed: ${res.status}`)
  }
  return json.data
}

export async function fetchMessages(
  deviceId: string,
  page = 1,
  limit = 50,
  type: 'all' | 'sent' | 'received' = 'all',
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    type,
  })
  const res = await fetch(
    `${TEXTBEE_API_URL}/gateway/devices/${deviceId}/messages?${params}`,
    { headers: headers(), next: { revalidate: 10 } },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to fetch messages: ${res.status}`)
  }
  const json = await res.json()
  return json as PaginatedMessages
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
