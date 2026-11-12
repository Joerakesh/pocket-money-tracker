"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase-client";

export default function OAuthConsentPage() {
  const params = useSearchParams();
  const requestId = params.get("request_id") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const decide = async (approved: boolean) => {
    if (!requestId || !firebaseAuth || !firebaseConfigured) {
      setError("Pocket sign-in is not configured. Please contact Pocket support.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let user = firebaseAuth.currentUser;
      if (approved && !user) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        user = (await signInWithPopup(firebaseAuth, provider)).user;
      }
      if (approved && !user) throw new Error("Sign-in is required to approve access.");
      const firebaseIdToken = approved ? await user!.getIdToken(true) : "";
      const response = await fetch("/api/ai/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, firebaseIdToken, approved }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.redirectTo !== "string") throw new Error(result.error || "Could not complete the authorization.");
      window.location.assign(result.redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the authorization.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111722] p-7 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b8f36b]">Pocket authorization</p>
        <h1 className="mt-3 text-2xl font-bold">Connect Pocket to ChatGPT?</h1>
        <p className="mt-3 text-sm leading-6 text-[#aab3c2]">ChatGPT is requesting permission to read finance information from your Pocket account.</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <h2 className="font-semibold">Permission requested</h2>
          <p className="mt-2 text-sm font-medium text-[#b8f36b]">finance:read</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-5 text-[#aab3c2]">
            <li>Account balances and monthly overview</li>
            <li>Transactions and spending categories</li>
            <li>Budgets, savings goals and recurring expenses</li>
          </ul>
          <p className="mt-4 text-xs leading-5 text-[#778195]">Read-only access. ChatGPT cannot create, edit, transfer or delete transactions.</p>
        </div>
        {!firebaseConfigured && <p className="mt-4 text-sm text-red-300">Firebase sign-in is not configured.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={() => decide(false)} className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold disabled:opacity-50">Deny</button>
          <button type="button" disabled={busy || !firebaseConfigured} onClick={() => decide(true)} className="rounded-xl bg-[#b8f36b] px-5 py-3 text-sm font-bold text-[#111722] disabled:opacity-50">{busy ? "Please wait…" : "Sign in & allow"}</button>
        </div>
      </section>
    </main>
  );
}
