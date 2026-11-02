import type { ReactNode } from "react";
import { ui } from "../ui";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-white/[.07] ${className}`} />;
}

function Card({ children }: { children: ReactNode }) {
  return <section className={ui.card}>{children}</section>;
}

export default function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your dashboard"
      aria-live="polite"
      className="grid grid-cols-1 items-start gap-[13px] [&>*]:w-full [&>*]:min-w-0"
    >
      <span className="sr-only">Loading your financial overview…</span>
      <section className={`${ui.hero} space-y-4`}>
        <Bar className="h-3 w-3/4 bg-white/10" />
        <Bar className="h-12 w-2/3 bg-white/10" />
        <Bar className="h-3 w-1/2 bg-white/10" />
        <div className="flex items-center justify-between border-t border-white/[.09] pt-4">
          <Bar className="h-3 w-28" />
          <Bar className="h-4 w-24" />
        </div>
      </section>

      <Card>
        <Bar className="mb-2 h-3 w-32" />
        <Bar className="mb-4 h-5 w-40" />
        <div className="grid grid-cols-2 gap-[9px]">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-[17px] border border-white/[.035] bg-white/[.035] p-3.5">
              <Bar className="h-3 w-20" />
              <Bar className="mt-3 h-6 w-28 max-w-full" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <Bar className="h-3 w-24" />
            <Bar className="h-5 w-32" />
          </div>
          <Bar className="h-4 w-14" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[18px] border border-white/[.075] bg-[#171d28] p-3">
              <Bar className="size-[46px] shrink-0 rounded-[14px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bar className="h-3 w-2/3" />
                <Bar className="h-2.5 w-1/2" />
              </div>
              <Bar className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 space-y-2">
          <Bar className="h-3 w-24" />
          <Bar className="h-5 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-[9px]">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-[17px] border border-white/[.035] bg-white/[.035] p-3.5">
              <Bar className="h-3 w-20" />
              <Bar className="mt-3 h-6 w-24 max-w-full" />
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-4 border-t border-white/[.075] pt-4">
          <Bar className="h-4 w-40" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between"><Bar className="h-3 w-24" /><Bar className="h-3 w-16" /></div>
              <Bar className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="space-y-2"><Bar className="h-3 w-24" /><Bar className="h-5 w-40" /></div>
          <Bar className="h-4 w-14" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-white/[.075] py-3 last:border-0">
            <Bar className="size-[37px] shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2"><Bar className="h-3 w-2/3" /><Bar className="h-2.5 w-1/3" /></div>
            <Bar className="h-3 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}
