import { Schema, model, Document } from 'mongoose'

export interface IApiKey extends Document {
  label: string
  prefix: string
  hash: string
  active: boolean
  monthlyQuota: number
  createdAt: Date
}

const ApiKeySchema = new Schema<IApiKey>({
  label: { type: String, required: true },
  prefix: { type: String, required: true },
  hash: { type: String, required: true, unique: true, index: true },
  active: { type: Boolean, default: true },
  monthlyQuota: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

export const ApiKey = model<IApiKey>('ApiKey', ApiKeySchema)
