import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Device, DeviceDocument } from '../schemas/device.schema'
import * as firebaseAdmin from 'firebase-admin'
import { Message } from 'firebase-admin/messaging'

const FCM_BATCH_SIZE = 500

function isPermanentFcmTokenError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) {
    return false
  }

  const normalizedCode = String(error.code || '')
    .toLowerCase()
    .replace(/^messaging\//, '')
  const normalizedMessage = String(error.message || '').toLowerCase()

  if (
    normalizedCode === 'registration-token-not-registered' ||
    normalizedCode === 'unregistered' ||
    normalizedCode === 'invalid-registration-token'
  ) {
    return true
  }

  if (
    normalizedMessage.includes('requested entity was not found') ||
    normalizedMessage.includes('not registered') ||
    normalizedMessage.includes('registration token is not a valid')
  ) {
    return true
  }

  return false
}

@Injectable()
export class HeartbeatCheckTask {
  private readonly logger = new Logger(HeartbeatCheckTask.name)

  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
  ) {}

  /**
   * Cron job that runs hourly to check for devices with stale heartbeats
   * (>30 minutes) and send FCM push notifications to trigger heartbeat requests.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndTriggerStaleHeartbeats() {
    this.logger.log('Running cron job to check for stale heartbeats')

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      // Find devices with stale heartbeats.
      // Include devices with valid FCM tokens OR tokens invalidated >24h ago
      // (retry allows recovery if the app re-registered a token).
      // Use $and to combine the stale-heartbeat and token-validity OR groups.
      const devices = await this.deviceModel.find({
        heartbeatEnabled: true,
        enabled: true,
        fcmToken: { $exists: true, $ne: null },
        $and: [
          {
            $or: [
              { lastHeartbeat: null },
              { lastHeartbeat: { $lt: thirtyMinutesAgo } },
            ],
          },
          {
            $or: [
              { fcmTokenInvalidatedAt: { $exists: false } },
              { fcmTokenInvalidatedAt: { $lt: twentyFourHoursAgo } },
            ],
          },
        ],
      })

      if (devices.length === 0) {
        this.logger.log('No devices with stale heartbeats found')
        return
      }

      this.logger.log(
        `Found ${devices.length} device(s) with stale heartbeats, sending FCM notifications`,
      )

      // Send FCM messages to trigger heartbeats
      const fcmMessages: Message[] = []
      const deviceIds: string[] = []

      for (const device of devices) {
        if (!device.fcmToken) {
          continue
        }

        const fcmMessage: Message = {
          data: {
            type: 'heartbeat_check',
          },
          token: device.fcmToken,
          android: {
            priority: 'high',
          },
        }

        fcmMessages.push(fcmMessage)
        deviceIds.push(device._id.toString())
      }

      if (fcmMessages.length === 0) {
        this.logger.warn('No valid FCM tokens found for devices with stale heartbeats')
        return
      }

      // Track which devices had invalidated tokens before sending (for recovery detection)
      const wasInvalidatedMap = new Map<string, boolean>()
      for (const device of devices) {
        if (device.fcmTokenInvalidatedAt) {
          wasInvalidatedMap.set(device._id.toString(), true)
        }
      }

      // Send FCM messages in batches (FCM allows max 500 per sendEach call)
      let totalSuccessCount = 0
      let totalFailureCount = 0

      for (let i = 0; i < fcmMessages.length; i += FCM_BATCH_SIZE) {
        const batch = fcmMessages.slice(i, i + FCM_BATCH_SIZE)
        const batchDeviceIds = deviceIds.slice(i, i + FCM_BATCH_SIZE)
        const response = await firebaseAdmin.messaging().sendEach(batch)

        totalSuccessCount += response.successCount
        totalFailureCount += response.failureCount

        const invalidationUpdates: Array<{
          deviceId: string
          reason: string
        }> = []
        const recoveryUpdates: string[] = []

        response.responses.forEach((resp, index) => {
          const deviceId = batchDeviceIds[index]
          if (!resp.success) {
            const errorMessage = resp.error?.message || 'Unknown error'
            const errorCode = resp.error?.code || 'UNKNOWN_ERROR'

            this.logger.error(
              `Failed to send heartbeat check to device ${deviceId}: ${errorMessage}`,
            )

            if (isPermanentFcmTokenError(resp.error)) {
              invalidationUpdates.push({
                deviceId,
                reason: `${errorCode}: ${errorMessage}`,
              })
            }
          } else if (wasInvalidatedMap.get(deviceId)) {
            recoveryUpdates.push(deviceId)
          }
        })

        if (invalidationUpdates.length > 0) {
          const invalidatedAt = new Date()
          await this.deviceModel.bulkWrite(
            invalidationUpdates.map(({ deviceId, reason }) => ({
              updateOne: {
                filter: { _id: new Types.ObjectId(deviceId) },
                update: {
                  $set: {
                    fcmTokenInvalidatedAt: invalidatedAt,
                    fcmTokenInvalidReason: reason,
                  },
                },
              },
            })),
          )

          this.logger.warn(
            `Marked ${invalidationUpdates.length} device(s) as FCM-token-invalid; heartbeat retries paused until token update`,
          )
        }

        if (recoveryUpdates.length > 0) {
          await this.deviceModel.bulkWrite(
            recoveryUpdates.map((deviceId) => ({
              updateOne: {
                filter: { _id: new Types.ObjectId(deviceId) },
                update: {
                  $unset: {
                    fcmTokenInvalidatedAt: '',
                    fcmTokenInvalidReason: '',
                  },
                },
              },
            })),
          )

          this.logger.log(
            `Cleared FCM token invalidation for ${recoveryUpdates.length} device(s) — token is valid again`,
          )
        }
      }

      this.logger.log(
        `Sent ${totalSuccessCount} heartbeat check FCM notification(s), ${totalFailureCount} failed`,
      )
    } catch (error) {
      this.logger.error('Error checking and triggering stale heartbeats', error)
    }
  }
}
