import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const DATA_DIR = path.join(process.cwd(), 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const SUMMARY_FILE = path.join(DATA_DIR, 'news-summary.json');

async function main() {
  if (!fs.existsSync(NEWS_FILE)) {
    console.log('No news.json found.');
    return;
  }

  const raw = fs.readFileSync(NEWS_FILE, 'utf-8');
  const items = JSON.parse(raw);
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = items.filter((i: any) => i.publishedAt >= cutoff);

  if (recent.length === 0) {
    fs.writeFileSync(
      SUMMARY_FILE,
      JSON.stringify({ summary: 'No new updates in the past 24 hours.', updatedAt: new Date().toISOString() })
    );
    console.log('No recent news. Summary generated.');
    return;
  }

  const prompt = `You are an AI agent news summarizer. Here are the top news items from the last 24 hours:

${recent.map((i: any) => `- ${i.title}: ${i.summary}`).join('\n\n')}

Provide a concise 1-2 paragraph highlighted summary of these updates. Focus on what changed, why it matters, and operator relevance. Format as plain text with simple markdown.`;

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const summaryText = (response.content[0] as any).text;

    fs.writeFileSync(
      SUMMARY_FILE,
      JSON.stringify({ summary: summaryText, updatedAt: new Date().toISOString() }, null, 2)
    );
    console.log('Summary generated successfully.');
  } catch (err) {
    console.error('Failed to generate summary:', err);
  }
}

main();