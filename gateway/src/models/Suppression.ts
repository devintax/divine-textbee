import { Schema, model, Document } from 'mongoose'

export interface ISuppression extends Document {
  phoneNumber: string
  reason: string
  source: 'manual' | 'auto_stop'
  createdAt: Date
}

const SuppressionSchema = new Schema<ISuppression>({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  reason: { type: String, default: 'Opted out via STOP' },
  source: { type: String, enum: ['manual', 'auto_stop'], default: 'manual' },
  createdAt: { type: Date, default: Date.now },
})

export const Suppression = model<ISuppression>('Suppression', SuppressionSchema)
