"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, ShieldCheck, Mail } from "lucide-react";

export default function ServiceDisruptionModal() {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll and focus modal on mount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Intercept and prevent Escape key dismissal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        } else {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="service-disruption-heading"
      aria-describedby="service-disruption-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/25 dark:bg-black/45 backdrop-blur-sm sm:backdrop-blur-[6px] select-none cursor-default"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Translucent Glass Modal Card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] bg-white/45 dark:bg-neutral-950/45 backdrop-blur-xl border border-white/50 dark:border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.25)] p-6 sm:p-7 animate-scale-in text-foreground outline-none text-center transition-all"
      >
        {/* Warning Icon Glass Badge */}
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/15 dark:bg-amber-400/20 border border-amber-500/30 dark:border-amber-400/25 backdrop-blur-md flex items-center justify-center text-amber-700 dark:text-amber-300 mb-3.5 shadow-sm">
          <AlertTriangle className="w-6 h-6 stroke-[2.2]" aria-hidden="true" />
        </div>

        {/* Status Indicator Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 backdrop-blur-md mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          <span>TEMPORARILY UNAVAILABLE</span>
        </div>

        {/* Heading */}
        <h1
          id="service-disruption-heading"
          className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white"
        >
          ReviewerBucket Under Disruption
        </h1>

        {/* Concise Body */}
        <p
          id="service-disruption-desc"
          className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-200 font-medium"
        >
          We’re temporarily offline while restoring and strengthening our backend services. We’ll be back shortly.
        </p>

        {/* Translucent Data Safety Notice */}
        <div className="mt-4 py-2 px-3 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md flex items-center justify-center gap-2 text-emerald-900 dark:text-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
          <span>Your data and existing content remain safe.</span>
        </div>

        {/* Sign-off */}
        <p className="mt-4 text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
          Thank you for your patience. — <span className="text-neutral-900 dark:text-neutral-100 font-semibold">Team ReviewerBucket</span>
        </p>

        {/* Developer Contact Link */}
        <div className="mt-3.5 pt-3 border-t border-black/10 dark:border-white/10">
          <a
            href="mailto:muhammedismailkt@gmail.com"
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors font-medium select-text"
          >
            <Mail className="w-3 h-3 opacity-70" aria-hidden="true" />
            <span>Connect with dev: muhammedismailkt@gmail.com</span>
          </a>
        </div>
      </div>
    </div>
  );
}
