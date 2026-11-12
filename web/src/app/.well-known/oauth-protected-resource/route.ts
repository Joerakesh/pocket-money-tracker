import { NextResponse } from "next/server";
import { oauthIssuer, oauthResource, OAUTH_SCOPE } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    resource: oauthResource(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://money.joerakesh.tech",
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
