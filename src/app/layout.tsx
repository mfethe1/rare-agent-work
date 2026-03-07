import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "G-7SLM9KDWZK";
const GADS_ID = "AW-17716841198";

export const metadata: Metadata = {
  title: {
    default: "Rare Agent Work — Operator-Grade AI Research",
    template: "%s | Rare Agent Work",
  },
  description:
    "Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards. Operator playbooks with real implementation detail.",
  metadataBase: new URL("https://rareagent.work"),
  openGraph: {
    title: "Rare Agent Work — Operator-Grade AI Research",
    description:
      "Practical reports on low-code automation, multi-agent systems, and empirical deployment standards. Not tutorials — operator playbooks.",
    url: "https://rareagent.work",
    siteName: "Rare Agent Work",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rare Agent Work — Operator-Grade AI Research",
    description:
      "Operator playbooks for AI automation, multi-agent orchestration, and production deployment.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://rareagent.work",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}

        {/* Google Ads tag */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-gtag" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GADS_ID}');`}
        </Script>

        {/* GA4 — only if ID is configured */}
        {GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-gtag" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA4_ID}', { send_page_view: true });`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
