import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDatabase().then((db) => db.command({ ping: 1 }));
    return NextResponse.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { ok: false, error: "Database connection failed" },
      { status: 503 },
    );
  }
}
