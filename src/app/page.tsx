export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="tracker-shell">
      <iframe
        title="Pocket Money Tracker"
        src="/index.html"
        className="tracker-frame"
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
