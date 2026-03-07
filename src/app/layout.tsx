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
  title: "Rare Agent Work",
  description:
    "Practical, deeply researched reports on low-code automation, multi-agent systems, and empirical deployment standards. Operator playbooks with real implementation detail.",
  metadataBase: new URL("https://rareagent.work"),
  openGraph: {
    title: "Rare Agent Work",
    description:
      "Operator-grade AI research you can actually use. Reports on agent setup, multi-agent orchestration, and production evaluation.",
    url: "https://rareagent.work",
    siteName: "Rare Agent Work",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rare Agent Work",
    description:
      "Operator-grade AI research you can actually use. Reports on agent setup, multi-agent orchestration, and production evaluation.",
  },
};

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-7SLM9KDWZK";

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
        {/* Google Analytics 4 */}
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-gtag" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA4_ID}');`}
          </Script>
        </>
        {/* Google Ads conversion tracking */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17716841198"
          strategy="afterInteractive"
        />
        <Script id="google-ads-gtag" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'AW-17716841198');`}
        </Script>
      </body>
    </html>
  );
}
