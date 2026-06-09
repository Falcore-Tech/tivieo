export function GridSkeleton() {
  return (
    <main className="mx-auto w-full max-w-page flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-secondary" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="aspect-video animate-pulse bg-secondary" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
