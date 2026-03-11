import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_WINDOW_HOURS = 24;
const FEEDS = [
  { url: 'https://openai.com/news/rss.xml', source: 'OpenAI', category: 'model-release', tags: ['openai', 'models', 'frontier-models'], priority: 5 },
  { url: 'https://www.anthropic.com/news/rss.xml', source: 'Anthropic', category: 'model-release', tags: ['anthropic', 'models', 'safety'], priority: 5 },
  { url: 'https://blog.google/technology/ai/rss/', source: 'Google AI', category: 'research', tags: ['google', 'ai', 'research'], priority: 4 },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'Hugging Face', category: 'open-source', tags: ['huggingface', 'open-source', 'builders'], priority: 4 },
  { url: 'https://openai.com/index/rss.xml', source: 'OpenAI Index', category: 'industry-news', tags: ['openai', 'industry'], priority: 4 },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', source: 'MIT Technology Review', category: 'industry-news', tags: ['industry', 'analysis'], priority: 3 },
];

function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value = '') {
  return value.replace(/<[^>]*>/g, ' ');
}

function decodeEntities(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/');
}

function getTag(block, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return regex.exec(block)?.[1] ?? '';
}

function getAtomLink(block) {
  const hrefMatch = /<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
  if (hrefMatch?.[1]) return hrefMatch[1];
  return getTag(block, 'link');
}

function extractEntries(xml) {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const atomMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  return itemMatches.length > 0 ? itemMatches : atomMatches;
}

function inferTags(title, summary, baseTags = []) {
  const haystack = `${title} ${summary}`.toLowerCase();
  const tagMap = [
    ['openai', /\bopenai|gpt|codex\b/],
    ['anthropic', /\banthropic|claude\b/],
    ['google', /\bgoogle|gemini|tensorflow\b/],
    ['meta', /\bmeta|llama\b/],
    ['microsoft', /\bmicrosoft|copilot\b/],
    ['security', /\bsecurity|vulnerability|attack|threat|guardrail\b/],
    ['policy', /\bpolicy|regulation|act|government|compliance\b/],
    ['funding', /\bfunding|raised|valuation|investment|acquisition\b/],
    ['open-source', /\bopen source|open-source|apache|mit license|github\b/],
    ['builders', /\bapi|sdk|framework|tool|terminal|cli|workflow|agent\b/],
    ['benchmark', /\bbenchmark|eval|evaluation|leaderboard\b/],
    ['research', /\barxiv|paper|research|study\b/],
  ];

  const tags = new Set(baseTags.map((tag) => tag.toLowerCase()));
  for (const [tag, regex] of tagMap) {
    if (regex.test(haystack)) tags.add(tag);
  }
  return Array.from(tags);
}

function confidenceFor(item) {
  const source = (item.source || '').toLowerCase();
  const url = (item.url || '').toLowerCase();
  if (url.includes('arxiv.org') || source.includes('openai') || source.includes('anthropic') || source.includes('google') || source.includes('hugging face')) {
    return 'high';
  }
  if (source.includes('technology review') || source.includes('the information') || source.includes('reuters') || source.includes('bloomberg')) {
    return 'high';
  }
  if (source.includes('reddit') || source.includes('hacker news') || source.includes('x.com') || source.includes('twitter')) {
    return 'medium';
  }
  return 'medium';
}

function deriveAction(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/security|attack|vulnerability|guardrail|iam/.test(text)) return 'Audit agent permissions, browser/session boundaries, and prompt-injection defenses this week.';
  if (/api|sdk|framework|open-source|terminal|workflow|tool/.test(text)) return 'Test the new tooling in a small internal workflow before it becomes table stakes.';
  if (/benchmark|eval|research/.test(text)) return 'Benchmark your stack against the claim before adopting vendor narratives.';
  if (/policy|regulation|government|compliance/.test(text)) return 'Check roadmap and customer messaging for compliance or procurement impact.';
  if (/funding|acquisition|valuation/.test(text)) return 'Watch for pricing pressure and distribution shifts across the market.';
  return 'Capture the implication in product planning and decide whether this changes build priorities.';
}

