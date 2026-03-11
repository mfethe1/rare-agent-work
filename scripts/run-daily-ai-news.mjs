#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { runDigestPipeline, sendDigestEmail } from './lib/news-digest.mjs';

function parseArgs(argv) {
  const args = { send: false, windowHours: 24 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--send') args.send = true;
    if (arg === '--window-hours') args.windowHours = Number(argv[i + 1] || '24');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(process.cwd());
  const { digest, artifacts, itemsFetched, storeItems } = await runDigestPipeline(projectRoot, { windowHours: args.windowHours });

  const summary = {
    ok: true,
    digestId: digest.digestId,
    generatedAt: digest.generatedAt,
    windowHours: digest.windowHours,
    storyCount: digest.storyCount,
    recipients: digest.recipientSeedList,
    itemsFetched,
    storeItems,
    artifacts,
    email: { attempted: false },
  };

  if (args.send) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is required for --send');
    }

    const from = process.env.DIGEST_FROM_EMAIL || process.env.CONSULTING_FROM_EMAIL || 'Rare Agent Work <hello@rareagent.work>';
    const subject = `Daily AI News Summary — ${new Date(digest.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const response = await sendDigestEmail({
      resendApiKey,
      from,
      to: digest.recipientSeedList,
      subject,
      digest,
    });

    summary.email = { attempted: true, sent: true, response };
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
