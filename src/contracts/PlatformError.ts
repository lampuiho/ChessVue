import { z } from 'zod'

export const enum PlatformErrorKind {
  Cancelled = 'cancelled',
  NotFound = 'notFound',
  AlreadyExists = 'alreadyExists',
  PermissionDenied = 'permissionDenied',
  InvalidDocument = 'invalidDocument',
  ProcessStartFailed = 'processStartFailed',
  UnexpectedExit = 'unexpectedExit',
}
export const platformErrorKinds = [
  PlatformErrorKind.Cancelled,
  PlatformErrorKind.NotFound,
  PlatformErrorKind.AlreadyExists,
  PlatformErrorKind.PermissionDenied,
  PlatformErrorKind.InvalidDocument,
  PlatformErrorKind.ProcessStartFailed,
  PlatformErrorKind.UnexpectedExit,
] as const

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
