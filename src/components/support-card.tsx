"use client";

import { useState } from "react";
import { Check, Copy, Heart, Smartphone } from "lucide-react";

const UPI_ID = "9458175464@yesfam";
const AMOUNTS = [49, 99, 199, 499];

function upiLink(amount?: number) {
  const base = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent("Pundit Arena")}&cu=INR`;
  return amount ? `${base}&am=${amount}` : base;
}

export default function SupportCard() {
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div className="shrink-0 rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/upi-qr.png"
            alt={`UPI QR code for ${UPI_ID}`}
            width={192}
            height={192}
            className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg"
          />
        </div>
        <div className="flex-1 w-full space-y-4 text-center sm:text-left">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400/80 mb-1">
              Scan with any UPI app
            </div>
            <p className="text-sm text-slate-400">
              GPay, PhonePe, Paytm, BHIM — point the scanner at the code and the
              payee fills itself in.
            </p>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <code className="px-3 py-2 rounded-xl bg-slate-900/80 border border-amber-500/20 text-amber-200 font-mono text-sm sm:text-base select-all">
              {UPI_ID}
            </code>
            <button
              onClick={copyId}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                copied
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
              aria-live="polite"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
          On your phone? Pick an amount and jump straight into your UPI app
        </div>
        <div className="flex flex-wrap gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              aria-pressed={amount === a}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                amount === a
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                  : "bg-slate-800/80 border border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-200"
              }`}
            >
              ₹{a}
            </button>
          ))}
          <button
            onClick={() => setAmount(null)}
            aria-pressed={amount === null}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              amount === null
                ? "bg-amber-500/20 border border-amber-500/50 text-amber-200"
                : "bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            Any amount
          </button>
        </div>
        <a
          href={upiLink(amount ?? undefined)}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_24px_rgba(251,191,36,0.3)]"
        >
          <Smartphone className="w-4 h-4" />
          Open UPI app{amount ? ` · ₹${amount}` : ""}
        </a>
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Heart className="w-3 h-3 text-rose-400/70" />
          The button needs a UPI app installed — on a laptop, scan the QR or copy
          the ID instead.
        </p>
      </div>
    </div>
  );
}