function deriveWhyItMatters(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (/model|gpt|claude|gemini/.test(text)) return 'Model capability shifts can immediately change what is viable to automate.';
  if (/security|attack|identity|iam/.test(text)) return 'Agent adoption is outpacing controls, which creates downside faster than most teams expect.';
  if (/framework|sdk|tool|workflow|terminal/.test(text)) return 'Builder tooling determines how quickly teams can turn model gains into production systems.';
  if (/policy|regulation|government/.test(text)) return 'Policy changes can alter enterprise demand and deployment constraints overnight.';
  return 'This is a live market signal, not just a headline.';
}

function scoreItem(item, now = Date.now()) {
  const ageHours = Math.max(1, (now - new Date(item.publishedAt).getTime()) / 3600000);
  const priority = item.priority ?? 3;
  const confidenceBonus = item.confidence === 'high' ? 1.25 : 1;
  const tagBonus = (item.tags || []).some((tag) => ['security', 'policy', 'builders', 'benchmark', 'research'].includes(tag)) ? 1.2 : 1;
  return (priority * 10 * confidenceBonus * tagBonus) / Math.pow(ageHours + 2, 0.45);
}

function formatTimestamp(value) {
  return new Date(value).toISOString().replace('.000Z', 'Z');
}

async function readJsonIfExists(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function loadRecipients(projectRoot) {
  const configPath = path.join(projectRoot, 'data', 'digest-recipients.json');
  const config = await readJsonIfExists(configPath, { to: [] });
  return Array.isArray(config.to) ? config.to : [];
}

export async function fetchFeedItems() {
  const items = [];

  for (const feed of FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'RareAgentWorkDigestBot/1.0 (+https://rareagent.work)' },
      });
      if (!response.ok) continue;
      const xml = await response.text();
      const entries = extractEntries(xml);

      for (const entry of entries) {
        const rawTitle = getTag(entry, 'title');
        const rawLink = getTag(entry, 'link') || getAtomLink(entry);
        const rawDescription = getTag(entry, 'description') || getTag(entry, 'summary') || getTag(entry, 'content');
        const rawDate = getTag(entry, 'pubDate') || getTag(entry, 'updated') || getTag(entry, 'published');

        const title = normalizeWhitespace(decodeEntities(stripHtml(rawTitle)));
        const url = normalizeWhitespace(decodeEntities(rawLink));
        const summary = normalizeWhitespace(decodeEntities(stripHtml(rawDescription))).slice(0, 420);
        const publishedAt = new Date(rawDate || Date.now()).toISOString();

        if (!title || !url) continue;

        items.push({
          id: crypto.createHash('sha1').update(url).digest('hex').slice(0, 16),
          title,
          url,
          summary: summary || `Latest update from ${feed.source}`,
          source: feed.source,
          category: feed.category,
          tags: inferTags(title, summary, feed.tags),
          publishedAt,
          fetchedAt: new Date().toISOString(),
          confidence: 'high',
          priority: feed.priority,
        });
      }
    } catch {
      // continue
    }
  }

  return items;
}

export async function loadNewsStore(projectRoot) {
  const storePath = path.join(projectRoot, 'data', 'news.json');
  const items = await readJsonIfExists(storePath, []);
  return Array.isArray(items) ? items : [];
}

export function dedupeItems(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.url || item.title;
    if (!key) continue;
    const normalized = {
      id: item.id || crypto.createHash('sha1').update(key).digest('hex').slice(0, 16),
      title: normalizeWhitespace(item.title || ''),
      url: item.url,
      summary: normalizeWhitespace(item.summary || ''),
      source: item.source || 'Unknown source',
      category: (item.category || 'industry-news').toLowerCase(),
      tags: inferTags(item.title || '', item.summary || '', item.tags || []),
      publishedAt: new Date(item.publishedAt || item.createdAt || Date.now()).toISOString(),
      createdAt: item.createdAt || item.fetchedAt || new Date().toISOString(),
      confidence: item.confidence || confidenceFor(item),
      priority: item.priority || 3,
    };

    const existing = seen.get(key);
    if (!existing || new Date(normalized.publishedAt).getTime() > new Date(existing.publishedAt).getTime()) {
      seen.set(key, normalized);
    }
  }
  return Array.from(seen.values());
}

