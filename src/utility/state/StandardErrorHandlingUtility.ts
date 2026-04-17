import { PlatformErrorKind, type IPlatformError } from '@/contracts';

export function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error && 'operation' in error;
}
export function toPlatformError(operation: string, error: unknown): IPlatformError {
  if (isPlatformError(error)) return { ...error, operation };
  return {
    kind: PlatformErrorKind.UnexpectedExit,
    operation,
    message: error instanceof Error ? error.message : 'Unknown runtime error.',
    detail: error instanceof Error && error.stack ? error.stack : undefined,
  };
}
export function logHandledError(scope: string, operation: string, error: unknown): IPlatformError {
  const platformError = toPlatformError(operation, error);
  console.error(`[${scope}] ${platformError.message}`, error);
  return platformError;
}
