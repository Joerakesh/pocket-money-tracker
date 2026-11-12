import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { sha256 } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected application/x-www-form-urlencoded." }, { status: 400 });
  const token = String(form.get("token") || "");
  if (!token) return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  const hash = sha256(token);
  const db = await getDatabase();
  await Promise.all([
    db.collection("pocket_oauth_refresh_tokens").updateOne({ tokenHash: hash, revokedAt: null }, { $set: { revokedAt: new Date() } }),
    db.collection("pocket_oauth_access_tokens").updateOne({ jti: token, revokedAt: null }, { $set: { revokedAt: new Date() } }),
  ]);
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
