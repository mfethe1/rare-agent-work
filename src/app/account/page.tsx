export const dynamic = "force-dynamic";
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ConversionTracker from '@/components/ConversionTracker';

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'text-gray-400' },
  starter: { label: 'Starter', color: 'text-blue-400' },
  pro: { label: 'Pro', color: 'text-purple-400' },
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirect=/account');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier ?? 'free';
  const tierInfo = TIER_LABELS[tier] ?? TIER_LABELS.free;
  const tokensUsed = profile?.tokens_used ?? 0;
  const tokensBudget = profile?.tokens_budget ?? 0;
  const usagePct = tokensBudget > 0 ? Math.min(100, (tokensUsed / tokensBudget) * 100) : 0;

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="text-xl font-bold tracking-tighter text-white">
            Rare Agent Work
          </a>
          <form action="/auth/signout" method="post">
            <button className="text-gray-400 hover:text-white text-sm transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <ConversionTracker kind="subscription" plan={tier} value={tier === 'pro' ? 49 : tier === 'starter' ? 10 : 0} />
        <h1 className="text-3xl font-bold text-white mb-8">Your Account</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-white">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Plan</span>
                <span className={`font-semibold ${tierInfo.color}`}>{tierInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Usage card */}
          {tier !== 'free' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Token Usage</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Used this month</span>
                  <span className="text-white font-mono">{tokensUsed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly budget</span>
                  <span className="text-white font-mono">{tokensBudget.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{usagePct.toFixed(1)}% of budget used</p>
              </div>
            </div>
          )}

          {/* Upgrade prompt for free users */}
          {tier === 'free' && (
            <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Upgrade Your Plan</h2>
              <p className="text-gray-400 text-sm mb-4">
                Get live newsletter updates for $10/mo, with full Operator Access ($49/mo) for all reports and AI guide + token usage.
              </p>
              <a
                href="/pricing"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                View plans →
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
