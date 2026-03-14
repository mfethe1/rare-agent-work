/**
 * Runtime environment variable validation.
 *
 * Validates that critical env vars exist at startup (or first import)
 * and logs clear warnings for missing optional vars.
 * This prevents the app from running in a silently broken state.
 */

interface EnvVar {
  key: string;
  required: boolean;
  /** Human-readable feature that breaks without this var */
  feature: string;
}

const ENV_SCHEMA: EnvVar[] = [
  // Supabase — required for all data operations
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, feature: 'Database' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, feature: 'Database (client)' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, feature: 'Database (server admin)' },

  // Stripe — required for payments
  { key: 'STRIPE_SECRET_KEY', required: true, feature: 'Payments' },
  { key: 'STRIPE_WEBHOOK_SECRET', required: true, feature: 'Stripe webhooks' },

  // AI providers — at least one required for chat
  { key: 'ANTHROPIC_API_KEY', required: false, feature: 'Claude chat' },
  { key: 'OPENAI_API_KEY', required: false, feature: 'GPT chat' },

  // Email — required for form submissions
  { key: 'RESEND_API_KEY', required: false, feature: 'Email delivery (consulting/submit-work forms)' },

  // Redis — required for rate limiting
  { key: 'UPSTASH_REDIS_REST_URL', required: false, feature: 'Rate limiting' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: false, feature: 'Rate limiting' },

  // Internal service keys
  { key: 'INGEST_API_KEY', required: false, feature: 'News/article ingestion' },
];

export interface EnvValidationResult {
  valid: boolean;
  missing: { key: string; feature: string; required: boolean }[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: EnvValidationResult['missing'] = [];
  const warnings: string[] = [];

  for (const { key, required, feature } of ENV_SCHEMA) {
    if (!process.env[key]) {
      missing.push({ key, feature, required });
    }
  }

  // Check that at least one AI provider is configured
  const hasAIProvider =
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OPENAI_API_KEY ||
    !!process.env.GOOGLE_AI_API_KEY ||
    !!process.env.GEMINI_API_KEY;

  if (!hasAIProvider) {
    warnings.push('No AI provider API key configured — chat endpoints will be unavailable');
  }

  const requiredMissing = missing.filter((m) => m.required);
  const optionalMissing = missing.filter((m) => !m.required);

  if (requiredMissing.length > 0) {
    console.error(
      `[ENV] CRITICAL: ${requiredMissing.length} required env var(s) missing:\n` +
        requiredMissing.map((m) => `  - ${m.key} (${m.feature})`).join('\n'),
    );
  }

  if (optionalMissing.length > 0) {
    console.warn(
      `[ENV] ${optionalMissing.length} optional env var(s) missing (features degraded):\n` +
        optionalMissing.map((m) => `  - ${m.key} (${m.feature})`).join('\n'),
    );
  }

  for (const w of warnings) {
    console.warn(`[ENV] ${w}`);
  }

  return {
    valid: requiredMissing.length === 0,
    missing,
    warnings,
  };
}

// Run validation on first import (fires once at server startup)
const _envResult = validateEnv();
if (!_envResult.valid) {
  console.error(
    '[ENV] Application started with missing required environment variables. Some features will fail.',
  );
}
