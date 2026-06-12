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

export async function getActiveDevices(): Promise<DeviceInfo[]> {
  const res = await fetch(`${TEXTBEE_API_URL}/gateway/devices`, {
    headers: { 'x-api-key': TEXTBEE_API_KEY },
  })
  if (!res.ok) return []
  const json = await res.json() as { data?: DeviceInfo[] }
  return (json.data || []).filter((d: DeviceInfo) => d.enabled)
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

    const json = await res.json() as { _id?: string; smsId?: string; smsBatchId?: string }
    return {
      success: true,
      messageId: json._id || json.smsId,
      batchId: json.smsBatchId,
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
