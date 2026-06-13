import express from 'express'
import { connectDB } from './db'
import { ScheduledSend } from './models/ScheduledSend'
import { Suppression } from './models/Suppression'
import { getActiveDevices, sendSMS } from './lib/textbee'
import v1Routes from './routes/v1'
import adminRoutes from './routes/admin'

const PORT = parseInt(process.env.PORT || '4001', 10)
const ADMIN_TOKEN = process.env.GATEWAY_ADMIN_TOKEN || ''
const SEND_DELAY_SECONDS = parseInt(process.env.BULK_SEND_DELAY || '3', 10)
const SCHEDULER_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL || '30000', 10)

async function processScheduledSends() {
  try {
    const due = await ScheduledSend.find({
      status: 'pending',
      scheduledAt: { $lte: new Date() },
    }).sort({ scheduledAt: 1 }).limit(5)

    for (const job of due) {
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

async function main() {
  await connectDB()

  const app = express()
  app.use(express.json())

  // Admin authentication middleware (simple bearer token)
  app.use('/admin', (req, res, next) => {
    const auth = req.headers['authorization']
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token !== ADMIN_TOKEN) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }, adminRoutes)

  // Public v1 API (key-authenticated)
  app.use('/v1', v1Routes)

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gateway listening on port ${PORT}`)
  })

  // Start scheduler (polls MongoDB for due sends every N seconds)
  setInterval(processScheduledSends, SCHEDULER_INTERVAL_MS)
  console.log(`Scheduler started: polling every ${SCHEDULER_INTERVAL_MS}ms`)
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
