"use client";

import React from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useAdminAuth } from "@/app/context/AdminAuthContext";
import { Menu, LogOut, Shield } from "lucide-react";

export interface AdminHeaderProps {
  onOpenMobileSidebar?: () => void;
  title?: string;
}

export default function AdminHeader({
  onOpenMobileSidebar,
  title = "Admin Portal",
}: AdminHeaderProps) {
  const { logout } = useAdminAuth();

  return (
    <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none backdrop-blur-md bg-surface/90">
      <div className="flex items-center gap-3">
        {onOpenMobileSidebar && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors lg:hidden"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500 hidden sm:block" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-secondary hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30"
          aria-label="Log out of admin session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
