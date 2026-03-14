export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[30rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
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
              <div
                key={i}
                className="h-4 w-16 animate-pulse rounded-full bg-white/8"
              />
            ))}
          </div>
          <div className="h-9 w-28 animate-pulse rounded-full bg-cyan-400/20" />
        </div>
      </div>

      {/* Page content skeleton */}
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        {/* Hero skeleton */}
        <div className="flex flex-col items-center text-center">
          <div className="h-7 w-72 animate-pulse rounded-full bg-white/8" />
          <div className="mt-7 h-14 w-full max-w-3xl animate-pulse rounded-xl bg-white/8" />
          <div className="mt-3 h-14 w-full max-w-2xl animate-pulse rounded-xl bg-white/6" />
          <div className="mt-6 h-5 w-full max-w-xl animate-pulse rounded bg-white/6" />
          <div className="mt-2 h-5 w-full max-w-md animate-pulse rounded bg-white/5" />
          <div className="mt-9 flex gap-3">
            <div className="h-12 w-44 animate-pulse rounded-full bg-cyan-400/15" />
            <div className="h-12 w-40 animate-pulse rounded-full bg-white/8" />
          </div>
        </div>

        {/* Card grid skeleton */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/8 bg-white/[0.025] p-6"
            >
              <div className="h-6 w-16 animate-pulse rounded-full bg-white/10" />
              <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/6" />
              <div className="mt-1.5 h-4 w-5/6 animate-pulse rounded bg-white/5" />
              <div className="mt-5 h-10 w-full animate-pulse rounded-full bg-white/8" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
