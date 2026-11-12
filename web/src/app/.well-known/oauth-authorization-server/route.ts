import { NextResponse } from "next/server";
import { oauthEndpoints, OAUTH_SCOPE } from "@/lib/pocket-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ...oauthEndpoints(),
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [OAUTH_SCOPE],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
