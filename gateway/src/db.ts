import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://adminUser:password@localhost:27017/textbee_gateway?authSource=admin'

export async function connectDB(): Promise<void> {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB (textbee_gateway)')
}
