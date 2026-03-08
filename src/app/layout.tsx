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

export const metadata: Metadata = {
  title: {
    default: "Rare Agent Work — Operator-Grade AI Research",
    template: "%s | Rare Agent Work",
  },
  description:
    "Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards. Operator playbooks with real implementation detail.",
  metadataBase: new URL("https://rareagent.work"),
  keywords: [
    "agentic systems",
    "AI agent architecture",
    "multi-agent orchestration",
    "production AI deployment",
    "agent reliability engineering",
    "LLM agent framework",
    "operator playbook",
    "AI automation",
    "tool use benchmark",
    "agent evaluation",
  ],
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
    types: {
      "application/rss+xml": "https://rareagent.work/feed.xml",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Rare Agent Work — AI Agent News"
          href="https://rareagent.work/feed.xml"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* Google Analytics 4 + Google Ads — single gtag.js load */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7SLM9KDWZK"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-7SLM9KDWZK');
gtag('config', 'AW-17716841198');`}
        </Script>
      </body>
    </html>
  );
}