export function selectWindowItems(items, windowHours = DEFAULT_WINDOW_HOURS, now = new Date()) {
  const cutoff = now.getTime() - windowHours * 3600000;
  return items
    .filter((item) => new Date(item.publishedAt).getTime() >= cutoff)
    .sort((a, b) => scoreItem(b, now.getTime()) - scoreItem(a, now.getTime()));
}

function takeByPredicate(items, predicate, limit) {
  return items.filter(predicate).slice(0, limit);
}

function summarizeBucket(items, fallback) {
  if (!items.length) return fallback;
  const tags = new Map();
  for (const item of items) {
    for (const tag of item.tags || []) {
      tags.set(tag, (tags.get(tag) || 0) + 1);
    }
  }
  const topTags = Array.from(tags.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag);
  return `${items.length} item${items.length === 1 ? '' : 's'} concentrated around ${topTags.join(', ') || 'general AI developments'}.`;
}

function buildTopStories(items) {
  return items.slice(0, 7).map((item, index) => ({
    rank: index + 1,
    title: item.title,
    source: item.source,
    url: item.url,
    timestamp: formatTimestamp(item.publishedAt),
    confidence: item.confidence,
    category: item.category,
    tags: item.tags,
    summary: item.summary,
    whyItMatters: deriveWhyItMatters(item),
    action: deriveAction(item),
  }));
}

function buildSignalVsNoise(items) {
  const signal = items.filter((item) => item.confidence === 'high').slice(0, 5);
  const noise = items.filter((item) => item.confidence !== 'high').slice(0, 3);
  return {
    signalSummary: summarizeBucket(signal, 'No high-confidence items in this window.'),
    noiseSummary: noise.length
      ? 'Community chatter exists, but it needs confirmation before it should drive roadmap decisions.'
      : 'Low-signal chatter stayed muted in this window.',
    signal,
    noise,
  };
}

function buildDeepDive(items) {
  const anchor = items.find((item) => ['security', 'policy', 'benchmark', 'research'].some((tag) => item.tags.includes(tag))) || items[0];
  if (!anchor) return null;
  return {
    title: anchor.title,
    source: anchor.source,
    url: anchor.url,
    timestamp: formatTimestamp(anchor.publishedAt),
    confidence: anchor.confidence,
    angle: anchor.tags.includes('security')
      ? 'The security surface of agents is expanding faster than control systems.'
      : anchor.tags.includes('policy')
        ? 'Policy and procurement signals increasingly determine deployment speed.'
        : anchor.tags.includes('benchmark') || anchor.tags.includes('research')
          ? 'Benchmarks are separating marketing narratives from operational reality.'
          : 'This item has the highest leverage for operator decision-making in the current window.',
    takeaway: `${deriveWhyItMatters(anchor)} ${deriveAction(anchor)}`,
  };
}

