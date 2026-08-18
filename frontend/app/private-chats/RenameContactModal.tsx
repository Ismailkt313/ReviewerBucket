"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, RotateCcw } from "lucide-react";
import { renameContact, ContactIdentityResponse } from "../services/private-contacts";

interface RenameContactModalProps {
  isOpen: boolean;
  contactId: string;
  currentNickname: string | null;
  isCustomName: boolean;
  onClose: () => void;
  onSuccess: (updated: ContactIdentityResponse) => void;
}

export default function RenameContactModal({
  isOpen,
  contactId,
  currentNickname,
  isCustomName,
  onClose,
  onSuccess
}: RenameContactModalProps) {
  const [nicknameInput, setNicknameInput] = useState(currentNickname || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input after modal renders
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

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
      if (e.key === "Escape" && !isSubmitting && !isResetting) {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [isOpen, onClose, isSubmitting, isResetting]);

  const handleSave = useCallback(async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setError("Please enter a valid nickname or reset to default.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Nickname cannot exceed 50 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const updated = await renameContact(contactId, trimmed);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename contact.");
    } finally {
      setIsSubmitting(false);
    }
  }, [contactId, nicknameInput, onSuccess, onClose]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setError("");

    try {
      const updated = await renameContact(contactId, "");
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset nickname.");
    } finally {
      setIsResetting(false);
    }
  }, [contactId, onSuccess, onClose]);

  if (!isOpen) return null;

  const isChanged = (nicknameInput.trim() || "") !== (currentNickname || "");
  const charCount = nicknameInput.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isResetting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
      aria-describedby="rename-dialog-desc"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex flex-col">
            <h2 id="rename-dialog-title" className="text-sm font-semibold text-foreground">
              Rename contact
            </h2>
            <p id="rename-dialog-desc" className="text-xs text-muted font-normal mt-0.5">
              Give this person a private name visible only to you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isResetting}
            className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-3"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="contact-nickname-input" className="text-xs font-normal text-secondary">
                  Private Nickname
                </label>
                <span className={`text-[11px] tabular-nums font-mono ${charCount > 50 ? "text-red-500 font-bold" : "text-muted"}`}>
                  {charCount}/50
                </span>
              </div>
              <input
                ref={inputRef}
                id="contact-nickname-input"
                type="text"
                value={nicknameInput}
                maxLength={55}
                disabled={isSubmitting || isResetting}
                onChange={(e) => {
                  setNicknameInput(e.target.value);
                  setError("");
                }}
                placeholder="e.g. Next.js Developer"
                className="w-full px-3.5 py-2.5 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 font-normal px-0.5" role="alert">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <div>
                {isCustomName && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSubmitting || isResetting}
                    className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors disabled:opacity-40 py-2 px-1 focus-visible:outline-none"
                  >
                    {isResetting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Reset to Anonymous User</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting || isResetting}
                  className="px-3.5 py-2 rounded-full text-xs font-normal text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isResetting || !nicknameInput.trim() || !isChanged || charCount > 50}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shadow-xs focus-visible:outline-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
