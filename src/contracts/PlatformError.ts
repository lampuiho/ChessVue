import { z } from 'zod';

export const enum PlatformErrorKind {
  Cancelled = 'cancelled',
  NotFound = 'notFound',
  AlreadyExists = 'alreadyExists',
  PermissionDenied = 'permissionDenied',
  InvalidDocument = 'invalidDocument',
  InvalidProcessHandle = 'invalidProcessHandle',
  ProcessStartFailed = 'processStartFailed',
  UnexpectedExit = 'unexpectedExit',
  InvalidOperation = 'invalidOperation'
}
export const platformErrorKinds = [
  PlatformErrorKind.Cancelled,
  PlatformErrorKind.NotFound,
  PlatformErrorKind.AlreadyExists,
  PlatformErrorKind.PermissionDenied,
  PlatformErrorKind.InvalidDocument,
  PlatformErrorKind.InvalidProcessHandle,
  PlatformErrorKind.ProcessStartFailed,
  PlatformErrorKind.UnexpectedExit,
  PlatformErrorKind.InvalidOperation,
] as const;
export interface IPlatformError {
  kind: PlatformErrorKind;
  operation: string;
  message: string;
  detail?: string;
}
export class PlatformError extends Error implements IPlatformError {
  constructor(err: IPlatformError) {
    super(err.message);
    this.kind = err.kind;
    this.operation = err.operation;
    this.detail = err.detail;
  }
  kind: PlatformErrorKind;
  operation: string;
  detail?: string;
}
export const platformErrorKindSchema = z.enum(platformErrorKinds);

export const platformErrorSchema = z.object({
  kind: platformErrorKindSchema,
  operation: z.string().min(1),
  message: z.string().min(1),
  detail: z.string().optional(),
});
