import { Router, Request, Response } from 'express'
import { ApiKey } from '../models/ApiKey'
import { Usage } from '../models/Usage'
import { Suppression } from '../models/Suppression'
import { Template } from '../models/Template'
import { ScheduledSend } from '../models/ScheduledSend'
import { getActiveDevices, sendSMS } from '../lib/textbee'
import { generateKey, hashKey } from '../lib/hash'

const router = Router()

router.get('/keys', async (_req: Request, res: Response) => {
  const keys = await ApiKey.find().sort({ createdAt: -1 }).lean()
  const now = new Date()
  const results = await Promise.all(
    keys.map(async (k) => {
      const usage = await Usage.findOne({
        apiKeyId: k._id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
      return {
        id: k._id,
        label: k.label,
        prefix: k.prefix,
        active: k.active,
        monthlyQuota: k.monthlyQuota,
        createdAt: k.createdAt,
        thisMonth: { sent: usage?.sent || 0, failed: usage?.failed || 0 },
      }
    }),
  )
  res.json({ data: results })
})

router.post('/keys', async (req: Request, res: Response) => {
  const { label, monthlyQuota } = req.body
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "label"' })
    return
  }

  const { raw, prefix } = generateKey()
  const key = await ApiKey.create({
    label: label.trim(),
    prefix,
    hash: hashKey(raw),
    monthlyQuota: monthlyQuota || 0,
  })

  res.status(201).json({
    id: key._id,
    label: key.label,
    prefix: key.prefix,
    key: raw,
    message: 'Store this key securely — it will not be shown again.',
  })
})

router.post('/keys/:id/revoke', async (req: Request, res: Response) => {
  const key = await ApiKey.findByIdAndUpdate(req.params.id as string, { active: false }, { new: true })
  if (!key) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.json({ id: key._id, label: key.label, active: key.active })
})

// ── Suppression list ──────────────────────────────────────────────────────────────────────

router.get('/suppressions', async (_req: Request, res: Response) => {
  const items = await Suppression.find().sort({ createdAt: -1 }).lean()
  res.json({
    data: items.map((s) => ({
      id: s._id,
      phoneNumber: s.phoneNumber,
      reason: s.reason,
      source: s.source,
      createdAt: s.createdAt,
    })),
  })
})

router.post('/suppressions', async (req: Request, res: Response) => {
  const { phoneNumber, reason } = req.body
  if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "phoneNumber"' })
    return
  }

  const normalized = phoneNumber.trim()
  const exists = await Suppression.findOne({ phoneNumber: normalized })
  if (exists) {
    res.status(409).json({ error: 'Phone number is already suppressed' })
    return
  }

  const item = await Suppression.create({
    phoneNumber: normalized,
    reason: reason || 'Manually added',
    source: 'manual',
  })

  res.status(201).json({
    id: item._id,
    phoneNumber: item.phoneNumber,
    reason: item.reason,
    source: item.source,
    createdAt: item.createdAt,
  })
})

router.delete('/suppressions/:id', async (req: Request, res: Response) => {
  const item = await Suppression.findByIdAndDelete(req.params.id as string)
  if (!item) {
    res.status(404).json({ error: 'Suppression not found' })
    return
  }
  res.json({ success: true, phoneNumber: item.phoneNumber })
})

router.post('/suppressions/check', async (req: Request, res: Response) => {
  const { phoneNumbers } = req.body
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    res.status(400).json({ error: 'Missing or invalid "phoneNumbers" array' })
    return
  }

  const found = await Suppression.find({
    phoneNumber: { $in: phoneNumbers.map((p: string) => p.trim()) },
  }).lean()

  res.json({
    suppressed: found.map((s) => ({
      phoneNumber: s.phoneNumber,
      reason: s.reason,
    })),
  })
})

// ── Templates ────────────────────────────────────────────────────────────────────────────

router.get('/templates', async (_req: Request, res: Response) => {
  const templates = await Template.find().sort({ createdAt: -1 }).lean()
  res.json({ data: templates.map((t) => ({ id: t._id, name: t.name, body: t.body, createdAt: t.createdAt, updatedAt: t.updatedAt })) })
})

router.post('/templates', async (req: Request, res: Response) => {
  const { name, body } = req.body
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "name"' })
    return
  }
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "body"' })
    return
  }
  const existing = await Template.findOne({ name: name.trim() })
  if (existing) {
    res.status(409).json({ error: 'Template with this name already exists' })
    return
  }
  const t = await Template.create({ name: name.trim(), body: body.trim() })
  res.status(201).json({ id: t._id, name: t.name, body: t.body, createdAt: t.createdAt, updatedAt: t.updatedAt })
})

