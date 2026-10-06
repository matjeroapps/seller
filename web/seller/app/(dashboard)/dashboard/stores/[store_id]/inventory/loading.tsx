export default function InventoryLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading store inventory">
      {/* Header Skeleton */}
      <div className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-6 w-64 bg-slate-200 rounded" />
          <div className="h-3 w-80 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          <div className="h-8 w-32 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Inventory Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-7 w-28 bg-slate-100 rounded-lg" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 bg-slate-100 rounded-md" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-48 bg-slate-200 rounded" />
                  <div className="h-2.5 w-28 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="h-4 w-14 bg-slate-200 rounded" />
                <div className="h-4 w-14 bg-slate-200 rounded" />
                <div className="h-4 w-14 bg-slate-200 rounded" />
                <div className="h-7 w-24 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
