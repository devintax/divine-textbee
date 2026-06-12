import express from 'express'
import { connectDB } from './db'
import v1Routes from './routes/v1'
import adminRoutes from './routes/admin'

const PORT = parseInt(process.env.PORT || '4001', 10)
const ADMIN_TOKEN = process.env.GATEWAY_ADMIN_TOKEN || ''

async function main() {
  await connectDB()

  const app = express()
  app.use(express.json())

  // Admin authentication middleware (simple bearer token)
  app.use('/admin', (req, res, next) => {
    const auth = req.headers['authorization']
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token !== ADMIN_TOKEN) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }, adminRoutes)

  // Public v1 API (key-authenticated)
  app.use('/v1', v1Routes)

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gateway listening on port ${PORT}`)
  })
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
