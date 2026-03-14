/**
 * Next.js instrumentation hook — runs once at server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Validate environment variables at server startup
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env');
    validateEnv();
  }
}
