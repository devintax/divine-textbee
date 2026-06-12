import { Schema, model, Document } from 'mongoose'

export interface IUsage extends Document {
  apiKeyId: Schema.Types.ObjectId
  year: number
  month: number
  sent: number
  failed: number
}

const UsageSchema = new Schema<IUsage>({
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
})

UsageSchema.index({ apiKeyId: 1, year: 1, month: 1 }, { unique: true })

export const Usage = model<IUsage>('Usage', UsageSchema)
