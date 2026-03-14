import { NextRequest, NextResponse } from 'next/server';
import { submitWorkSchema, validateRequest } from '@/lib/api-validation';

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
  const validation = await validateRequest(req, submitWorkSchema);
  if (!validation.success) return validation.response;

  const {
    requestType, name, email, company, projectTitle,
    currentState, desiredOutcome, constraints, timeline,
    budgetBand, sensitivity, links, website,
  } = validation.data;

  // Honeypot field — bots fill this in, humans don't
  if (website) {
    return NextResponse.json({ error: 'Spam detected.' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: 'Work submission is temporarily unavailable. Please email hello@rareagent.work directly.' },
      { status: 503 },
    );
  }

  const subject = `Rare Agent Work submit-work request: ${projectTitle}`;
  const text = [
    `Request Type: ${requestType}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company}`,
    `Timeline: ${timeline}`,
    `Budget Band: ${budgetBand}`,
    `Sensitivity: ${sensitivity}`,
    `Links: ${links}`,
    '',
    'Current State:',
    currentState,
    '',
    'Desired Outcome:',
    desiredOutcome,
    '',
    'Constraints / Artifacts:',
    constraints,
    '',
    'Trust confirmations:',
    '- No credentials included',
    '- Human review required',
    '- No autonomous execution against client systems',
    '- 90 day retention accepted',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Rare Agent Work submit-work request</h2>
      <p><strong>Request Type:</strong> ${escapeHtml(requestType)}</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      <p><strong>Project Title:</strong> ${escapeHtml(projectTitle)}</p>
      <p><strong>Timeline:</strong> ${escapeHtml(timeline)}</p>
      <p><strong>Budget Band:</strong> ${escapeHtml(budgetBand)}</p>
      <p><strong>Sensitivity:</strong> ${escapeHtml(sensitivity)}</p>
      <p><strong>Links:</strong> ${escapeHtml(links)}</p>
      <p><strong>Current State:</strong></p>
      <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(currentState)}</pre>
      <p><strong>Desired Outcome:</strong></p>
      <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(desiredOutcome)}</pre>
      <p><strong>Constraints / Artifacts:</strong></p>
      <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(constraints)}</pre>
      <p><strong>Trust confirmations:</strong> no credential intake, human review required, no autonomous execution, 90-day retention accepted.</p>
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
    console.error('[SubmitWork] Resend API error:', response.status, details.slice(0, 500));
    return NextResponse.json({ error: 'Unable to send your request right now. Please try again or email hello@rareagent.work directly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
