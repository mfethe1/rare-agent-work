/**
 * Centralized API error sanitization.
 *
 * NEVER return raw error.message from Supabase, Stripe, or LLM providers
 * to the client — they can leak table names, column details, API keys in
 * URLs, or other internal implementation details.
 *
 * Instead, log the real error server-side and return a generic message.
 */

/** Standard client-safe error responses keyed by domain. */
const SAFE_MESSAGES: Record<string, string> = {
  db: 'A database error occurred. Please try again later.',
  auth: 'Authentication failed.',
  validation: 'The request could not be processed due to invalid input.',
  webhook: 'Webhook processing encountered an error.',
  synthesis: 'Content generation failed. Please try again.',
  quality: 'Generated content did not pass quality checks.',
  queue: 'Job queue operation failed. Please try again.',
  stream: 'The AI response stream was interrupted. Please retry.',
  provider: 'The AI provider returned an error. Please try a different model or retry.',
  unknown: 'An unexpected error occurred. Please try again later.',
};

type ErrorDomain = keyof typeof SAFE_MESSAGES;

/**
 * Log the real error server-side and return a sanitized message for the client.
 *
 * @param error  - The caught error (unknown type from catch blocks)
 * @param domain - Category of the error (determines the safe client message)
 * @param context - Optional context string for the server log (e.g. route name)
 * @returns A client-safe error string
 */
export function sanitizeError(
  error: unknown,
  domain: ErrorDomain = 'unknown',
  context?: string,
): string {
  const realMessage =
    error instanceof Error ? error.message : String(error);

  // Always log the real error for debugging
  console.error(
    `[API Error]${context ? ` ${context}:` : ''}`,
    realMessage,
  );

  return SAFE_MESSAGES[domain] ?? SAFE_MESSAGES.unknown;
}

/**
 * Convenience: build a NextResponse-compatible JSON body with a sanitized error.
 * Use with: `return NextResponse.json(safeErrorBody(err, 'db', 'POST /api/drafts'), { status: 500 })`
 */
export function safeErrorBody(
  error: unknown,
  domain: ErrorDomain = 'unknown',
  context?: string,
): { error: string } {
  return { error: sanitizeError(error, domain, context) };
}
