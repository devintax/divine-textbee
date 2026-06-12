import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import axios from 'axios'

@Injectable()
export class TurnstileService {
  async verify(token: string) {
    if (!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
      return
    }

    if (!token) {
      throw new HttpException(
        { error: 'Bot verification is required' },
        HttpStatus.BAD_REQUEST,
      )
    }

    try {
      const params = new URLSearchParams()
      params.append('secret', process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY)
      params.append('response', token)

      const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        params,
        {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        },
      )

      if (!response.data?.success) {
        throw new HttpException(
          { error: 'Bot verification failed. Please try again.' },
          HttpStatus.BAD_REQUEST,
        )
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException(
        { error: 'Unable to verify bot check. Please try again.' },
        HttpStatus.BAD_REQUEST,
      )
    }
  }
}

