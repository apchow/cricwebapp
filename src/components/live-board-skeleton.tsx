/**
 * Dimension-matched stand-in for the live board. The hero and tool cards paint
 * immediately; this holds the board's space so the scores stream in without
 * shoving the rest of the page down (no layout shift).
 */
export function LiveBoardSkeleton() {
  return (
    <section className="mb-16" aria-hidden="true">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
          From the ground
        </h2>
        <span className="h-3 w-20 rounded-full bg-slate-800 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1].map((column) => (
          <div key={column} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
              <span className="h-3 w-28 rounded bg-slate-800 animate-pulse" />
              <span className="ml-auto h-3 w-4 rounded bg-slate-800 animate-pulse" />
            </div>
            <ul className="space-y-2">
              {[0, 1, 2].map((row) => (
                <li
                  key={row}
                  className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-slate-800 animate-pulse" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-800/70 animate-pulse" />
                    </div>
                    <span className="h-4 w-12 shrink-0 rounded-full bg-slate-800 animate-pulse" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-2.5 w-full rounded bg-slate-800/60 animate-pulse" />
                    <div className="h-2.5 w-5/6 rounded bg-slate-800/60 animate-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}