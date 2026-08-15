"use client";

import { useEffect, useRef } from "react";
import { X, ShieldAlert } from "lucide-react";

interface AnonymousInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnonymousInfoModal({ isOpen, onClose }: AnonymousInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-dialog-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-secondary flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 id="info-dialog-title" className="text-sm font-bold text-foreground">
              Anonymous private chat
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-xs sm:text-sm text-secondary leading-relaxed">
          <p>
            Your anonymous identity is stored locally in this browser.
          </p>
          <p>
            Clearing browser data, switching browsers, or changing devices may remove access to your private chats.
          </p>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-850/80 border border-border/60 text-foreground text-xs font-medium">
            Reviewer Bucket cannot recover that anonymous identity once lost.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-neutral-50/50 dark:bg-neutral-900/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent text-background text-xs font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
