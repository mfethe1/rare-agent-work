#!/usr/bin/env node
/**
 * Job Queue Worker Process
 * 
 * Standalone worker process for processing background jobs.
 * Run this as a separate process/dyno on Railway or other platforms.
 * 
 * Usage:
 *   npm run worker
 *   or
 *   node --loader ts-node/esm scripts/worker.ts
 */

import { startWorker } from '../src/lib/queue/worker';

console.log('='.repeat(60));
console.log('Rare Agent Work - Job Queue Worker');
console.log('='.repeat(60));
console.log('');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Redis URL:', process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || 'not set');
console.log('Concurrency:', process.env.WORKER_CONCURRENCY || '5');
console.log('Max jobs/sec:', process.env.WORKER_MAX_JOBS_PER_SECOND || '10');
console.log('');
console.log('Starting worker...');
console.log('');

// Validate required environment variables
const requiredEnvVars = [
  'REDIS_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName] && !process.env[varName.replace('REDIS_URL', 'UPSTASH_REDIS_URL')]
);

if (missingVars.length > 0) {
  console.error('ERROR: Missing required environment variables:');
  missingVars.forEach((varName) => console.error(`  - ${varName}`));
  console.error('');
  console.error('Please set these variables before starting the worker.');
  process.exit(1);
}

// Start the worker
try {
  const worker = startWorker();
  
  console.log('✓ Worker started successfully');
  console.log('');
  console.log('Press Ctrl+C to stop the worker gracefully');
  console.log('');
  
  // Keep the process alive
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
  });
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
  });
} catch (error) {
  console.error('FATAL: Failed to start worker:', error);
  process.exit(1);
}

