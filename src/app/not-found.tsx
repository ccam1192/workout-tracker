export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted">
        That page or workout doesn’t exist, or it may have been deleted.
      </p>
      <a
        href="/dashboard"
        className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 font-semibold text-accent-text"
      >
        Back to Dashboard
      </a>
    </div>
  );
}
