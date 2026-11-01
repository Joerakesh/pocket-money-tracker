"use client";
import { ui } from "../ui";

export default function AppHeader({ onRefresh, onSettings, onLogout, userEmail }: {
  onRefresh: () => void;
  onSettings: () => void;
  onLogout: () => void;
  userEmail: string;
}) {
  return (
    <header className="mb-7 flex items-center justify-between gap-3.5">
      <div className="min-w-0">
        <div className="text-[25px] font-extrabold tracking-[-.07em]">Pocket<span className={ui.green}>.</span></div>
        <div className="mt-px max-w-[190px] truncate text-xs text-[#929bad]">{userEmail || "Your money, made clear."}</div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button className={ui.iconButton} onClick={onRefresh} aria-label="Refresh balances">↻</button>
        <button className={ui.iconButton} onClick={onSettings} aria-label="Settings">⚙</button>
        <button className={ui.iconButton} onClick={onLogout} aria-label="Sign out" title="Sign out">↪</button>
      </div>
    </header>
  );
}
