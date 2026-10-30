// Shared Tailwind class strings. Tailwind scans this file, so no custom CSS is needed.
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#b8f36b]";

const cardBase =
  "min-w-0 rounded-[20px] border border-white/[.075] p-4 shadow-[0_12px_34px_rgba(0,0,0,.14)] min-[421px]:rounded-3xl min-[421px]:p-[19px]";

const btn =
  `w-full min-w-0 cursor-pointer rounded-[13px] border border-white/[.075] px-[13px] py-3 font-bold text-[#f5f7fb] transition duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const ui = {
  focusRing,
  cardBase,
  card: `${cardBase} bg-linear-to-br from-[#181e2b]/95 to-[#111621]/95`,
  hero: `${cardBase} relative overflow-hidden border-[#b8f36b]/[.17] bg-[radial-gradient(circle_at_100%_0%,rgba(184,243,107,.12),transparent_42%),linear-gradient(145deg,#1b2930,#17202a_65%,#171d29)] px-[22px] py-[25px] max-[420px]:px-[18px] max-[420px]:py-[23px]`,

  h2: "mb-3.5 text-base font-bold tracking-[-.035em]",
  h2Flush: "text-base font-bold tracking-[-.035em]",
  sectionHead: "flex items-center justify-between gap-2",
  sectionLabel: "block text-[10px] font-bold uppercase tracking-[.1em] text-[#929bad]",
  note: "mt-0.5 mb-3 text-[11px] leading-[1.55] text-[#929bad]",
  empty: "py-3.5 text-xs text-[#929bad]",
  muted: "text-[#929bad]",
  green: "text-[#b8f36b]",
  red: "text-[#ff7887]",
  pill: "inline-block rounded-full bg-[#293341] px-2 py-[3px] text-[10px] text-[#d0d8e6]",

  label: "mb-1.5 block text-[11px] font-semibold text-[#929bad]",
  field:
    "w-full min-w-0 rounded-[13px] border border-white/[.075] bg-[#0f141e] px-[13px] py-3 text-[#f5f7fb] outline-none placeholder:text-[#758093] focus:border-[#b8f36b]/55 focus:ring-[3px] focus:ring-[#b8f36b]/10 " +
    focusRing,
  primary: `${btn} border-[#b8f36b] bg-[#b8f36b] text-[#101608]`,
  ghost: `${btn} bg-[#222a38]`,
  textAction: `w-auto cursor-pointer whitespace-nowrap border-0 bg-transparent px-0 py-1.5 text-[11px] font-bold text-[#b8f36b] ${focusRing}`,
  iconButton: `size-[42px] shrink-0 cursor-pointer rounded-full border border-white/[.075] bg-[#222a38] p-0 text-lg text-[#f5f7fb] transition active:scale-[.98] ${focusRing}`,
  smallButton: `mt-[5px] w-auto cursor-pointer rounded-[9px] border border-white/[.075] bg-[#222a38] px-[9px] py-[5px] text-[10px] font-bold text-[#f5f7fb] ${focusRing}`,

  formGrid: "grid grid-cols-2 gap-[13px] max-[420px]:grid-cols-1 [&>div]:min-w-0",
  full: "col-span-full",
  list: "grid",
  row: "flex min-w-0 items-center justify-between gap-3 border-b border-white/[.075] py-[13px] text-[13px] last:border-b-0 max-[520px]:gap-2",
  rowMain: "min-w-0 flex-1",
  rowSide: "flex-none text-right max-[520px]:max-w-[46%]",
  rowTitle: "block text-[13px] font-bold",
  rowSub: "mt-[3px] block text-[11px] text-[#929bad]",

  metrics: "grid grid-cols-2 gap-[9px]",
  metric: "min-w-0 rounded-[17px] border border-white/[.035] bg-white/[.035] p-3.5",
  metricLabel: "text-[11px] text-[#929bad]",
  metricValue:
    "mt-1 block text-xl tracking-[-.045em] [overflow-wrap:anywhere] max-[420px]:text-lg",

  bankGrid: "grid min-w-0 grid-cols-1 gap-[9px]",
  bankCard:
    "relative flex min-w-0 items-center gap-2.5 rounded-[18px] border border-white/[.075] bg-[#171d28] p-[13px] max-[420px]:p-[11px]",
  bankLogo:
    "relative grid size-[46px] flex-none place-items-center overflow-hidden rounded-[14px] bg-white text-xs font-black tracking-[-.05em] text-[#15233b] max-[420px]:size-10",
  bankLogoImg: "absolute inset-0 size-full bg-white object-contain p-1.5",
  bankName: "block truncate text-[13px] font-bold",
  bankSub: "mt-0.5 block truncate text-[10px] text-[#929bad]",
  bankBalance: "whitespace-nowrap text-[13px] font-bold max-[420px]:text-xs",
} as const;