router.put('/templates/:id', async (req: Request, res: Response) => {
  const { name, body } = req.body
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (name) update.name = name.trim()
  if (body) update.body = body.trim()
  const t = await Template.findByIdAndUpdate(req.params.id, update, { new: true })
  if (!t) { res.status(404).json({ error: 'Template not found' }); return }
  res.json({ id: t._id, name: t.name, body: t.body, createdAt: t.createdAt, updatedAt: t.updatedAt })
})

router.delete('/templates/:id', async (req: Request, res: Response) => {
  const t = await Template.findByIdAndDelete(req.params.id)
  if (!t) { res.status(404).json({ error: 'Template not found' }); return }
  res.json({ success: true })
})

// ── Bulk send (paced, suppression-checked) ─────────────────────────────────────────────

router.post('/bulk-send', async (req: Request, res: Response) => {
  try {
    const { message, recipients, deviceId, delaySeconds } = req.body
    if (!message || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: 'Missing or invalid message/recipients' })
      return
    }

    const delay = Math.max(1, Math.min(60, parseInt(delaySeconds) || 3))
    const devices = deviceId ? [{ _id: deviceId }] : await getActiveDevices()
    if (!devices || devices.length === 0) {
      res.status(503).json({ error: 'No active devices available' })
      return
    }
    const device = devices[0]._id

    // Check each recipient against suppression
    const suppressed = await Suppression.find({ phoneNumber: { $in: recipients.map((r: string) => r.trim()) } }).lean()
    const suppressedSet = new Set(suppressed.map((s) => s.phoneNumber))

    const results: { phoneNumber: string; status: string; error?: string }[] = []
    let sent = 0, failed = 0, skipped = 0

    for (const rawRecipient of recipients) {
      const phoneNumber = rawRecipient.trim()
      if (suppressedSet.has(phoneNumber)) {
        results.push({ phoneNumber, status: 'suppressed', error: 'Opted out' })
        skipped++
        continue
      }
      try {
        const result = await sendSMS(device, phoneNumber, message)
        if (result.success) {
          results.push({ phoneNumber, status: 'sent' })
          sent++
        } else {
          results.push({ phoneNumber, status: 'failed', error: result.error })
          failed++
        }
      } catch (err: any) {
        results.push({ phoneNumber, status: 'failed', error: err.message })
        failed++
      }
      // Pace between sends
      if (recipients.length > 1) {
        await new Promise((r) => setTimeout(r, delay * 1000))
      }
    }

    res.json({ data: { results, total: recipients.length, sent, failed, suppressed: skipped } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Scheduled sends ────────────────────────────────────────────────────────────────────

router.get('/scheduled-sends', async (_req: Request, res: Response) => {
  const items = await ScheduledSend.find().sort({ scheduledAt: -1 }).lean()
  res.json({ data: items.map((s) => ({ id: s._id, deviceId: s.deviceId, message: s.message, recipients: s.recipients, scheduledAt: s.scheduledAt, status: s.status, recurrence: s.recurrence, totalSent: s.totalSent, totalFailed: s.totalFailed, totalSuppressed: s.totalSuppressed, createdAt: s.createdAt })) })
})

router.post('/scheduled-sends', async (req: Request, res: Response) => {
  const { deviceId, message, recipients, scheduledAt, recurrence } = req.body
  if (!deviceId || !message || !Array.isArray(recipients) || recipients.length === 0 || !scheduledAt) {
    res.status(400).json({ error: 'Missing required fields: deviceId, message, recipients, scheduledAt' })
    return
  }
  const sched = new Date(scheduledAt)
  if (isNaN(sched.getTime())) {
    res.status(400).json({ error: 'Invalid scheduledAt date' })
    return
  }
  const item = await ScheduledSend.create({ deviceId, message, recipients: recipients.map((r: string) => r.trim()), scheduledAt: sched, recurrence: recurrence || 'none' })
  res.status(201).json({ id: item._id, scheduledAt: item.scheduledAt, status: item.status, recipientCount: item.recipients.length })
})

router.delete('/scheduled-sends/:id', async (req: Request, res: Response) => {
  const item = await ScheduledSend.findByIdAndUpdate(req.params.id, { status: 'cancelled', updatedAt: new Date() }, { new: true })
  if (!item) { res.status(404).json({ error: 'Scheduled send not found' }); return }
  res.json({ success: true, status: item.status })
})

export default router
