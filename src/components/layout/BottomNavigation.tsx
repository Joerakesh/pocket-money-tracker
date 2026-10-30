"use client";
import { ui } from "../ui";

const tabs = [
  ["home", "Home", "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"],
  ["activity", "Activity", "M4 19V5m0 14h16M7 15l4-4 3 2 5-7"],
  ["accounts", "Accounts", "M3 5h18v15H3z M3 10h18"],
  ["plan", "Plan", "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18 M12 7v5l3 2"],
] as const;

export default function BottomNavigation({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-[calc(20px_+_env(safe-area-inset-bottom))] right-[82px] z-50 isolate grid min-h-[66px] w-[min(390px,calc(100%_-_94px))] grid-cols-4 gap-[5px] rounded-3xl border border-white/[.14] bg-[#181e2a]/80 px-[9px] py-1.5 shadow-[0_14px_42px_rgba(0,0,0,.53)] backdrop-blur-[28px] backdrop-saturate-[1.6] min-[760px]:right-[calc(max(18px,(100vw_-_620px)/2_+_18px)_+_66px)] min-[760px]:w-[min(390px,calc(100%_-_102px))]"
    >
      {tabs.map(([id, label, path]) => {
        const on = active === id;
        return (
          <button
            type="button"
            key={id}
            onClick={() => onChange(id)}
            className={`flex min-h-[52px] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-0 bg-transparent px-[3px] py-1.5 text-[10px] font-semibold ${on ? "text-[#b8f36b]" : "text-[#8791a1]"} ${ui.focusRing}`}
          >
            <span
              className={`grid size-[27px] place-items-center rounded-[10px] transition duration-150 ${on ? "-translate-y-px bg-[#b8f36b]/15 text-[#b8f36b]" : "bg-white/[.055] text-[#aeb8c8]"}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="block size-[19px] fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]">
                <path d={path} />
              </svg>
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
