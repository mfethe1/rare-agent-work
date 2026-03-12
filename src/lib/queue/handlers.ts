/**
 * Job Queue Handlers
 * 
 * Implements the actual processing logic for each job type.
 */

import type { JobPayload } from './types';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Get admin Supabase client for job processing
 */
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, serviceKey);
}

/**
 * Get Stripe client
 */
function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }
  
  return new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });
}

/**
 * Main job handler - routes to specific handlers based on job type
 */
export async function handleJob(payload: JobPayload): Promise<unknown> {
  console.log(`[Handler] Processing job: ${payload.type}`);
  
  switch (payload.type) {
    case 'stripe.subscription.created':
    case 'stripe.subscription.updated':
      return handleStripeSubscriptionUpdate(payload);
    
    case 'stripe.subscription.deleted':
      return handleStripeSubscriptionDeleted(payload);
    
    case 'stripe.invoice.paid':
      return handleStripeInvoicePaid(payload);
    
    case 'stripe.checkout.completed':
      return handleStripeCheckoutCompleted(payload);
    
    case 'email.digest.send':
      return handleEmailDigestSend(payload);
    
    case 'email.welcome.send':
      return handleEmailWelcomeSend(payload);
    
    case 'email.report.deliver':
      return handleEmailReportDeliver(payload);
    
    case 'news.ingest.hot':
      return handleNewsIngestHot(payload);
    
    case 'news.summary.generate':
      return handleNewsSummaryGenerate(payload);
    
    case 'report.generate':
      return handleReportGenerate(payload);
    
    case 'analytics.track':
      return handleAnalyticsTrack(payload);
    
    default:
      throw new Error(`Unknown job type: ${(payload as any).type}`);
  }
}

// Stripe handlers
async function handleStripeSubscriptionUpdate(payload: any) {
  const supabase = getAdminSupabase();
  const { customerId, subscriptionId, customerEmail, tier, status } = payload;
  
  const TIER_BUDGETS: Record<string, number> = {
    starter: 50_000,
    pro: 200_000,
  };
  
  const budget = tier ? TIER_BUDGETS[tier] ?? 0 : 0;
  
  await supabase.from('users').upsert(
    {
      email: customerEmail,
      tier: tier || 'free',
      tokens_budget: budget,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );
  
  return { success: true, customerId, tier };
}

async function handleStripeSubscriptionDeleted(payload: any) {
  const supabase = getAdminSupabase();
  const { customerId } = payload;
  
  await supabase
    .from('users')
    .update({
      tier: 'free',
      tokens_budget: 0,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
  
  return { success: true, customerId };
}

async function handleStripeInvoicePaid(payload: any) {
  const supabase = getAdminSupabase();
  const { customerId } = payload;
  
  // Reset monthly token usage on paid invoice
  await supabase
    .from('users')
    .update({ tokens_used: 0, updated_at: new Date().toISOString() })
    .eq('stripe_customer_id', customerId);
  
  return { success: true, customerId };
}

async function handleStripeCheckoutCompleted(payload: any) {
  return handleStripeSubscriptionUpdate(payload);
}

// Email handlers
async function handleEmailDigestSend(payload: any) {
  // TODO: Implement digest email sending
  console.log('[Handler] Email digest send:', payload);
  return { success: true, recipients: payload.recipients };
}

async function handleEmailWelcomeSend(payload: any) {
  // TODO: Implement welcome email
  console.log('[Handler] Welcome email send:', payload);
  return { success: true, email: payload.email };
}

async function handleEmailReportDeliver(payload: any) {
  // TODO: Implement report delivery email
  console.log('[Handler] Report delivery email:', payload);
  return { success: true, email: payload.email };
}

// News handlers
async function handleNewsIngestHot(payload: any) {
  // Call the hot news ingest endpoint internally
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rareagent.work';
  const apiKey = process.env.HOT_NEWS_API_KEY || process.env.INGEST_API_KEY;

  const response = await fetch(`${baseUrl}/api/news/hot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`News ingest failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

async function handleNewsSummaryGenerate(payload: any) {
  // TODO: Implement news summary generation
  console.log('[Handler] News summary generate:', payload);
  return { success: true };
}

// Report handlers
async function handleReportGenerate(payload: any) {
  // TODO: Implement report generation
  console.log('[Handler] Report generate:', payload);
  return { success: true, reportSlug: payload.reportSlug };
}

// Analytics handlers
async function handleAnalyticsTrack(payload: any) {
  // TODO: Implement analytics tracking
  console.log('[Handler] Analytics track:', payload);
  return { success: true, event: payload.event };
}

