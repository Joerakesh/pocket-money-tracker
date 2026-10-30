"use client";
import { ui } from "../ui";

export default function AppHeader({ onRefresh, onSettings }: { onRefresh: () => void; onSettings: () => void }) {
  return (
    <header className="mb-7 flex items-center justify-between gap-3.5">
      <div>
        <div className="text-[25px] font-extrabold tracking-[-.07em]">
          Pocket<span className={ui.green}>.</span>
        </div>
        <div className="mt-px text-xs text-[#929bad]">Your money, made clear.</div>
      </div>
      <div className="flex gap-2">
        <button className={ui.iconButton} onClick={onRefresh} aria-label="Refresh balances">↻</button>
        <button className={ui.iconButton} onClick={onSettings} aria-label="Settings">⚙</button>
      </div>
    </header>
  );
}
