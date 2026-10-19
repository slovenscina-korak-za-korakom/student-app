import { isClerkAPIResponseError } from '@clerk/expo';

type ClerkErrorLike = {
  clerkError?: boolean;
  message?: string;
  longMessage?: string;
};

/**
 * Extracts a user-friendly message from a Clerk error, falling back to `fallback`.
 * Handles both thrown API errors (classic flows) and the `ClerkError` objects
 * returned by the future sign-in/sign-up methods.
 */
export function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    return first?.longMessage ?? first?.message ?? fallback;
  }
  if (typeof err === 'object' && 'clerkError' in err) {
    const e = err as ClerkErrorLike;
    return e.longMessage ?? e.message ?? fallback;
  }
  return fallback;
}
