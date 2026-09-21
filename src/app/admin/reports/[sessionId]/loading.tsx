export default function Loading() {
  return (
    <div className="p-6 lg:p-8 animate-pulse max-w-6xl mx-auto w-full">
      {/* Sub Header Skeleton */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
        <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-[120px] bg-slate-100 rounded-2xl border border-slate-200"></div>
          <div className="h-[400px] bg-slate-100 rounded-2xl border border-slate-200"></div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
          <div className="h-[200px] bg-slate-100 rounded-2xl border border-slate-200"></div>
          <div className="h-[250px] bg-slate-100 rounded-2xl border border-slate-200"></div>
        </div>
      </div>
    </div>
  );
}
