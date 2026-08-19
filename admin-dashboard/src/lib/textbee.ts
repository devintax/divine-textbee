const TEXTBEE_API_URL = process.env.TEXTBEE_API_URL || ''
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || ''
const GATEWAY_ADMIN_URL = process.env.GATEWAY_ADMIN_URL || ''
const GATEWAY_ADMIN_TOKEN = process.env.GATEWAY_ADMIN_TOKEN || ''

export async function fetchTextBee(path: string, options?: RequestInit & { raw?: boolean }) {
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
  fcmTokenUpdatedAt?: string
  fcmTokenInvalidatedAt?: string
  fcmTokenInvalidReason?: string
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
  appVersionInfo?: {
    versionName?: string
    versionCode?: number
    lastUpdated?: string
  }
  sentSMSCount?: number
  receivedSMSCount?: number
  heartbeatEnabled?: boolean
  heartbeatIntervalMinutes?: number
  receiveSMSEnabled?: boolean
  smsSendDelaySeconds?: number
  lastHeartbeat?: string
  batteryInfo?: { percentage?: number; isCharging?: boolean; lastUpdated?: string }
  networkInfo?: { networkType?: string; lastUpdated?: string }
  deviceUptimeInfo?: { uptimeMillis?: number; lastUpdated?: string }
  memoryInfo?: {
    freeBytes?: number
    totalBytes?: number
    maxBytes?: number
    lastUpdated?: string
  }
  storageInfo?: {
    availableBytes?: number
    totalBytes?: number
    lastUpdated?: string
  }
  systemInfo?: {
    timezone?: string
    locale?: string
    lastUpdated?: string
  }
  simInfo?: {
    sims?: Array<{
      subscriptionId?: number
      iccId?: string
      cardId?: number
      carrierName?: string
      displayName?: string
      simSlotIndex?: number
      mcc?: string
      mnc?: string
      countryIso?: string
      subscriptionType?: string
    }>
    lastUpdated?: string
  }
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
  const res = await fetch('/api/textbee/generate-key', { method: 'POST' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Failed to generate key')
  if (typeof json.data !== 'string' || json.data.length === 0) {
    throw new Error('Generate key returned an invalid response')
  }
  return json.data
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

// ── Templates ──────────────────────────────────────────────────────────────────────────

export interface Template {
  id: string
  name: string
  body: string
  createdAt: string
  updatedAt: string
}

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/templates`, { headers: gatewayHeaders(), next: { revalidate: 5 } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed to fetch templates: ${res.status}`)
  const json = await res.json()
  return json.data as Template[]
}

export async function createTemplate(name: string, body: string): Promise<Template> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/templates`, { method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({ name, body }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Create template failed: ${res.status}`)
  return json
}

export async function updateTemplate(id: string, name: string, body: string): Promise<Template> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/templates/${id}`, { method: 'PUT', headers: gatewayHeaders(), body: JSON.stringify({ name, body }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Update template failed: ${res.status}`)
  return json
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/templates/${id}`, { method: 'DELETE', headers: gatewayHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Delete template failed: ${res.status}`)
}

// ── Bulk send ──────────────────────────────────────────────────────────────────────────

// ── Device health ──────────────────────────────────────────────────────────────────

export interface DeviceHealthEntry {
  id: string
  name: string
  enabled: boolean
  onlineState: 'online' | 'offline' | 'never'
  lastHeartbeat: string | null
  lastSeenAgo: string | null
  heartbeatIntervalMinutes: number | null
  batteryPercentage: number | null
  batteryCharging: boolean | null
  networkType: string | null
  uptimeSeconds: number | null
  appVersionName: string | null
  simCarrier: string | null
  lastStateChange: string | null
  lastAlertedAt: string | null
  sentSMSCount: number | undefined
  receivedSMSCount: number | undefined
}

export interface HeartbeatLogEntry {
  deviceId: string
  timestamp: string
  batteryPercentage: number | null
  batteryCharging: boolean | null
  networkType: string | null
  uptimeSeconds: number | null
  appVersion: string | null
  simCarrier: string | null
}

export async function fetchDeviceHealth(): Promise<DeviceHealthEntry[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/device-health`, { headers: gatewayHeaders(), next: { revalidate: 5 } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed to fetch device health: ${res.status}`)
  const json = await res.json()
  return json.data as DeviceHealthEntry[]
}

export async function fetchHeartbeatHistory(deviceId: string, limit = 50): Promise<HeartbeatLogEntry[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/heartbeat-history/${deviceId}?limit=${limit}`, { headers: gatewayHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed to fetch heartbeat history: ${res.status}`)
  const json = await res.json()
  return json.data as HeartbeatLogEntry[]
}

export async function checkDeviceOnline(deviceId: string): Promise<{ onlineState: string; lastHeartbeat: string | null; lastSeenAgo: string | null; batteryPercentage: number | null }> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/check-device-online`, { method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({ deviceId }) })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Check device online failed: ${res.status}`)
  return res.json()
}

export interface BulkSendResult {
  results: { phoneNumber: string; message: string; status: string; error?: string }[]
  total: number
  sent: number
  failed: number
  suppressed: number
}

export async function bulkSend(deviceId: string, entries: { phone: string; message: string }[], delaySeconds = 3): Promise<BulkSendResult> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/bulk-send`, { method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({ recipients: entries, deviceId, delaySeconds }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Bulk send failed: ${res.status}`)
  return json.data as BulkSendResult
}

// ── Scheduled sends ────────────────────────────────────────────────────────────────────

export interface ScheduledSendEntry {
  id: string
  deviceId: string
  message: string
  recipients: string[]
  scheduledAt: string
  status: string
  recurrence: string
  totalSent: number
  totalFailed: number
  totalSuppressed: number
  createdAt: string
}

export async function fetchScheduledSends(): Promise<ScheduledSendEntry[]> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/scheduled-sends`, { headers: gatewayHeaders(), next: { revalidate: 5 } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed to fetch scheduled sends: ${res.status}`)
  const json = await res.json()
  return json.data as ScheduledSendEntry[]
}

export async function createScheduledSend(deviceId: string, message: string, recipients: string[], scheduledAt: string, recurrence = 'none'): Promise<ScheduledSendEntry> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/scheduled-sends`, { method: 'POST', headers: gatewayHeaders(), body: JSON.stringify({ deviceId, message, recipients, scheduledAt, recurrence }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Create scheduled send failed: ${res.status}`)
  return json
}

export async function cancelScheduledSend(id: string): Promise<void> {
  const res = await fetch(`${GATEWAY_ADMIN_URL}/admin/scheduled-sends/${id}`, { method: 'DELETE', headers: gatewayHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Cancel scheduled send failed: ${res.status}`)
}

export async function wakeDevice(deviceId: string): Promise<{ success: boolean; fcmSent: boolean; tokenPresent: boolean; tokenInvalidated: boolean; message: string }> {
  const res = await fetch(`/api/textbee/devices/${deviceId}/wake`, { method: 'POST' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || json.data?.message || 'Wake failed')
  return json.data
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
