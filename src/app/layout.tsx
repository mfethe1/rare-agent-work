import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import AdsRemarketing from "@/components/AdsRemarketing";
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
    title: "Rare Agent Work — Operator-Grade AI Agent Research",
    description:
      "Production-tested playbooks for AI agent setup, multi-agent orchestration, and deployment evaluation. Not tutorials — operator playbooks built from real implementations.",
    url: "https://rareagent.work",
    siteName: "Rare Agent Work",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Rare Agent Work — Operator-Grade AI Research",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rare Agent Work — Operator-Grade AI Agent Research",
    description:
      "Production-tested playbooks for AI agent setup, multi-agent orchestration, and deployment evaluation.",
    images: ["/og-image.png"],
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
  icons: {
    icon: "/logo-seal-bw.jpg",
    apple: "/logo-badge-color.jpg",
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
        <AdsRemarketing />
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
