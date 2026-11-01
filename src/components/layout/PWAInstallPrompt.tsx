"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag for installed web apps.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const userAgent = navigator.userAgent;
    setIsIOS(
      /iPad|iPhone|iPod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowGuide(false);
    };
    const handleDisplayMode = (event: MediaQueryListEvent) => {
      if (event.matches) setInstalled(true);
    };

    const displayMode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener?.("change", handleDisplayMode);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Pocket service worker registration failed:", error);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener?.("change", handleDisplayMode);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!installEvent) {
      setShowGuide((value) => !value);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  };

  return (
    <section
      aria-label="Install Pocket app"
      className="mb-[13px] rounded-[18px] border border-[#b8f36b]/20 bg-[linear-gradient(120deg,rgba(184,243,107,.10),rgba(17,23,34,.96)_58%)] p-4"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#b8f36b] text-lg font-black text-[#101608]">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#f5f7fb]">Take Pocket with you</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#aab5c5]">
            Install it for quick access from your home screen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="shrink-0 rounded-xl bg-[#b8f36b] px-3 py-2.5 text-xs font-extrabold text-[#101608] transition hover:bg-[#ccff91] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8f36b]"
        >
          Install app
        </button>
      </div>

      {showGuide && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-[#c4ccda]">
          <p className="mb-1 font-bold text-[#f5f7fb]">
            {isIOS ? "Install on iPhone or iPad" : "Install Pocket"}
          </p>
          {isIOS ? (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open this page in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Choose “Add to Home Screen”, then tap Add.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open the browser menu (⋮) or the install icon in the address bar.</li>
              <li>Choose “Install app” or “Add to Home screen”.</li>
              <li>Confirm the installation.</li>
            </ol>
          )}
          <p className="mt-2 text-[10px] text-[#8995a8]">
            Installation is available when Pocket is opened over HTTPS in a supported browser.
          </p>
        </div>
      )}
    </section>
  );
}
