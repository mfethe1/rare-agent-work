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
  title: "Rare Agent Work — Operator-Grade AI Agent Research",
  description:
    "Practical, deeply researched reports on multi-agent systems, low-code automation, and production deployment. Operator playbooks with real implementation detail, not tutorials.",
  keywords: ["AI agents", "multi-agent systems", "LLM automation", "agent architecture", "operator playbooks", "AI deployment"],
  openGraph: {
    title: "Rare Agent Work — Operator-Grade AI Agent Research",
    description: "Practical, deeply researched reports on multi-agent systems and production AI deployment. Operator playbooks with real implementation detail.",
    url: "https://rareagent.work",
    siteName: "Rare Agent Work",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rare Agent Work — Operator-Grade AI Agent Research",
    description: "Practical, deeply researched reports on multi-agent systems and production AI deployment.",
  },
  robots: {
    index: true,
    follow: true,
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17716841198"
          strategy="afterInteractive"
        />
        <Script id="google-ads-gtag" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-17716841198');
${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ? `gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}');` : ''}`}
        </Script>
      </body>
    </html>
  );
}
