"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase-client";
import { useState } from "react";

export default function LoginScreen() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    if (!firebaseAuth) return;
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(firebaseAuth, provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-[390px] rounded-3xl border border-white/10 bg-[#111722]/90 p-8 shadow-2xl">
        <div className="text-3xl font-extrabold tracking-[-.07em]">Pocket<span className="text-[#b8f36b]">.</span></div>
        <p className="mt-2 text-sm text-[#929bad]">Your money, made clear.</p>
        <div className="my-8 h-px bg-white/10" />
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-[#929bad]">Sign in securely to access your personal finance dashboard.</p>
        {!firebaseConfigured && <p className="mt-5 rounded-xl bg-red-500/10 p-3 text-xs text-red-300">Firebase web configuration is missing. Add the NEXT_PUBLIC_FIREBASE_* variables.</p>}
        {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
        <button type="button" disabled={!firebaseConfigured || busy} onClick={login} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-[#151922] disabled:opacity-50">
          <span className="text-lg font-bold">G</span>{busy ? "Connecting…" : "Continue with Google"}
        </button>
        <p className="mt-6 text-center text-[11px] leading-5 text-[#778195]">Your financial records are private to your account.</p>
      </section>
    </main>
  );
}
