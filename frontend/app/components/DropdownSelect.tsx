"use client";

import React, { useState, useRef, useEffect, useCallback, useId, JSX } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  badge?: string;
  dot?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface DropdownSelectProps<T extends string = string> {
  id?: string;
  label?: string;
  helperText?: string;
  options: DropdownSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
}

export default function DropdownSelect<T extends string = string>({
  id: explicitId,
  label,
  helperText,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  triggerClassName = "",
  dropdownClassName = "",
}: DropdownSelectProps<T>): JSX.Element {
  const generatedId = useId();
  const selectId = explicitId || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setIsOpen(true);
          const idx = options.findIndex((opt) => opt.value === value);
          setFocusedIndex(idx >= 0 ? idx : 0);
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
          break;

        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
          break;

        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onChange(options[focusedIndex].value);
            setIsOpen(false);
            triggerRef.current?.focus();
          }
          break;

        case "Tab":
          setIsOpen(false);
          break;

        default:
          break;
      }
    },
    [disabled, isOpen, options, value, focusedIndex, onChange]
  );

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-foreground mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            const idx = options.findIndex((opt) => opt.value === value);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20 font-medium ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800"
            : "hover:border-neutral-400 dark:hover:border-neutral-600 cursor-pointer"
        } ${isOpen ? "ring-2 ring-foreground/20 border-foreground/30 shadow-xs" : ""} ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <>
              {selectedOption.dot && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedOption.dot}`} />
              )}
              {selectedOption.icon && (
                <selectedOption.icon className="w-3.5 h-3.5 text-secondary shrink-0" />
              )}
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ml-auto shrink-0 ${selectedOption.badge}`}
                >
                  {selectedOption.label}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-foreground" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {helperText && (
        <p className="text-[10px] text-muted mt-1">{helperText}</p>
      )}

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            focusedIndex >= 0 ? `${selectId}-opt-${focusedIndex}` : undefined
          }
          className={`absolute left-0 right-0 mt-1.5 z-40 rounded-2xl border border-border bg-surface shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto ring-1 ring-black/5 dark:ring-white/10 ${dropdownClassName}`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isFocused = idx === focusedIndex;

            return (
              <div
                key={option.value}
                id={`${selectId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-neutral-100 dark:bg-neutral-800 text-foreground font-semibold"
                    : isFocused
                    ? "bg-neutral-100/70 dark:bg-neutral-800/60 text-foreground"
                    : "text-foreground hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {option.dot && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${option.dot}`} />
                  )}
                  {option.icon && (
                    <option.icon className="w-3.5 h-3.5 text-secondary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{option.label}</span>
                      {option.badge && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${option.badge}`}
                        >
                          {option.label}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-[10px] text-muted font-normal truncate mt-0.5">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
