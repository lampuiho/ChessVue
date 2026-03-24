import { z } from 'zod'

export type PlatformErrorKind = 'cancelled' | 'notFound' | 'permissionDenied' | 'invalidDocument' | 'processStartFailed' | 'unexpectedExit'

export interface IPlatformError {
  kind: PlatformErrorKind
  operation: string
  message: string
  detail: string | null
}

export const platformErrorKindSchema = z.enum([
  'cancelled',
  'notFound',
  'permissionDenied',
  'invalidDocument',
  'processStartFailed',
  'unexpectedExit',
])

export const platformErrorSchema = z.object({
  kind: platformErrorKindSchema,
  operation: z.string().min(1),
  message: z.string().min(1),
  detail: z.string().nullable(),
})
