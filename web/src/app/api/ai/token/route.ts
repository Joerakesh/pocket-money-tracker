import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { verifyFirebaseRequest } from "@/lib/firebase-admin";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const identity = await verifyFirebaseRequest(request);
  if (!identity) return json({ error: "Authentication required." }, 401);
  const db = await getDatabase();
  const rows = await db.collection("pocket_ai_tokens")
    .find({ uid: identity.uid })
    .sort({ createdAt: -1 })
    .project({ tokenHash: 0 })
    .limit(25)
    .toArray();
  return json(rows.map((row: any) => ({
    id: String(row._id),
    label: row.label || "AI client",
    scopes: row.scopes || [],
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt || null,
    status: row.revokedAt ? "revoked" : new Date(row.expiresAt).getTime() <= Date.now() ? "expired" : "active",
  })));
}

export async function POST(request: NextRequest) {
  const identity = await verifyFirebaseRequest(request);
  if (!identity) return json({ error: "Sign in with Google to create an AI access key." }, 401);

  const body = await request.json().catch(() => ({}));
  const label = String(body?.label || "ChatGPT").trim().slice(0, 60) || "ChatGPT";
  const db = await getDatabase();
  const tokenCollection = db.collection("pocket_ai_tokens");
  await Promise.all([
    tokenCollection.createIndex({ tokenHash: 1 }, { unique: true }),
    tokenCollection.createIndex({ uid: 1, createdAt: -1 }),
  ]);
  const activeCount = await tokenCollection.countDocuments({
    uid: identity.uid,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (activeCount >= 5) return json({ error: "You can have up to 5 active AI keys. Revoke an unused key first." }, 429);

  const token = `pocket_live_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const result = await tokenCollection.insertOne({
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
