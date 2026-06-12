import { Request, Response, NextFunction } from 'express'
import { hashKey } from '../lib/hash'
import { ApiKey } from '../models/ApiKey'
import { Usage } from '../models/Usage'

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string
    }
  }
}

export async function keyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['authorization'] || req.headers['x-api-key']
  if (!header) {
    res.status(401).json({ error: 'Missing API key' })
    return
  }

  let key: string
  if (Array.isArray(header)) {
    key = header[0]
  } else if (header.startsWith('Bearer ')) {
    key = header.slice(7)
  } else {
    key = header
  }

  const hashed = hashKey(key)
  const apiKey = await ApiKey.findOne({ hash: hashed })

  if (!apiKey) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  if (!apiKey.active) {
    res.status(401).json({ error: 'API key is revoked' })
    return
  }

  if (apiKey.monthlyQuota > 0) {
    const now = new Date()
    const usage = await Usage.findOne({
      apiKeyId: apiKey._id,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    })
    const used = usage?.sent || 0
    if (used >= apiKey.monthlyQuota) {
      res.status(429).json({ error: 'Monthly quota exceeded' })
      return
    }
  }

  req.apiKeyId = apiKey._id.toString()
  next()
}
