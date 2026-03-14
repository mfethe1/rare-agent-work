import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DESTINATION_EMAIL = 'Michael.fethe@protelynx.ai';
const allowedRequestTypes = new Set([
  'Architecture Review',
  'Implementation Rescue',
  'Curated Specialist Match',
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const requestType = String(body.requestType || '').trim();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const company = String(body.company || '').trim() || 'Not provided';
  const projectTitle = String(body.projectTitle || '').trim();
  const currentState = String(body.currentState || '').trim();
  const desiredOutcome = String(body.desiredOutcome || '').trim();
  const constraints = String(body.constraints || '').trim() || 'Not provided';
  const timeline = String(body.timeline || '').trim() || 'Not provided';
  const budgetBand = String(body.budgetBand || '').trim() || 'Not provided';
  const sensitivity = String(body.sensitivity || '').trim() || 'Not provided';
  const links = String(body.links || '').trim() || 'Not provided';
  const website = String(body.website || '').trim();
  const confirmsNoCredentials = body.confirmsNoCredentials === true;
  const confirmsHumanReview = body.confirmsHumanReview === true;
  const confirmsNoAutoExecution = body.confirmsNoAutoExecution === true;
  const agreesRetention = body.agreesRetention === true;

  if (website) {
    return NextResponse.json({ error: 'Spam detected.' }, { status: 400 });
  }

  if (!allowedRequestTypes.has(requestType)) {
    return NextResponse.json({ error: 'Invalid request type.' }, { status: 400 });
  }

  if (!name || !email || !projectTitle || !currentState || !desiredOutcome) {
    return NextResponse.json({ error: 'Request type, name, email, project title, current state, and desired outcome are required.' }, { status: 400 });
  }

  if (!confirmsNoCredentials || !confirmsHumanReview || !confirmsNoAutoExecution || !agreesRetention) {
    return NextResponse.json({ error: 'All trust and consent confirmations are required.' }, { status: 400 });
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
