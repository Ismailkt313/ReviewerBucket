"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/app/context/AdminAuthContext";
import {
  LayoutDashboard,
  FileText,
  GitPullRequest,
  MessageSquare,
  Megaphone,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAdminPrivateUnread } from "@/app/hooks/useAdminPrivateUnread";

export interface AdminSidebarProps {
  pendingRequestsCount?: number;
  pendingUpdateRequestsCount?: number;
  onCloseMobile?: () => void;
  className?: string;
}

export default function AdminSidebar({
  pendingRequestsCount = 0,
  pendingUpdateRequestsCount = 0,
  onCloseMobile,
  className = "",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const { unreadCount: adminPrivateUnread } = useAdminPrivateUnread();

  const isLinkActive = (path: string) => {
    if (path === "/admin/dashboard") {
      return pathname === "/admin/dashboard" || pathname === "/admin";
    }
    return pathname.startsWith(path);
  };

  const navSections = [
    {
      title: "Overview",
      items: [
        {
          name: "Dashboard",
          href: "/admin/dashboard",
          icon: LayoutDashboard,
          badge: null,
        },
      ],
    },
    {
      title: "Management",
      items: [
        {
          name: "Requests",
          href: "/admin/requests",
          icon: FileText,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
        },
        {
          name: "Update Requests",
          href: "/admin/update-requests",
          icon: GitPullRequest,
          badge: pendingUpdateRequestsCount > 0 ? pendingUpdateRequestsCount : null,
        },
      ],
    },
    {
      title: "Communication",
      items: [
        {
          name: "Private Chats",
          href: "/admin/chat",
          icon: MessageSquare,
          badge: adminPrivateUnread > 0 ? adminPrivateUnread : null,
        },
        {
          name: "Broadcast",
          href: "/admin/broadcast",
          icon: Megaphone,
          badge: null,
        },
      ],
    },
  ];

  return (
    <aside
      className={`w-64 flex flex-col h-full bg-surface border-r border-border select-none ${className}`}
    >
      {/* Sidebar Header / Branding */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-border">
        <Link
          href="/admin/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm text-foreground tracking-tight block leading-tight">
              Reviewer Bucket
            </span>
            <span className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest block">
              Admin Portal
            </span>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-elevated transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <nav className="space-y-1">
              {section.items.map((item) => {
                const active = isLinkActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-foreground text-background font-semibold shadow-sm"
                        : "text-secondary hover:text-foreground hover:bg-elevated"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? "text-background" : "text-muted group-hover:text-foreground"
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge !== null && (
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
                          active
                            ? "bg-background text-foreground shadow-xs"
                            : "bg-foreground text-background shadow-xs"
                        }`}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Sidebar Footer / Logout */}
      <div className="p-3 border-t border-border mt-auto">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
