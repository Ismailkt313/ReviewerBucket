"use client";

import React, { forwardRef, HTMLAttributes } from "react";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  horizontal?: boolean;
  hideScrollbar?: boolean;
  autoHide?: boolean;
}

/**
 * High-performance, lightweight ScrollArea component with custom sleek scrollbar
 * styling that matches Reviewer Bucket's monochrome minimalist aesthetic.
 * Forwards DOM ref for native scroll measurements, infinite scroll, and intersection observers.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    {
      children,
      className = "",
      horizontal = false,
      hideScrollbar = false,
      autoHide = true,
      ...props
    },
    ref
  ) {
    const scrollClass = hideScrollbar
      ? "scrollbar-none"
      : "custom-scrollbar";

    const overflowClass = horizontal
      ? "overflow-x-auto overflow-y-hidden"
      : "overflow-y-auto overflow-x-hidden";

    return (
      <div
        ref={ref}
        style={{ colorScheme: "dark", ...props.style }}
        className={`${overflowClass} ${scrollClass} min-h-0 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = "ScrollArea";

export default ScrollArea;