export function buildDigest(items, recipients, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const windowHours = Number(opts.windowHours || DEFAULT_WINDOW_HOURS);
  const windowItems = selectWindowItems(items, windowHours, now);
  const topStories = buildTopStories(windowItems);
  const builders = takeByPredicate(windowItems, (item) => item.tags.includes('builders') || item.tags.includes('open-source'), 4);
  const marketPolicy = takeByPredicate(windowItems, (item) => item.tags.includes('policy') || item.tags.includes('funding') || item.category.includes('industry'), 4);
  const tomorrowRadar = windowItems.slice(0, 5).map((item) => ({
    title: item.title,
    source: item.source,
    url: item.url,
    timestamp: formatTimestamp(item.publishedAt),
    confidence: item.confidence,
    watchFor: deriveAction(item),
  }));
  const signalVsNoise = buildSignalVsNoise(windowItems);
  const deepDive = buildDeepDive(windowItems);
  const topTags = Array.from(new Map(windowItems.flatMap((item) => item.tags.map((tag) => [tag, (windowItems.filter((candidate) => candidate.tags.includes(tag)).length)]))).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const tldr = topStories.length
    ? `Window: last ${windowHours}h. ${topStories.length} high-priority AI stories surfaced, led by ${topStories[0].title}. Dominant themes: ${topTags.join(', ')}.`
    : `Window: last ${windowHours}h. No qualifying AI stories found.`;

  return {
    digestId: crypto.createHash('sha1').update(`${now.toISOString()}-${windowHours}-${topStories.map((story) => story.url).join('|')}`).digest('hex').slice(0, 12),
    generatedAt: now.toISOString(),
    windowHours,
    recipientSeedList: recipients,
    storyCount: windowItems.length,
    sections: {
      tldr,
      topStories,
      signalVsNoise: {
        signalSummary: signalVsNoise.signalSummary,
        noiseSummary: signalVsNoise.noiseSummary,
        signal: signalVsNoise.signal.map((item) => ({ title: item.title, url: item.url, source: item.source, timestamp: formatTimestamp(item.publishedAt), confidence: item.confidence })),
        noise: signalVsNoise.noise.map((item) => ({ title: item.title, url: item.url, source: item.source, timestamp: formatTimestamp(item.publishedAt), confidence: item.confidence })),
      },
      buildersCorner: builders.map((item) => ({
        title: item.title,
        source: item.source,
        url: item.url,
        timestamp: formatTimestamp(item.publishedAt),
        confidence: item.confidence,
        takeaway: deriveAction(item),
      })),
      marketAndPolicy: marketPolicy.map((item) => ({
        title: item.title,
        source: item.source,
        url: item.url,
        timestamp: formatTimestamp(item.publishedAt),
        confidence: item.confidence,
        takeaway: deriveWhyItMatters(item),
      })),
      deepDive,
      tomorrowRadar,
    },
    sources: windowItems.map((item) => ({
      title: item.title,
      source: item.source,
      url: item.url,
      timestamp: formatTimestamp(item.publishedAt),
      confidence: item.confidence,
      category: item.category,
      tags: item.tags,
    })),
  };
}

export function renderDigestMarkdown(digest) {
  const lines = [];
  lines.push(`# Daily AI News Summary`);
  lines.push('');
  lines.push(`- Generated: ${digest.generatedAt}`);
  lines.push(`- Window: last ${digest.windowHours}h`);
  lines.push(`- Seed recipients: ${digest.recipientSeedList.join(', ')}`);
  lines.push(`- Story count: ${digest.storyCount}`);
  lines.push('');
  lines.push('## TL;DR');
  lines.push(digest.sections.tldr);
  lines.push('');
  lines.push('## Top stories');
  for (const story of digest.sections.topStories) {
    lines.push(`### ${story.rank}. ${story.title}`);
    lines.push(`- Source: ${story.source}`);
    lines.push(`- Timestamp: ${story.timestamp}`);
    lines.push(`- Confidence: ${story.confidence}`);
    lines.push(`- Link: ${story.url}`);
    lines.push(`- Why it matters: ${story.whyItMatters}`);
    lines.push(`- Action: ${story.action}`);
    lines.push(`- Summary: ${story.summary}`);
    lines.push('');
  }
  lines.push('## Signal vs Noise');
  lines.push(`- Signal: ${digest.sections.signalVsNoise.signalSummary}`);
  lines.push(`- Noise: ${digest.sections.signalVsNoise.noiseSummary}`);
  lines.push('');
  lines.push('## Builder’s Corner');
  for (const item of digest.sections.buildersCorner) {
    lines.push(`- ${item.title} (${item.source}) — ${item.takeaway} [${item.confidence}; ${item.timestamp}] ${item.url}`);
  }
  lines.push('');
  lines.push('## Market & Policy');
  for (const item of digest.sections.marketAndPolicy) {
    lines.push(`- ${item.title} (${item.source}) — ${item.takeaway} [${item.confidence}; ${item.timestamp}] ${item.url}`);
  }
  lines.push('');
  lines.push('## Deep dive');
  if (digest.sections.deepDive) {
    lines.push(`- ${digest.sections.deepDive.title} (${digest.sections.deepDive.source})`);
    lines.push(`- Angle: ${digest.sections.deepDive.angle}`);
    lines.push(`- Takeaway: ${digest.sections.deepDive.takeaway}`);
    lines.push(`- Confidence: ${digest.sections.deepDive.confidence}`);
    lines.push(`- Timestamp: ${digest.sections.deepDive.timestamp}`);
    lines.push(`- Link: ${digest.sections.deepDive.url}`);
  }
  lines.push('');
  lines.push('## Tomorrow radar');
  for (const item of digest.sections.tomorrowRadar) {
    lines.push(`- ${item.title} — watch for: ${item.watchFor} [${item.confidence}; ${item.timestamp}] ${item.url}`);
  }
  lines.push('');
  lines.push('## Source ledger');
  for (const item of digest.sources) {
    lines.push(`- ${item.title} | ${item.source} | ${item.timestamp} | ${item.confidence} | ${item.url}`);
  }
  lines.push('');
  return lines.join('\n');
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderDigestHtml(digest) {
  const storyHtml = digest.sections.topStories.map((story) => `
    <li style="margin-bottom:16px;">
      <strong>${escapeHtml(story.title)}</strong><br/>
      <span>${escapeHtml(story.source)} · ${escapeHtml(story.timestamp)} · ${escapeHtml(story.confidence)}</span><br/>
      <a href="${escapeHtml(story.url)}">${escapeHtml(story.url)}</a>
      <div><strong>Why it matters:</strong> ${escapeHtml(story.whyItMatters)}</div>
      <div><strong>Action:</strong> ${escapeHtml(story.action)}</div>
      <div>${escapeHtml(story.summary)}</div>
    </li>`).join('');

  const list = (items, key) => items.map((item) => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a> — ${escapeHtml(item[key])} <em>${escapeHtml(item.confidence)}</em> (${escapeHtml(item.timestamp)})</li>`).join('');

  const deepDive = digest.sections.deepDive
    ? `<p><strong>${escapeHtml(digest.sections.deepDive.title)}</strong><br/>${escapeHtml(digest.sections.deepDive.angle)}<br/>${escapeHtml(digest.sections.deepDive.takeaway)}<br/><a href="${escapeHtml(digest.sections.deepDive.url)}">${escapeHtml(digest.sections.deepDive.url)}</a></p>`
    : '<p>No deep dive item selected.</p>';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:780px;margin:0 auto;">
      <h1>Daily AI News Summary</h1>
      <p><strong>Generated:</strong> ${escapeHtml(digest.generatedAt)}<br/>
      <strong>Window:</strong> last ${digest.windowHours}h<br/>
      <strong>Story count:</strong> ${digest.storyCount}<br/>
      <strong>Seed recipients:</strong> ${escapeHtml(digest.recipientSeedList.join(', '))}</p>
      <h2>TL;DR</h2>
      <p>${escapeHtml(digest.sections.tldr)}</p>
      <h2>Top stories</h2>
      <ol>${storyHtml}</ol>
      <h2>Signal vs Noise</h2>
      <p><strong>Signal:</strong> ${escapeHtml(digest.sections.signalVsNoise.signalSummary)}<br/>
      <strong>Noise:</strong> ${escapeHtml(digest.sections.signalVsNoise.noiseSummary)}</p>
      <h2>Builder’s Corner</h2>
      <ul>${list(digest.sections.buildersCorner, 'takeaway')}</ul>
      <h2>Market &amp; Policy</h2>
      <ul>${list(digest.sections.marketAndPolicy, 'takeaway')}</ul>
      <h2>Deep dive</h2>
      ${deepDive}
      <h2>Tomorrow radar</h2>
      <ul>${list(digest.sections.tomorrowRadar, 'watchFor')}</ul>
    </div>`;
}

export async function writeDigestArtifacts(projectRoot, digest) {
  const dir = path.join(projectRoot, 'data', 'digests');
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, 'latest.json');
  const markdownPath = path.join(dir, 'latest.md');
  await writeFile(jsonPath, JSON.stringify(digest, null, 2));
  await writeFile(markdownPath, renderDigestMarkdown(digest));
  return { dir, jsonPath, markdownPath };
}

export async function sendDigestEmail({ resendApiKey, from, to, subject, digest }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: renderDigestMarkdown(digest),
      html: renderDigestHtml(digest),
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Resend failed (${response.status}): ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function runDigestPipeline(projectRoot, opts = {}) {
  const recipients = await loadRecipients(projectRoot);
  const storeItems = await loadNewsStore(projectRoot);
  const feedItems = await fetchFeedItems();
  const items = dedupeItems([...storeItems, ...feedItems]);
  const digest = buildDigest(items, recipients, opts);
  const artifacts = await writeDigestArtifacts(projectRoot, digest);
  return { digest, artifacts, itemsFetched: feedItems.length, storeItems: storeItems.length };
}
