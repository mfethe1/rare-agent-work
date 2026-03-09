import { Report, getAllReports } from '@/lib/reports';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://rareagent.work';
const BRAND_NAME = 'Rare Agent Work';
const BRAND_TAGLINE = 'Operator-grade intelligence for teams building with AI agents';
const LOGO_URL = `${SITE_URL}/logo-medallion.jpg`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderList(items: string[], accent: string) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:0 0 10px 0; vertical-align:top; color:${accent}; font-weight:700; width:18px;">•</td>
          <td style="padding:0 0 10px 0; color:#d7dce5; font-size:15px; line-height:1.6;">${escapeHtml(item)}</td>
        </tr>
      `,
    )
    .join('');
}

function renderCitations(report: Report) {
  return report.citations
    .map(
      (citation) => `
        <li style="margin:0 0 10px 0; color:#c1c8d6; line-height:1.5;">
          <strong style="color:#ffffff;">${escapeHtml(citation.label)}</strong><br />
          <a href="${escapeHtml(citation.url)}" style="color:#8bd3ff; text-decoration:none;">${escapeHtml(citation.url)}</a><br />
          <span style="color:#7b8494; font-size:12px;">Accessed ${escapeHtml(citation.accessedAt)}</span>
        </li>
      `,
    )
    .join('');
}

export function getReviewSendPayload() {
  return getAllReports().map((report) => ({
    slug: report.slug,
    subject: `${BRAND_NAME} review packet: ${report.title} (${report.revision})`,
    html: renderReportReviewEmail(report),
    text: renderReportReviewText(report),
  }));
}

export function renderReportReviewText(report: Report) {
  const lines = [
    `${BRAND_NAME}`,
    `${report.title}`,
    `${report.subtitle}`,
    '',
    `Audience: ${report.audience}`,
    `Edition: ${report.edition}`,
    `Revision: ${report.revision}`,
    `Last updated: ${report.updatedAt}`,
    `Freshness timestamp: ${report.freshnessTimestamp}`,
    '',
    'Executive summary:',
    report.executiveSummary,
    '',
    'Action steps:',
    ...report.actionSteps.map((item) => `- ${item}`),
    '',
    'Risks / failure modes:',
    ...report.risks.map((item) => `- ${item}`),
    '',
    'Review link:',
    `${SITE_URL}/reports/${report.slug}`,
  ];

  return lines.join('\n');
}

export function renderReportReviewEmail(report: Report) {
  const reviewUrl = `${SITE_URL}/reports/${report.slug}`;
  const accent = report.emailAccent || '#3b82f6';
  const deliverables = report.deliverables
    .map(
      (item) => `
        <div style="padding:16px 0; border-top:1px solid #1f2937;">
          <div style="font-size:15px; font-weight:700; color:#ffffff; margin-bottom:6px;">${escapeHtml(item.icon)} ${escapeHtml(item.title)}</div>
          <div style="font-size:14px; line-height:1.6; color:#c1c8d6;">${escapeHtml(item.desc)}</div>
        </div>
      `,
    )
    .join('');

  return `
  <div style="margin:0; padding:24px 0; background:#0b1020; font-family:Inter, Arial, sans-serif; color:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px; margin:0 auto; background:#101827; border:1px solid #1f2937; border-radius:20px; overflow:hidden;">
      <tr>
        <td style="padding:22px 28px; border-bottom:1px solid #1f2937; background:linear-gradient(135deg, #0f172a 0%, #111827 55%, #1d4ed8 130%);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align:middle;">
                <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="56" height="56" style="display:block; border-radius:999px; border:1px solid rgba(255,255,255,0.14);" />
              </td>
              <td style="padding-left:16px; vertical-align:middle;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#93c5fd; font-weight:700;">Subscriber review packet</div>
                <div style="font-size:26px; font-weight:800; color:#ffffff; margin-top:6px;">${escapeHtml(report.title)}</div>
                <div style="font-size:14px; color:#cbd5e1; margin-top:6px;">${escapeHtml(report.subtitle)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 28px 8px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:0 0 10px 0;">
                <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700;">Letterhead</div>
                <div style="font-size:18px; font-weight:700; color:#ffffff; margin-top:8px;">${BRAND_NAME}</div>
                <div style="font-size:14px; color:#94a3b8; margin-top:4px;">${BRAND_TAGLINE}</div>
              </td>
              <td style="text-align:right; padding:0 0 10px 18px;">
                <div style="display:inline-block; padding:7px 12px; border-radius:999px; background:rgba(255,255,255,0.06); color:#e5e7eb; font-size:12px; font-weight:700;">${escapeHtml(report.revision)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 28px 8px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1220; border:1px solid #1f2937; border-radius:16px;">
            <tr>
              <td style="padding:16px 18px; font-size:13px; color:#cbd5e1; line-height:1.7;">
                <strong style="color:#ffffff;">Edition:</strong> ${escapeHtml(report.edition)}<br />
                <strong style="color:#ffffff;">Audience:</strong> ${escapeHtml(report.audience)}<br />
                <strong style="color:#ffffff;">Last updated:</strong> ${escapeHtml(report.updatedAt)}<br />
                <strong style="color:#ffffff;">Freshness timestamp:</strong> ${escapeHtml(report.freshnessTimestamp)}<br />
                <strong style="color:#ffffff;">Price point:</strong> ${escapeHtml(report.price)} ${escapeHtml(report.priceLabel)}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Executive summary</div>
          <div style="font-size:16px; line-height:1.7; color:#dbe3ee;">${escapeHtml(report.executiveSummary)}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Action steps</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderList(report.actionSteps, accent)}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Risks / failure modes</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderList(report.risks, '#fca5a5')}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Deliverables included</div>
          <div style="background:#0b1220; border:1px solid #1f2937; border-radius:16px; padding:0 18px;">${deliverables}</div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 28px 8px 28px;">
          <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#7dd3fc; font-weight:700; margin-bottom:10px;">Evidence and citations</div>
          <ol style="padding-left:18px; margin:0;">${renderCitations(report)}</ol>
        </td>
      </tr>

      <tr>
        <td style="padding:26px 28px 32px 28px; text-align:center;">
          <a href="${reviewUrl}" style="display:inline-block; background:${accent}; color:#ffffff; text-decoration:none; font-weight:700; padding:14px 22px; border-radius:999px;">Open web preview</a>
          <div style="font-size:12px; color:#7b8494; margin-top:14px;">Prepared for internal review before subscriber rollout.</div>
        </td>
      </tr>
    </table>
  </div>`;
}
