import { PlatformErrorKind, type IPlatformError } from '@/contracts';

export function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'operation' in error && 'message' in error;
}
export function toPlatformError(operation: string, error: unknown): IPlatformError {
  if (isPlatformError(error)) return { ...error, operation };
  if (error instanceof Error) return { kind: PlatformErrorKind.UnexpectedExit, operation, message: error.message };
  return { kind: PlatformErrorKind.UnexpectedExit, operation, message: String(error) };
}
export function logHandledError(scope: string, operation: string, error: unknown): IPlatformError {
  const platformError = toPlatformError(operation, error);
  console.error(`[${scope}] ${operation} failed.`, platformError, error);
  return platformError;
}
