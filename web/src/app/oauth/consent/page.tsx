import { Suspense } from "react";
import OAuthConsentPage from "./OAuthConsentPage";

export default function OAuthConsentRoute() {
  return <Suspense fallback={<main className="p-8 text-center">Loading Pocket authorization…</main>}><OAuthConsentPage /></Suspense>;
}
