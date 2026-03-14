import { ImageResponse } from 'next/og';
import { getReport, getAllReports } from '@/lib/reports';

export const runtime = 'nodejs';

// Required for static params generation
export function generateStaticParams() {
  return getAllReports().map((r) => ({ slug: r.slug }));
}

export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Rare Agent Work report';

// Color palettes per accent color
const PALETTES: Record<string, { border: string; accent: string; bg: string; glow: string; price: string }> = {
  blue:   { border: '#3b82f6', accent: '#60a5fa', bg: '#0f172a', glow: '#1e3a5f', price: '#3b82f6' },
  green:  { border: '#22c55e', accent: '#4ade80', bg: '#0f1f0f', glow: '#14391f', price: '#22c55e' },
  purple: { border: '#a855f7', accent: '#c084fc', bg: '#1a0f2e', glow: '#2d1b4e', price: '#a855f7' },
  red:    { border: '#ef4444', accent: '#f87171', bg: '#1f0a0a', glow: '#3d1414', price: '#ef4444' },
  amber:  { border: '#f59e0b', accent: '#fbbf24', bg: '#1f1400', glow: '#3d2800', price: '#f59e0b' },
};

export default function Image({ params }: { params: { slug: string } }) {
  const report = getReport(params.slug);

  // Fallback for unknown slugs
  if (!report) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: '#050816',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: 32 }}>Rare Agent Work</span>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const palette = PALETTES[report.color] ?? PALETTES.blue;

  // Truncate long strings for layout safety
  const title = report.title.length > 60 ? report.title.slice(0, 57) + '…' : report.title;
  const subtitle = report.subtitle.length > 80 ? report.subtitle.slice(0, 77) + '…' : report.subtitle;
  const insight = report.sharpestInsight.length > 160
    ? report.sharpestInsight.slice(0, 157) + '…'
    : report.sharpestInsight;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: palette.bg,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 600,
            height: 600,
            background: palette.glow,
            borderRadius: '50%',
            filter: 'blur(80px)',
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            width: '100%',
            height: 4,
            background: `linear-gradient(90deg, ${palette.border} 0%, transparent 70%)`,
          }}
        />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '48px 60px',
            gap: 0,
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 32,
            }}
          >
            {/* Brand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: palette.border,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#fff',
                }}
              >
                R
              </div>
              <span
                style={{
                  color: '#94a3b8',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Rare Agent Work
              </span>
            </div>

            {/* Price badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${palette.border}`,
                borderRadius: 999,
                padding: '6px 16px',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: palette.accent,
                }}
              />
              <span
                style={{
                  color: palette.accent,
                  fontSize: 16,
                  fontWeight: 800,
                }}
              >
                {report.price}
              </span>
              <span
                style={{
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                · {report.priceLabel}
              </span>
            </div>
          </div>

          {/* Report title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                color: '#f1f5f9',
                fontSize: 42,
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </span>
            <span
              style={{
                color: palette.accent,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {subtitle}
            </span>
          </div>

          {/* Sharpest insight callout */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
              border: `1px solid rgba(255,255,255,0.08)`,
              borderLeft: `3px solid ${palette.border}`,
              borderRadius: 12,
              padding: '16px 20px',
              gap: 6,
            }}
          >
            <span
              style={{
                color: palette.accent,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
              }}
            >
              Key finding
            </span>
            <span
              style={{
                color: '#cbd5e1',
                fontSize: 15,
                lineHeight: 1.55,
                fontStyle: 'italic',
              }}
            >
              &ldquo;{insight}&rdquo;
            </span>
          </div>

          {/* Footer strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {report.bestFor.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  style={{
                    color: '#64748b',
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    padding: '3px 10px',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <span
              style={{
                color: '#475569',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              rareagent.work/reports/{report.slug}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
