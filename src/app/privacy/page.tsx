import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import SiteNav from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Rare Agent Work collects, uses, stores, and protects your personal data. Covers analytics, payments, cookies, and your rights under GDPR and CCPA.',
  alternates: {
    canonical: 'https://rareagent.work/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | Rare Agent Work',
    description:
      'How Rare Agent Work collects, uses, stores, and protects your personal data.',
    url: 'https://rareagent.work/privacy',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Rare Agent Work Privacy Policy' }],
  },
};

const EFFECTIVE_DATE = 'March 14, 2026';

const sections = [
  {
    title: '1. Information we collect',
    content: [
      '<strong>Account data.</strong> When you create an account we collect your email address and, if you choose password-based authentication, a hashed password managed by Supabase Auth. We never store plaintext passwords.',
      '<strong>Payment data.</strong> Purchases and subscriptions are processed by <a href="https://stripe.com/privacy" class="text-cyan-300 hover:text-cyan-200 underline" target="_blank" rel="noopener noreferrer">Stripe</a>. We receive your name, email, and the last four digits of your card. We never see or store full card numbers.',
      '<strong>Usage data.</strong> We collect aggregated analytics through Google Analytics 4 (GA4) and Google Ads conversion tags. This includes page views, referral source, device type, and approximate geographic region. IP addresses are anonymized by Google before storage.',
      '<strong>Form submissions.</strong> Assessment, consulting intake, and work-submission forms collect the information you provide (project description, contact details, constraints). These are stored in our database and reviewed by a human.',
      '<strong>API usage.</strong> If you generate API keys, we log request counts, endpoints accessed, and timestamps for rate-limiting and abuse prevention. We do not log request or response bodies.',
      '<strong>Cookies.</strong> We use strictly necessary cookies for authentication sessions and functional cookies for analytics. See our cookie details in Section 5.',
    ],
  },
  {
    title: '2. How we use your information',
    content: [
      'Provide, maintain, and improve our services (reports, news, AI chat, consulting intake).',
      'Process payments and manage subscriptions.',
      'Respond to consulting requests and route them to appropriate review paths.',
      'Send transactional emails (purchase confirmations, password resets). We do not send unsolicited marketing emails unless you subscribe to a newsletter.',
      'Monitor for abuse, enforce rate limits, and maintain platform security.',
      'Analyze aggregated usage patterns to improve content and product decisions. We do not sell your personal data to third parties.',
    ],
  },
  {
    title: '3. Data sharing',
    content: [
      '<strong>Service providers.</strong> We share data only with processors that are necessary to operate the service: Supabase (authentication and database), Stripe (payments), Google (analytics), Upstash (rate limiting), and Railway (hosting). Each operates under their own privacy policy and data processing agreements.',
      '<strong>Legal requirements.</strong> We may disclose information if required by law, subpoena, or court order, or to protect the rights, safety, or property of Rare Agent Work or others.',
      '<strong>Business transfers.</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction. We will notify you via email or prominent notice on our site.',
      'We do not sell, rent, or trade your personal information to advertisers or data brokers.',
    ],
  },
  {
    title: '4. Data retention',
    content: [
      'Account data is retained for as long as your account is active. You may request deletion at any time (see Section 7).',
      'Payment records are retained for 7 years to comply with tax and financial reporting obligations.',
      'Form submissions (consulting intake, assessments) are retained for up to 2 years after the last interaction, then anonymized or deleted.',
      'Analytics data is retained according to Google Analytics default retention settings (14 months) and is not linked to your account identity.',
      'API usage logs are retained for 90 days.',
    ],
  },
  {
    title: '5. Cookies and tracking',
    content: [
      '<strong>Strictly necessary.</strong> Authentication session cookies managed by Supabase. These cannot be disabled without breaking login functionality.',
      '<strong>Analytics.</strong> Google Analytics 4 (_ga, _ga_*) measures site usage in aggregate. Google Ads (conversion linker) tracks ad effectiveness. These cookies are set only after page load via afterInteractive scripts.',
      '<strong>No third-party advertising cookies.</strong> We do not serve display ads or use retargeting cookies beyond Google Ads conversion measurement.',
      'You can manage cookie preferences through your browser settings. Blocking analytics cookies will not affect core site functionality.',
    ],
  },
  {
    title: '6. Security',
    content: [
      'All data is transmitted over HTTPS with HSTS preloading enforced.',
      'API keys are generated using cryptographically secure random bytes (Web Crypto API) and stored as SHA-256 hashes. Plaintext keys are shown once at creation and never stored.',
      'Security headers (CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff) are enforced at the edge middleware layer.',
      'Rate limiting is enforced via Redis-backed middleware to prevent abuse.',
      'Internal service endpoints require separate authentication keys and are not exposed to public clients.',
    ],
  },
  {
    title: '7. Your rights',
    content: [
      '<strong>Access and portability.</strong> You can request a copy of all personal data we hold about you.',
      '<strong>Correction.</strong> You can request correction of inaccurate data.',
      '<strong>Deletion.</strong> You can request deletion of your account and associated data. We will comply within 30 days, except where retention is required by law (e.g., payment records).',
      '<strong>Opt-out of analytics.</strong> You can install the <a href="https://tools.google.com/dlpage/gaoptout" class="text-cyan-300 hover:text-cyan-200 underline" target="_blank" rel="noopener noreferrer">Google Analytics opt-out browser add-on</a> or block analytics cookies via browser settings.',
      '<strong>GDPR (EEA residents).</strong> You have the right to access, rectify, erase, restrict processing, object to processing, and data portability under the General Data Protection Regulation. Our lawful bases for processing are: contract performance (account services), legitimate interest (analytics, security), and consent (newsletters).',
      '<strong>CCPA (California residents).</strong> You have the right to know what personal information we collect, request deletion, and opt out of the sale of personal information. We do not sell personal information. To exercise your rights, contact us at the address below.',
      'To exercise any of these rights, email <a href="mailto:privacy@rareagent.work" class="text-cyan-300 hover:text-cyan-200 underline">privacy@rareagent.work</a> or <a href="mailto:hello@rareagent.work" class="text-cyan-300 hover:text-cyan-200 underline">hello@rareagent.work</a>.',
    ],
  },
  {
    title: '8. Children',
    content: [
      'Rare Agent Work is not directed at children under 16. We do not knowingly collect personal data from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.',
    ],
  },
  {
    title: '9. Changes to this policy',
    content: [
      'We may update this Privacy Policy from time to time. Material changes will be communicated via a notice on the site or by email to registered users. The "Effective date" at the top of this page reflects the latest revision.',
    ],
  },
  {
    title: '10. Contact',
    content: [
      'For privacy-related questions or requests: <a href="mailto:privacy@rareagent.work" class="text-cyan-300 hover:text-cyan-200 underline">privacy@rareagent.work</a>',
      'General inquiries: <a href="mailto:hello@rareagent.work" class="text-cyan-300 hover:text-cyan-200 underline">hello@rareagent.work</a>',
      'Rare Agent Work is operated by Michael Fethe.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <SiteNav primaryCta={{ label: 'Browse Reports', href: '/reports' }} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Privacy Policy', url: 'https://rareagent.work/privacy' },
        ]}
      />

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Legal</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-slate-400">Effective date: {EFFECTIVE_DATE}</p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Rare Agent Work respects your privacy and is committed to protecting your personal data. This policy
            explains what we collect, why, how we protect it, and what rights you have.
          </p>
        </section>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                {section.content.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-cyan-300">•</span>
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Related</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/terms"
              className="inline-flex rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Terms of Service
            </Link>
            <Link
              href="/trust"
              className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5"
            >
              Trust Controls
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
