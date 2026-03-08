import { NextRequest, NextResponse } from 'next/server';

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
  let body: {
    name?: string;
    email?: string;
    company?: string;
    useCase?: string;
    budget?: string;
    timeline?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = body.name?.trim() || '';
  const email = body.email?.trim() || '';
  const company = body.company?.trim() || 'Not provided';
  const useCase = body.useCase?.trim() || '';
  const budget = body.budget?.trim() || 'Not provided';
  const timeline = body.timeline?.trim() || 'Not provided';

  if (!name || !email || !useCase) {
    return NextResponse.json({ error: 'Name, email, and project details are required.' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: 'Consulting email is not configured yet. Add RESEND_API_KEY in production.' },
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
    return NextResponse.json({ error: 'Email send failed.', details: details.slice(0, 500) }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
