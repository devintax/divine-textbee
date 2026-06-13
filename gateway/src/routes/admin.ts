import { Router, Request, Response } from 'express'
import { ApiKey } from '../models/ApiKey'
import { Usage } from '../models/Usage'
import { Suppression } from '../models/Suppression'
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

export default router
