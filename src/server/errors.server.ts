import '@tanstack/react-start/server-only'
import { formatError, type ErrorCode } from '~/lib/errors'

export class MeseleError extends Error {
  constructor(
    public code: ErrorCode,
    userMessage: string,
  ) {
    super(formatError(code, userMessage))
    this.name = 'MeseleError'
  }
}

export const fail = (code: ErrorCode, message: string): never => {
  throw new MeseleError(code, message)
}

export const unauthorized = () => fail('UNAUTHORIZED', 'Oturumunuz kapandı. Hesabınızla yeniden giriş yapabilirsiniz.')

export const notFound = () => fail('NOT_FOUND', 'Aradığın mesele bulunamadı.')
