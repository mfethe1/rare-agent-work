import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const SUMMARY_FILE = path.join(DATA_DIR, 'news-summary.json');
const EMAIL_OUTPUT = path.join(DATA_DIR, 'daily-email.md');

const SEED_EMAILS = [
  'mfethe1@gmail.com',
  'protelynx@gmail.com',
  'Michael.fethe@protelynx.ai'
];

async function main() {
  if (!fs.existsSync(NEWS_FILE)) {
    console.log('No news.json found.');
    return;
  }

  const raw = fs.readFileSync(NEWS_FILE, 'utf-8');
  const items = JSON.parse(raw);
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const recent = items.filter((i: any) => i.publishedAt >= cutoff);

  if (recent.length === 0) {
    console.log('No recent news. Summary generation skipped.');
    return;
  }

  const prompt = `You are the lead editor for "AI Today", the premium daily brief for AI agent builders, researchers, and operators.
Your job is to analyze the following top news items from the last 24-48 hours and synthesize them into a highly structured, utility-driven briefing.

News items:
${recent.map((i: any) => `- [${i.title}](${i.url}): ${i.summary}`).join('\n\n')}

Create the daily brief following EXACTLY this structure:

# AI Today: What Changed, Why It Matters, What To Do

## 1. TL;DR in 60 seconds
(5 bullets max summarizing the absolute most critical changes)

## 2. Top AI Stories Ranked by Impact
(Pick up to 5-10 stories. For each, use this format:)
### [Story Title]
- **What happened**: 
- **Why it matters**: 
- **Who should care**: 
- **Action step**: 

## 3. Signal vs Noise
- **Overhyped**: (Identify 1-2 things making noise that don't matter yet)
- **Underhyped**: (Identify 1-2 things flying under the radar)
- **Watchlist**: (1-2 things to monitor)

## 4. Builder's Corner
(Tools, prompts, workflows worth using now based on the news. Extract specific utility.)

## 5. Market & Policy Tracker
(Note any funding, regulation, model launches, or enterprise adoption from the news)

## 6. Deeper Dive
(Pick the single most important topic from the news and write a 2-3 paragraph deep dive on its implications.)

## 7. Tomorrow Radar
(What to watch in the next 24-72 hours)

Format as clean, professional Markdown. Be concise, direct, and zero-fluff. Do not use hype words like "revolutionary" or "game-changing".`;

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const summaryText = (response.content[0] as any).text;

    fs.writeFileSync(
      SUMMARY_FILE,
      JSON.stringify({ summary: summaryText, updatedAt: new Date().toISOString() }, null, 2)
    );
    
    fs.writeFileSync(EMAIL_OUTPUT, summaryText);
    console.log('Summary generated successfully. Saved to', SUMMARY_FILE, 'and', EMAIL_OUTPUT);

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const subject = `[AI Today] Daily Brief - ${today}`;

    for (const email of SEED_EMAILS) {
      try {
        const cmd = `gog gmail send --to="${email}" --subject="${subject}" < ${EMAIL_OUTPUT}`;
        console.log(`Sending email to ${email}...`);
        execSync(cmd, { stdio: 'pipe' });
      } catch (e: any) {
        console.error(`Failed to send email to ${email}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Failed to generate summary:', err);
  }
}

main();