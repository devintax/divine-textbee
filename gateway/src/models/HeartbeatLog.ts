import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  batteryPercentage: Number,
  batteryCharging: Boolean,
  networkType: String,
  uptimeSeconds: Number,
  appVersion: String,
  simCarrier: String,
  deviceBrand: String,
  deviceModel: String,
})

schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 })

export const HeartbeatLog = mongoose.model('HeartbeatLog', schema)
