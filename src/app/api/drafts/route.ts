import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: list all drafts (pending first)
export async function GET() {
  const supabase = getAdmin();
  const { data, error } = await supabase
    .from('report_drafts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: create new draft (from agents)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('x-service-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || (authHeader !== `Bearer ${serviceKey}` && authHeader !== serviceKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { slug, title, content, version, changes_summary, created_by } = body;

  if (!slug || !title || !content) {
    return NextResponse.json({ error: 'slug, title, content required' }, { status: 400 });
  }

  const supabase = getAdmin();
  const { data, error } = await supabase
    .from('report_drafts')
    .insert({
      slug,
      title,
      content,
      version: version || 'v1.0',
      changes_summary: changes_summary || null,
      created_by: created_by || 'agent',
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: approve or reject a draft (owner only)
export async function PATCH(request: NextRequest) {
  // Verify the caller is the site owner via Supabase auth
  const { createServerClient } = await import('@supabase/ssr');
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) cookies[k] = v.join('=');
  });

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(cookies).map(([name, value]) => ({ name, value }));
        },
        setAll() { /* noop for reads */ },
      },
    }
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user || user.email !== 'michael.fethe@protelynx.ai') {
    return NextResponse.json({ error: 'Owner access only' }, { status: 403 });
  }

  const body = await request.json();
  const { id, status, reviewer_notes } = body;

  if (!id || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'id and status (approved|rejected) required' }, { status: 400 });
  }

  const supabase = getAdmin();
  const { data, error } = await supabase
    .from('report_drafts')
    .update({
      status,
      reviewer_notes: reviewer_notes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
