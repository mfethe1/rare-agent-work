import Link from "next/link";
import BuyButton from "@/components/BuyButton";

const plans = [
  {
    id: "newsletter",
    title: "Newsletter",
    price: "$10/mo",
    blurb: "Premium AI agent news drops and alerts for people tracking the fast-changing space.",
    features: ["Daily operator summaries", "Priority signal alerts", "No paywall on news pages"],
  },
  {
    id: "starter",
    title: "Starter",
    price: "$29/mo",
    blurb: "All reports + AI guide + rolling updates every 3 days.",
    features: ["Full access to all reports", "AI implementation guide", "Rolling report updates"],
  },
  {
    id: "pro",
    title: "Operator Access",
    price: "$49/mo",
    blurb: "Everything in Starter, plus bigger token budget and faster support for urgent work.",
    features: ["Higher AI token budget", "Priority research updates", "Best support path for operators"],
  },
];

export const metadata = {
  title: "Pricing | Rare Agent Work",
  description: "Compare plans for Rare Agent Work access, from newsletter to operator plans.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-gray-800 bg-black/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-bold tracking-tight">
            Rare Agent Work
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/news" className="text-gray-300 hover:text-white">News Feed</Link>
            <Link href="/digest" className="text-gray-300 hover:text-white">Weekly Digest</Link>
            <Link href="/reports" className="text-gray-300 hover:text-white">Reports</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <header className="mb-12">
          <h1 className="text-3xl font-semibold sm:text-4xl">Plan options</h1>
          <p className="mt-3 text-slate-300">Choose the level of access that matches your execution bandwidth.</p>
        </header>

        <section className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-300"
            >
              <div className="mb-4 flex items-start justify-between">
                <p className="text-sm uppercase tracking-[0.2em] text-blue-300">{plan.title}</p>
                <p className="text-lg font-semibold text-white">{plan.price}</p>
              </div>
              <p className="mb-4 text-gray-400">{plan.blurb}</p>

              <ul className="mb-6 space-y-2 text-sm text-gray-300">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <BuyButton
                plan={plan.id}
                label={`Choose ${plan.title}`}
                className="rounded-lg border border-gray-700 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
              />
            </div>
          ))}
        </section>

        <p className="mt-8 text-xs text-gray-500">
          Billing changes are handled at checkout. Need help choosing? Visit
          <Link href="/assessment" className="ml-1 underline text-gray-300">Assessment</Link>.
        </p>
      </main>
    </div>
  );
}
