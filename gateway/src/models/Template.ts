import { Schema, model, Document } from 'mongoose'

export interface ITemplate extends Document {
  name: string
  body: string
  createdAt: Date
  updatedAt: Date
}

const TemplateSchema = new Schema<ITemplate>({
  name: { type: String, required: true, unique: true, trim: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

export const Template = model<ITemplate>('Template', TemplateSchema)
