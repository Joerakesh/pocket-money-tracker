"use client";
import { useState } from "react";
import { ui } from "../ui";

const banks = [
  ["State Bank of India", "State Bank of India (SBI)", "sbin"], ["Indian Bank", "Indian Bank", "idib"], ["Kotak Mahindra Bank", "Kotak Mahindra Bank", "kkbk"], ["HDFC Bank", "HDFC Bank", "hdfc"], ["ICICI Bank", "ICICI Bank", "icic"], ["Axis Bank", "Axis Bank", "utib"], ["Canara Bank", "Canara Bank", "cnrb"], ["Bank of Baroda", "Bank of Baroda", "barb"], ["Punjab National Bank", "Punjab National Bank", "punb"], ["Union Bank of India", "Union Bank of India", "ubin"], ["IDFC FIRST Bank", "IDFC FIRST Bank", "idfb"], ["Federal Bank", "Federal Bank", "fdrl"], ["Indian Overseas Bank", "Indian Overseas Bank (IOB)", "ioba"], ["South Indian Bank", "South Indian Bank", "sibl"], ["DBS Bank India", "DBS Bank India", "dbss"], ["RBL Bank", "RBL Bank", "ratn"], ["Equitas Small Finance Bank", "Equitas Small Finance Bank", "esfb"], ["Jana Small Finance Bank", "Jana Small Finance Bank", "jsfb"], ["Ujjivan Small Finance Bank", "Ujjivan Small Finance Bank", "ujvn"], ["Tamilnad Mercantile Bank", "Tamilnad Mercantile Bank (TMB)", "tmbl"], ["City Union Bank", "City Union Bank (CUB)", "ciub"], ["Karur Vysya Bank", "Karur Vysya Bank (KVB)", "kvbl"], ["Tamil Nadu State Apex Cooperative Bank", "Tamil Nadu State Apex Cooperative Bank", ""], ["Other Bank", "Other Bank", ""], ["Cash", "Cash wallet", ""], ["UPI", "UPI wallet", ""],
];

export default function BankPicker() {
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const current = banks.find((b) => b[0] === selected);
  const logo = (b: (typeof banks)[number], size = "size-9") => (
    <span className={`grid ${size} flex-none place-items-center overflow-hidden rounded-[11px] bg-white text-[#15233b]`}>
      {b[2] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="size-full object-contain p-1" src={"https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks/assets/logos/" + b[2] + "/symbol.svg"} alt="" loading="eager" decoding="async" />
      ) : b[0] === "Cash" ? "₹" : b[0] === "UPI" ? "↗" : "+"}
    </span>
  );
  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[60px] w-full min-w-0 cursor-pointer items-center gap-3 rounded-[15px] border border-white/[.075] bg-[#171e2a] px-3 py-2.5 text-left text-[#f5f7fb] ${ui.focusRing}`}
      >
        {current ? logo(current) : <span className="grid size-9 flex-none place-items-center rounded-[11px] bg-white text-[#15233b]">＋</span>}
        <span className="min-w-0 flex-1 truncate">{current?.[1] ?? "Choose bank or wallet"}</span>
        <span className="text-lg text-[#929bad]">⌄</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Bank and wallet options" className="absolute inset-x-0 top-[calc(100%_+_7px)] z-[80] grid max-h-[280px] grid-cols-2 gap-1.5 overflow-auto rounded-[17px] border border-white/[.12] bg-[#121925] p-[7px] shadow-[0_18px_45px_rgba(0,0,0,.7)]">
          {banks.map((b) => (
            <button
              key={b[0]}
              type="button"
              role="option"
              aria-selected={selected === b[0]}
              onClick={() => { setSelected(b[0]); setOpen(false); }}
              className={`flex min-h-14 w-full min-w-0 cursor-pointer items-center gap-[9px] rounded-xl border p-2 text-left text-[11px] ${ui.focusRing} ${selected === b[0] ? "border-[#b8f36b] bg-[#b8f36b]/10 text-[#b8f36b]" : "border-transparent bg-[#1b2432] text-[#e7ebf2]"}`}
            >
              {logo(b)}<span className="min-w-0 [overflow-wrap:anywhere]">{b[1]}</span>
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name="institution" value={selected} readOnly />
    </div>
  );
}
