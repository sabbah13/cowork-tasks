export function CardSkeleton() {
  return (
    <div className="rounded-md border border-line bg-canvas p-3 shadow-sm">
      <div className="skeleton h-3 w-3/4 rounded-sm" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded-sm" />
      <div className="mt-3 flex items-center gap-2">
        <div className="skeleton h-5 w-5 rounded-full" />
        <div className="skeleton h-3 w-20 rounded-sm" />
      </div>
    </div>
  );
}
