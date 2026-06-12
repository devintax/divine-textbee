import { Router, Request, Response } from 'express'
import { keyAuth } from '../middleware/keyAuth'
import { Message } from '../models/Message'
import { Usage } from '../models/Usage'
import { getActiveDevices, sendSMS } from '../lib/textbee'
import mongoose from 'mongoose'

const router = Router()
router.use(keyAuth)

router.post('/sms', async (req: Request, res: Response) => {
  const { to, message } = req.body

  if (!to || typeof to !== 'string' || to.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "to" field (phone number with country code)' })
    return
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Missing or invalid "message" field' })
    return
  }
  if (message.length > 1600) {
    res.status(400).json({ error: 'Message too long (max 1600 characters)' })
    return
  }

  const devices = await getActiveDevices()
  if (devices.length === 0) {
    res.status(503).json({ error: 'No active devices available to send SMS' })
    return
  }

  const deviceId = devices[0]._id
  const result = await sendSMS(deviceId, to.trim(), message.trim())

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (result.success) {
    const msg = await Message.create({
      apiKeyId: req.apiKeyId,
      to: to.trim(),
      body: message.trim(),
      status: 'sent',
      textbeeMessageId: result.messageId,
      textbeeBatchId: result.batchId,
    })

    await Usage.findOneAndUpdate(
      { apiKeyId: req.apiKeyId, year, month },
      { $inc: { sent: 1 } },
      { upsert: true },
    )

    res.status(201).json({ id: msg._id, status: 'sent' })
  } else {
    await Message.create({
      apiKeyId: req.apiKeyId,
      to: to.trim(),
      body: message.trim(),
      status: 'failed',
      error: result.error,
    })

    await Usage.findOneAndUpdate(
      { apiKeyId: req.apiKeyId, year, month },
      { $inc: { failed: 1 } },
      { upsert: true },
    )

    res.status(502).json({ error: result.error })
  }
})

router.get('/sms/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid message ID' })
    return
  }

  const msg = await Message.findOne({
    _id: id,
    apiKeyId: req.apiKeyId,
  })

  if (!msg) {
    res.status(404).json({ error: 'Message not found' })
    return
  }

  res.json({
    id: msg._id,
    to: msg.to,
    body: msg.body,
    status: msg.status,
    error: msg.error,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  })
})

router.get('/usage', async (req: Request, res: Response) => {
  const now = new Date()
  const usage = await Usage.findOne({
    apiKeyId: req.apiKeyId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  })

  res.json({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    sent: usage?.sent || 0,
    failed: usage?.failed || 0,
  })
})

export default router
