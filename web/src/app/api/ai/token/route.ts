import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { verifyFirebaseRequest } from "@/lib/firebase-admin";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const identity = await verifyFirebaseRequest(request);
  if (!identity) return json({ error: "Sign in with Google to create an AI access key." }, 401);

  const body = await request.json().catch(() => ({}));
  const label = String(body?.label || "ChatGPT").trim().slice(0, 60) || "ChatGPT";
  const token = `pocket_live_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const db = await getDatabase();
  const result = await db.collection("pocket_ai_tokens").insertOne({
    tokenHash,
    uid: identity.uid,
    email: identity.email,
    label,
    scopes: ["finance:read"],
    createdAt: now,
    expiresAt,
    revokedAt: null,
  });

  return json({
    id: String(result.insertedId),
    token,
    label,
    scopes: ["finance:read"],
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    warning: "Copy this key now. It is shown only once. Store it as a secret in your AI client.",
  }, 201);
}

export async function DELETE(request: NextRequest) {
  const identity = await verifyFirebaseRequest(request);
  if (!identity) return json({ error: "Authentication required." }, 401);
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "");
  const { ObjectId } = await import("mongodb");
  if (!ObjectId.isValid(id)) return json({ error: "A valid token id is required." }, 400);
  const db = await getDatabase();
  const result = await db.collection("pocket_ai_tokens").updateOne(
    { _id: new ObjectId(id), uid: identity.uid, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (!result.modifiedCount) return json({ error: "Active token not found." }, 404);
  return json({ ok: true, revoked: true });
}
