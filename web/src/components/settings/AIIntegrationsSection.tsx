"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuth } from "@/lib/firebase-client";
import { ui } from "../ui";

type ApiKey = {
  id: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "revoked" | "expired";
};

export default function AIIntegrationsSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("ChatGPT");
  const [newToken, setNewToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (method = "GET", body?: unknown) => {
    const user = firebaseAuth?.currentUser;
    if (!user) throw new Error("Sign in again to manage AI access.");
    const idToken = await user.getIdToken();
    const response = await fetch("/api/ai/token", {
      method,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "AI key request failed.");
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError("");
      const data = await request();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load API keys.");
    }
  }, [request]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createKey = async () => {
    setBusy(true); setError(""); setNotice(""); setNewToken("");
    try {
      const data = await request("POST", { label });
      setNewToken(data.token);
      setNotice("API key created. Copy it now; Pocket will not show it again.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create API key.");
    } finally { setBusy(false); }
  };

  const revokeKey = async (id: string) => {
    if (!window.confirm("Revoke this AI key? Any connected assistant using it will stop working.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("DELETE", { id });
      setNotice("API key revoked.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke API key.");
    } finally { setBusy(false); }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice("Clipboard unavailable. Select and copy the key manually.");
    }
  };

  return (
    <section className={ui.card}>
      <div className={ui.sectionHead}>
        <div>
          <span className={ui.sectionLabel}>AI & CONNECTED APPS</span>
          <h2 className={ui.h2Flush}>Pocket AI access</h2>
        </div>
      </div>
      <p className={`${ui.note} mt-2`}>
        Connect ChatGPT or another trusted AI client to read your Pocket finances.
        Keys are read-only, expire after 90 days and can be revoked here.
      </p>
      <label className={`${ui.label} mt-4`}>Connection name</label>
      <input className={ui.field} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="ChatGPT" />
      <button className={`${ui.primary} mt-2`} type="button" disabled={busy || !label.trim()} onClick={() => void createKey()}>
        {busy ? "Please wait…" : "Generate API key"}
      </button>

      {newToken && (
        <div className="mt-4 rounded-xl border border-[#b8f36b]/30 bg-[#b8f36b]/[0.06] p-3">
          <p className="text-sm font-semibold text-[#b8f36b]">Your new API key</p>
          <p className="mt-1 text-xs text-[#aab3c2]">This is the only time the full key will be displayed. Store it in your AI client's secret/authentication settings.</p>
          <textarea className={`${ui.field} mt-2 min-h-20 resize-y font-mono text-xs`} readOnly value={newToken} />
          <button className={`${ui.ghost} mt-2`} type="button" onClick={() => void copy(newToken)}>Copy API key</button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[#ff7887]" role="alert">{error}</p>}
      {notice && <p className="mt-3 text-sm text-[#b8f36b]" role="status">{notice}</p>}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Connected API keys</h3>
          <button className={ui.ghost} type="button" onClick={() => void refresh()}>Refresh</button>
        </div>
        {keys.length === 0 ? (
          <p className={ui.note}>No API keys created yet.</p>
        ) : (
          <div className={ui.list}>
            {keys.map((key) => (
              <div className={ui.row} key={key.id}>
                <div className={ui.rowMain}>
                  <strong className="block text-sm">{key.label}</strong>
                  <span className="block text-xs text-[#8d98a9]">
                    Expires {new Date(key.expiresAt).toLocaleDateString("en-IN")} · {key.status}
                  </span>
                </div>
                {key.status === "active" && (
                  <button className={ui.ghost} type="button" disabled={busy} onClick={() => void revokeKey(key.id)}>Revoke</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-white/[0.035] p-3">
        <p className="text-xs font-semibold">API base URL</p>
        <code className="mt-1 block break-all text-xs text-[#b8f36b]">/api/ai/v1</code>
        <p className={`${ui.note} mt-2`}>OpenAPI specification: <code>/api/ai/openapi</code>. Import the full URL from your deployed Pocket host into a GPT Action and select Bearer authentication.</p>
      </div>
    </section>
  );
}
