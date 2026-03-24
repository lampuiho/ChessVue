import { z } from 'zod'

export const platformErrorKinds = ['cancelled', 'notFound', 'permissionDenied', 'invalidDocument', 'processStartFailed', 'unexpectedExit'] as const

export const enum PlatformErrorKind {
  Cancelled = 'cancelled',
  NotFound = 'notFound',
  PermissionDenied = 'permissionDenied',
  InvalidDocument = 'invalidDocument',
  ProcessStartFailed = 'processStartFailed',
  UnexpectedExit = 'unexpectedExit',
}

export interface IPlatformError {
  kind: PlatformErrorKind
  operation: string
  message: string
  detail: string | null
}

export const platformErrorKindSchema = z.enum(platformErrorKinds)

export const platformErrorSchema = z.object({
  kind: platformErrorKindSchema,
  operation: z.string().min(1),
  message: z.string().min(1),
  detail: z.string().nullable(),
})
