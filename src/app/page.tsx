"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import PocketApp from "@/components/PocketApp";
import LoginScreen from "@/components/LoginScreen";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase-client";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!firebaseAuth || !firebaseConfigured) { setLoading(false); return; }
    return onAuthStateChanged(firebaseAuth, (nextUser) => { setUser(nextUser); setLoading(false); });
  }, []);
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-[#929bad]">Loading Pocket…</main>;
  if (!user) return <LoginScreen />;
  return <PocketApp />;
}
