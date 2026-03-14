import { NextRequest, NextResponse } from 'next/server';
import { consultingSchema, validateRequest } from '@/lib/api-validation';

export const runtime = 'nodejs';

const DESTINATION_EMAIL = 'Michael.fethe@protelynx.ai';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  const validation = await validateRequest(req, consultingSchema);
  if (!validation.success) return validation.response;

  const { name, email, company, useCase, budget, timeline } = validation.data;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: 'Consulting intake is temporarily unavailable. Please email hello@rareagent.work directly.' },
      { status: 503 },
    );
  }

  const subject = `Rare Agent Work consulting request from ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company}`,
    `Budget: ${budget}`,
    `Timeline: ${timeline}`,
    '',
    'Project details:',
    useCase,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Rare Agent Work consulting request</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      <p><strong>Budget:</strong> ${escapeHtml(budget)}</p>
      <p><strong>Timeline:</strong> ${escapeHtml(timeline)}</p>
      <p><strong>Project details:</strong></p>
      <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(useCase)}</pre>
    </div>
  `;

  const from = process.env.CONSULTING_FROM_EMAIL || 'Rare Agent Work <hello@rareagent.work>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [DESTINATION_EMAIL],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('[Consulting] Resend API error:', response.status, details.slice(0, 500));
    return NextResponse.json({ error: 'Unable to send your request right now. Please try again or email hello@rareagent.work directly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
