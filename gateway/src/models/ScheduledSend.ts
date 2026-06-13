import { Schema, model, Document } from 'mongoose'

export interface IScheduledSend extends Document {
  deviceId: string
  message: string
  recipients: string[]
  scheduledAt: Date
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed'
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  results: { phoneNumber: string; status: string; error?: string }[]
  totalSent: number
  totalFailed: number
  totalSuppressed: number
  createdAt: Date
  updatedAt: Date
}

const ScheduledSendSchema = new Schema<IScheduledSend>({
  deviceId: { type: String, required: true },
  message: { type: String, required: true },
  recipients: [{ type: String, required: true }],
  scheduledAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled', 'failed'],
    default: 'pending',
    index: true,
  },
  recurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none',
  },
  results: [{
    phoneNumber: String,
    status: { type: String, enum: ['sent', 'failed', 'suppressed'] },
    error: String,
  }],
  totalSent: { type: Number, default: 0 },
  totalFailed: { type: Number, default: 0 },
  totalSuppressed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ScheduledSendSchema.index({ status: 1, scheduledAt: 1 })

export const ScheduledSend = model<IScheduledSend>('ScheduledSend', ScheduledSendSchema)
