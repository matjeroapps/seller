export default function ShipmentsLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading shipments queue">
      {/* Header Skeleton */}
      <div className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-36 bg-slate-200 rounded" />
          <div className="h-6 w-60 bg-slate-200 rounded" />
          <div className="h-3 w-80 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          <div className="h-8 w-32 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Shipments Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-20 bg-slate-100 rounded-lg" />
            ))}
          </div>
          <div className="h-4 w-28 bg-slate-100 rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-slate-100 rounded" />
              </div>
              <div className="flex items-center gap-6">
                <div className="h-5 w-20 bg-slate-100 rounded-full" />
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-16 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
