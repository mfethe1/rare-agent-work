/**
 * Job Queue Types
 * 
 * Defines the job types, payloads, and status enums for the async job queue system.
 */

export type JobType = 
  | 'stripe.subscription.created'
  | 'stripe.subscription.updated'
  | 'stripe.subscription.deleted'
  | 'stripe.invoice.paid'
  | 'stripe.checkout.completed'
  | 'email.digest.send'
  | 'email.welcome.send'
  | 'email.report.deliver'
  | 'news.ingest.hot'
  | 'news.summary.generate'
  | 'report.generate'
  | 'analytics.track';

export type JobStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

// Base job payload interface
export interface BaseJobPayload {
  type: JobType;
  priority?: JobPriority;
  metadata?: Record<string, unknown>;
}

// Stripe-related job payloads
export interface StripeSubscriptionJobPayload extends BaseJobPayload {
  type: 'stripe.subscription.created' | 'stripe.subscription.updated' | 'stripe.subscription.deleted';
  customerId: string;
  subscriptionId: string;
  customerEmail?: string;
  tier?: string;
  status?: string;
}

export interface StripeInvoiceJobPayload extends BaseJobPayload {
  type: 'stripe.invoice.paid';
  customerId: string;
  invoiceId: string;
  amountPaid: number;
}

export interface StripeCheckoutJobPayload extends BaseJobPayload {
  type: 'stripe.checkout.completed';
  sessionId: string;
  customerId: string;
  customerEmail: string;
  tier: string;
  subscriptionId?: string;
}

// Email job payloads
export interface EmailDigestJobPayload extends BaseJobPayload {
  type: 'email.digest.send';
  recipients: string[];
  windowHours?: number;
}

export interface EmailWelcomeJobPayload extends BaseJobPayload {
  type: 'email.welcome.send';
  email: string;
  tier: string;
}

export interface EmailReportJobPayload extends BaseJobPayload {
  type: 'email.report.deliver';
  email: string;
  reportSlug: string;
  purchaseId: string;
}

// News job payloads
export interface NewsIngestJobPayload extends BaseJobPayload {
  type: 'news.ingest.hot';
  sources?: string[];
}

export interface NewsSummaryJobPayload extends BaseJobPayload {
  type: 'news.summary.generate';
  windowHours?: number;
}

// Report generation job payload
export interface ReportGenerateJobPayload extends BaseJobPayload {
  type: 'report.generate';
  reportSlug: string;
  userId?: string;
}

// Analytics job payload
export interface AnalyticsTrackJobPayload extends BaseJobPayload {
  type: 'analytics.track';
  event: string;
  properties: Record<string, unknown>;
  userId?: string;
}

// Union type of all job payloads
export type JobPayload = 
  | StripeSubscriptionJobPayload
  | StripeInvoiceJobPayload
  | StripeCheckoutJobPayload
  | EmailDigestJobPayload
  | EmailWelcomeJobPayload
  | EmailReportJobPayload
  | NewsIngestJobPayload
  | NewsSummaryJobPayload
  | ReportGenerateJobPayload
  | AnalyticsTrackJobPayload;

// Job record stored in database
export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: JobPayload;
  result?: unknown;
  error?: string;
  attempts: number;
  maxAttempts: number;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Job creation options
export interface CreateJobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

