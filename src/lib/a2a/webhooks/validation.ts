/**
 * Zod validation schemas for webhook subscription endpoints.
 */

import { z } from 'zod';
import { ALL_EVENT_TYPES, EVENT_DOMAINS } from './types';

const trimmed = (max = 5000) => z.string().trim().max(max);

/** Validate an event pattern: exact type, domain wildcard, or global wildcard. */
const eventPatternSchema = trimmed(64).refine(
  (val) => {
    if (val === '*') return true;
    if (val.endsWith('.*')) {
      const domain = val.slice(0, -2);
      return (EVENT_DOMAINS as readonly string[]).includes(domain);
    }
    return (ALL_EVENT_TYPES as string[]).includes(val);
  },
  {
    message:
      'Invalid event pattern. Use exact types (e.g., "task.completed"), domain wildcards (e.g., "task.*"), or "*" for all events.',
  },
);

// ──────────────────────────────────────────────
// POST /api/a2a/subscriptions — Create subscription
// ──────────────────────────────────────────────

export const subscriptionCreateSchema = z.object({
  target_url: z
    .string()
    .url('Must be a valid URL')
    .max(2000)
    .refine(
      (url) => url.startsWith('https://') || process.env.NODE_ENV !== 'production',
      { message: 'Webhook URLs must use HTTPS in production.' },
    ),
  events: z
    .array(eventPatternSchema)
    .min(1, 'At least one event pattern is required')
    .max(20, 'Maximum 20 event patterns per subscription'),
  secret: trimmed(256).min(32, 'Secret must be at least 32 characters for security'),
  label: trimmed(200).optional(),
});

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;

// ──────────────────────────────────────────────
// DELETE /api/a2a/subscriptions/:id — path param validated in route
// ──────────────────────────────────────────────

export const subscriptionIdSchema = z.string().uuid('Invalid subscription ID');
