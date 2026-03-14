export default function NewsLoading() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100">
      {/* Nav skeleton */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0d0d]/90 backdrop-blur-xl">
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
          <div className="h-9 w-32 animate-pulse rounded-full bg-orange-400/20" />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            {/* Header skeleton */}
            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-orange-300/15" />
                  <div className="mt-3 h-8 w-full max-w-lg animate-pulse rounded-lg bg-white/10" />
                  <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-white/6" />
                  <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-white/5" />
                </div>
                <div className="grid min-w-[220px] grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                    <div className="mx-auto h-6 w-10 animate-pulse rounded bg-white/10" />
                    <div className="mx-auto mt-1 h-3 w-16 animate-pulse rounded bg-white/5" />
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                    <div className="mx-auto h-6 w-10 animate-pulse rounded bg-white/10" />
                    <div className="mx-auto mt-1 h-3 w-16 animate-pulse rounded bg-white/5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tag filter skeleton */}
            <div className="mb-6 flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-7 animate-pulse rounded-full bg-gray-800"
                  style={{ width: `${60 + Math.floor(i * 13) % 40}px` }}
                />
              ))}
            </div>

            {/* News item skeletons */}
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-white/10" />
                    <div className="flex-1">
                      <div className="h-5 w-full max-w-lg animate-pulse rounded bg-white/10" />
                      <div className="mt-2 h-4 w-full animate-pulse rounded bg-white/5" />
                      <div className="mt-1 h-4 w-4/5 animate-pulse rounded bg-white/5" />
                      <div className="mt-3 flex gap-2">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-white/6" />
                        <div className="h-5 w-20 animate-pulse rounded-full bg-white/6" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sidebar skeleton */}
          <aside className="hidden lg:block">
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
                <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
                <div className="mt-4 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-4 w-full animate-pulse rounded bg-white/6" />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
                <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-4 space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-4 w-full animate-pulse rounded bg-white/6" />
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
