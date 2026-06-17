import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  lastState: { type: String, enum: ['online', 'offline', 'unknown'], default: 'unknown' },
  lastAlertedAt: Date,
  stateChangedAt: Date,
})

export const AlertState = mongoose.model('AlertState', schema)
