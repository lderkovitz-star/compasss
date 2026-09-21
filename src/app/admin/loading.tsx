export default function AdminLoading() {
  return (
    <div className="p-6 lg:p-8 animate-pulse w-full h-full flex flex-col">
      {/* Sub header skeleton */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
        <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
      </div>
      
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl border border-slate-200"></div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 h-64"></div>
    </div>
  );
}
