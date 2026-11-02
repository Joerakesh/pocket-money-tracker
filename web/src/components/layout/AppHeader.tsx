"use client";
import { useState } from "react";
import { ui } from "../ui";

export default function AppHeader({
  onRefresh,
  onSettings,
  onLogout,
  userEmail,
  userName,
  photoURL,
}: {
  onRefresh: () => void;
  onSettings: () => void;
  onLogout: () => void;
  userEmail: string;
  userName: string;
  photoURL?: string | null;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = userName || userEmail.split("@")[0] || "Account";
  const initials = displayName
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  return (
    <header className="mb-7 flex items-center justify-between gap-3.5">
      <div className="min-w-0">
        <div className="text-[25px] font-extrabold tracking-[-.07em]">Pocket<span className={ui.green}>.</span></div>
        <div className="mt-px max-w-[190px] truncate text-xs text-[#929bad]">{userName || "Your money, made clear."}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button className={ui.iconButton} onClick={onRefresh} aria-label="Refresh balances">↻</button>
        <button className={ui.iconButton} onClick={onSettings} aria-label="Settings">⚙</button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className="grid size-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-[#222936] text-xs font-bold text-[#dce3ee] transition hover:border-[#b8f36b]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8f36b]"
          >
            {photoURL ? (
              // Google provides this profile image URL through Firebase Authentication.
              <img src={photoURL} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            ) : (
              initials
            )}
          </button>
          {profileOpen && (
            <>
              <button
                type="button"
                aria-label="Close profile menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setProfileOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(280px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-white/10 bg-[#171d27] p-2 shadow-[0_18px_50px_rgba(0,0,0,.55)]"
              >
                <div className="border-b border-white/[0.07] px-3 py-3">
                  <div className="truncate text-sm font-semibold text-[#f2f5fa]">{displayName}</div>
                  <div className="mt-1 break-all text-xs leading-5 text-[#929bad]">{userEmail}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#ff6878] transition hover:bg-[#ff6878]/10 focus-visible:outline-2 focus-visible:outline-[#ff6878]"
                >
                  <span aria-hidden="true">↪</span>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
