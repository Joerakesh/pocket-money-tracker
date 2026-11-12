import { NextResponse } from "next/server";
import { oauthJwks } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(oauthJwks(), { headers: { "Cache-Control": "public, max-age=300" } });
}
