const TEXTBEE_API_URL = process.env.TEXTBEE_API_URL || 'http://textbee-api:3001/api/v1'
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || ''

interface SendSMSResult {
  success: boolean
  messageId?: string
  batchId?: string
  error?: string
}

interface DeviceInfo {
  _id: string
  enabled: boolean
}

export interface DeviceDetails {
  _id: string
  enabled: boolean
  lastHeartbeat?: string
  heartbeatEnabled?: boolean
  heartbeatIntervalMinutes?: number
  brand?: string
  model?: string
  name?: string
  batteryInfo?: {
    percentage?: number
    isCharging?: boolean
    lastUpdated?: string
  }
  networkInfo?: {
    networkType?: string
    lastUpdated?: string
  }
  deviceUptimeInfo?: {
    uptimeMillis?: number
    lastUpdated?: string
  }
  appVersionName?: string
  appVersionCode?: number
  simInfo?: {
    sims?: Array<{ carrierName?: string }>
    lastUpdated?: string
  }
  sentSMSCount?: number
  receivedSMSCount?: number
  updatedAt?: string
}

export async function getDevices(): Promise<DeviceDetails[]> {
  const res = await fetch(`${TEXTBEE_API_URL}/gateway/devices`, {
    headers: { 'x-api-key': TEXTBEE_API_KEY },
  })
  if (!res.ok) return []
  const json = await res.json() as { data?: DeviceDetails[] }
  return json.data || []
}

export async function getActiveDevices(): Promise<DeviceInfo[]> {
  const all = await getDevices()
  return all.filter((d: DeviceDetails) => d.enabled)
}

export async function sendSMS(deviceId: string, to: string, message: string): Promise<SendSMSResult> {
  try {
    const res = await fetch(`${TEXTBEE_API_URL}/gateway/devices/${deviceId}/sendSMS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEXTBEE_API_KEY,
      },
      body: JSON.stringify({
        recipients: [to],
        message,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, error: `TextBee error ${res.status}: ${body}` }
    }

    const json = await res.json() as Record<string, unknown>
    const body = (json.data || json) as Record<string, unknown>
    return {
      success: body.success !== false,
      messageId: String(body._id || body.smsId || ''),
      batchId: String(body.smsBatchId || ''),
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
