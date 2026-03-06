import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL ?? 'https://rareagent.work'));
}
