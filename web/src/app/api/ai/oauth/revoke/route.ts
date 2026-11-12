import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { sha256, verifyAccessJwt } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected application/x-www-form-urlencoded." }, { status: 400 });
  const token = String(form.get("token") || "");
  if (!token) return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  const db = await getDatabase();
  const access = verifyAccessJwt(token);
  if (access) {
    await db.collection("pocket_oauth_access_tokens").updateOne(
      { jti: access.jti, uid: access.sub, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  } else {
    await db.collection("pocket_oauth_refresh_tokens").updateOne(
      { tokenHash: sha256(token), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
