import express from 'express'
import { connectDB } from './db'
import { ScheduledSend } from './models/ScheduledSend'
import { Suppression } from './models/Suppression'
import { HeartbeatLog } from './models/HeartbeatLog'
import { AlertState } from './models/AlertState'
import { getDevices, getActiveDevices, sendSMS } from './lib/textbee'
import { sendAlert } from './services/alerter'
import v1Routes from './routes/v1'
import adminRoutes from './routes/admin'

const PORT = parseInt(process.env.PORT || '4001', 10)
const ADMIN_TOKEN = process.env.GATEWAY_ADMIN_TOKEN || ''
const SEND_DELAY_SECONDS = parseInt(process.env.BULK_SEND_DELAY || '3', 10)
const SCHEDULER_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL || '30000', 10)
const HEALTH_CHECK_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10)
const OFFLINE_THRESHOLD_MULTIPLIER = parseInt(process.env.OFFLINE_THRESHOLD_MULTIPLIER || '2', 10)

async function processScheduledSends() {
  try {
    const due = await ScheduledSend.find({
      status: 'pending',
      scheduledAt: { $lte: new Date() },
    }).sort({ scheduledAt: 1 }).limit(5)

    for (const job of due) {
      // Check device is online before firing
      if (job.deviceId) {
        const devices = await getDevices()
        const dev = devices.find((d) => d._id === job.deviceId)
        if (dev) {
          const lastHb = dev.lastHeartbeat ? new Date(dev.lastHeartbeat).getTime() : 0
          const interval = (dev.heartbeatIntervalMinutes || 30) * 60 * 1000
          const stale = lastHb > 0 && (Date.now() - lastHb) > interval * OFFLINE_THRESHOLD_MULTIPLIER
          if (stale) {
            job.status = 'failed'
            job.totalFailed = job.recipients.length
            await job.save()
            console.warn(`Scheduled send ${job._id} blocked: device ${job.deviceId} offline`)
            await sendAlert(
              `Scheduled send blocked — device offline`,
              `Scheduled send ${job._id} was blocked because device ${job.deviceId} is offline.\nScheduled for: ${job.scheduledAt}\nRecipients: ${job.recipients.length}\nMessage: ${job.message.slice(0, 200)}`,
            )
            continue
          }
        }
      }

      job.status = 'processing'
      await job.save()

      const suppressed = await Suppression.find({ phoneNumber: { $in: job.recipients } }).lean()
      const suppressedSet = new Set(suppressed.map((s) => s.phoneNumber))
      const devices = job.deviceId ? [{ _id: job.deviceId }] : await getActiveDevices()
      const device = devices?.[0]
      if (!device) {
        job.status = 'failed'
        job.totalFailed = job.recipients.length
        await job.save()
        continue
      }

      let sent = 0, failed = 0, suppressedCount = 0
      const results: { phoneNumber: string; status: string; error?: string }[] = []

      for (const phoneNumber of job.recipients) {
        if (suppressedSet.has(phoneNumber)) {
          results.push({ phoneNumber, status: 'suppressed', error: 'Opted out' })
          suppressedCount++
          continue
        }
        try {
          const r = await sendSMS(device._id, phoneNumber, job.message)
          if (r.success) { results.push({ phoneNumber, status: 'sent' }); sent++ }
          else { results.push({ phoneNumber, status: 'failed', error: r.error }); failed++ }
        } catch (err: any) {
          results.push({ phoneNumber, status: 'failed', error: err.message }); failed++
        }
        if (job.recipients.length > 1) await new Promise((r) => setTimeout(r, SEND_DELAY_SECONDS * 1000))
      }

      job.results = results
      job.totalSent = sent
      job.totalFailed = failed
      job.totalSuppressed = suppressedCount
      job.status = job.totalFailed > 0 && job.totalSent === 0 ? 'failed' : 'completed'
      await job.save()
    }
  } catch (err) {
    console.error('Scheduler error:', err)
  }
}

