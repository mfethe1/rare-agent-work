export default function ReportDetailLoading() {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-[20rem] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      {/* Nav skeleton */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-xl bg-white/10" />
            <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
          </div>
          <div className="hidden items-center gap-3 md:flex">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 w-16 animate-pulse rounded-full bg-white/8" />
            ))}
          </div>
          <div className="h-9 w-28 animate-pulse rounded-full bg-cyan-400/20" />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        {/* Breadcrumb skeleton */}
        <div className="mb-6 flex items-center gap-2">
          <div className="h-3 w-16 animate-pulse rounded bg-white/8" />
          <div className="h-3 w-4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-24 animate-pulse rounded bg-white/8" />
          <div className="h-3 w-4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-40 animate-pulse rounded bg-white/8" />
        </div>

        {/* Report header skeleton */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-5 w-32 animate-pulse rounded bg-white/6" />
          </div>
          <div className="h-9 w-full max-w-2xl animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-white/8" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-white/6" />
          <div className="mt-1.5 h-4 w-5/6 animate-pulse rounded bg-white/5" />

          {/* CTA buttons */}
          <div className="mt-6 flex gap-3">
            <div className="h-12 w-36 animate-pulse rounded-full bg-cyan-400/15" />
            <div className="h-12 w-28 animate-pulse rounded-full bg-white/8" />
          </div>
        </div>

        {/* Section skeletons (mimicking report content sections) */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-6 rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:p-7">
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-white/6" />
              <div className="h-4 w-full animate-pulse rounded bg-white/5" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-full animate-pulse rounded bg-white/6" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}

        {/* Locked section skeleton */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.015] p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-5 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
          </div>
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-white/5" />
          <div className="mt-4 h-11 w-40 animate-pulse rounded-full bg-white/8" />
        </div>
      </main>
    </div>
  );
}
