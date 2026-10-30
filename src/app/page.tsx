import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 760, margin: "12vh auto", padding: 24 }}>
      <p style={{ color: "#b7f36b", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
        POCKET MONEY TRACKER · NEXT.JS MIGRATION
      </p>
      <h1 style={{ fontSize: "clamp(2.2rem, 7vw, 4rem)", lineHeight: 1.05, margin: "18px 0" }}>
        Your finances, on a stronger foundation.
      </h1>
      <p style={{ color: "#a6b3ac", lineHeight: 1.8, maxWidth: 620 }}>
        The Next.js application and MongoDB connection layer are in place.
        The existing finance interface and Express API are being retained during
        the migration so your ledger and historical records are not disrupted.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
        <Link href="/index.html" style={{ background: "#b7f36b", color: "#10170c", padding: "12px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>
          Open existing tracker
        </Link>
        <Link href="/api/health" style={{ border: "1px solid #35433b", padding: "12px 18px", borderRadius: 10, textDecoration: "none" }}>
          Check database API
        </Link>
      </div>
      <p style={{ color: "#718078", fontSize: 13, marginTop: 44 }}>
        Migration phase 1 · Existing ledger data remains in the current MongoDB database.
      </p>
    </main>
  );
}