async function checkDeviceHealth() {
  try {
    const devices = await getDevices()
    for (const device of devices) {
      // Log heartbeat
      if (device.lastHeartbeat) {
        await HeartbeatLog.create({
          deviceId: device._id,
          timestamp: new Date(device.lastHeartbeat),
          batteryPercentage: device.batteryInfo?.percentage,
          batteryCharging: device.batteryInfo?.isCharging,
          networkType: device.networkInfo?.networkType,
          uptimeSeconds: device.deviceUptimeInfo ? Math.round((device.deviceUptimeInfo.uptimeMillis || 0) / 1000) : undefined,
          appVersion: device.appVersionName,
          simCarrier: device.simInfo?.sims?.[0]?.carrierName,
          deviceBrand: device.brand,
          deviceModel: device.model,
        }).catch(() => {})
      }

      // Check staleness
      const lastHb = device.lastHeartbeat ? new Date(device.lastHeartbeat).getTime() : 0
      const interval = (device.heartbeatIntervalMinutes || 30) * 60 * 1000
      const now = Date.now()
      const isFresh = lastHb > 0 && (now - lastHb) < interval * OFFLINE_THRESHOLD_MULTIPLIER
      const currentState = isFresh ? 'online' : (lastHb === 0 ? 'unknown' : 'offline')

      const prevState = await AlertState.findOne({ deviceId: device._id })
      if (!prevState) {
        await AlertState.create({ deviceId: device._id, lastState: currentState, stateChangedAt: new Date() })
        continue
      }

      if (prevState.lastState !== currentState) {
        prevState.lastState = currentState
        prevState.stateChangedAt = new Date()
        prevState.lastAlertedAt = new Date()
        await prevState.save()

        const deviceLabel = device.name || `${device.brand || ''} ${device.model || ''}`.trim() || device._id

        if (currentState === 'offline') {
          const lastSeen = device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : 'never'
          const battery = device.batteryInfo ? `${device.batteryInfo.percentage || '?'}%${device.batteryInfo.isCharging ? ' (charging)' : ''}` : 'unknown'
          await sendAlert(
            `[ALERT] Device OFFLINE: ${deviceLabel}`,
            `Device ${deviceLabel} (${device._id}) has gone offline.\n\nLast heartbeat: ${lastSeen}\nBattery: ${battery}\nNetwork: ${device.networkInfo?.networkType || 'unknown'}\nApp: ${device.appVersionName || '?'} (${device.appVersionCode || '?'})\n\nRecovery: Open the TextBee Gateway app on the phone to reconnect.\nPrevention: Disable battery optimization for the app and keep the phone on reliable power.\n\nThis alert fires once per offline transition — you will not be spammed.`,
          )
        } else if (currentState === 'online' && prevState.lastState === 'offline') {
          await sendAlert(
            `[RECOVERED] Device ONLINE: ${deviceLabel}`,
            `Device ${deviceLabel} (${device._id}) is back online.\nLast heartbeat: ${device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : 'just now'}\n\nYou can resume sending through this device.`,
          )
        }
      }
    }
  } catch (err) {
    console.error('Health check error:', err)
  }
}

async function main() {
  await connectDB()

  const app = express()
  app.use(express.json())

  app.use('/admin', (req, res, next) => {
    const auth = req.headers['authorization']
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token !== ADMIN_TOKEN) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }, adminRoutes)

  app.use('/v1', v1Routes)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gateway listening on port ${PORT}`)
  })

  setInterval(processScheduledSends, SCHEDULER_INTERVAL_MS)
  console.log(`Scheduler started: polling every ${SCHEDULER_INTERVAL_MS}ms`)

  setInterval(checkDeviceHealth, HEALTH_CHECK_INTERVAL_MS)
  console.log(`Health monitor started: checking every ${HEALTH_CHECK_INTERVAL_MS}ms`)

  // Run health check immediately on startup
  setTimeout(checkDeviceHealth, 5000)
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
