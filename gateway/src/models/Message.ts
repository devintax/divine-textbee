import { Schema, model, Document } from 'mongoose'

export interface IMessage extends Document {
  apiKeyId: Schema.Types.ObjectId
  to: string
  body: string
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  error?: string
  textbeeMessageId?: string
  textbeeBatchId?: string
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<IMessage>({
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
  to: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed'], default: 'queued' },
  error: { type: String },
  textbeeMessageId: { type: String },
  textbeeBatchId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

export const Message = model<IMessage>('Message', MessageSchema)
