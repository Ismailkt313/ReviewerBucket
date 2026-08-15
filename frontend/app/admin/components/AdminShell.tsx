"use client";

import React, { useState, useEffect } from "react";
import AdminRouteGuard from "./AdminRouteGuard";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

export interface AdminShellProps {
  children: React.ReactNode;
  headerTitle?: string;
  pendingRequestsCount?: number;
  pendingUpdateRequestsCount?: number;
}

export default function AdminShell({
  children,
  headerTitle = "Admin Portal",
  pendingRequestsCount = 0,
  pendingUpdateRequestsCount = 0,
}: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close mobile sidebar on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileSidebarOpen]);

  return (
    <AdminRouteGuard>
      <div className="min-h-screen flex bg-background text-foreground">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block shrink-0 sticky top-0 h-screen">
          <AdminSidebar
            pendingRequestsCount={pendingRequestsCount}
            pendingUpdateRequestsCount={pendingUpdateRequestsCount}
          />
        </div>

        {/* Mobile Sidebar Backdrop & Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
              <AdminSidebar
                pendingRequestsCount={pendingRequestsCount}
                pendingUpdateRequestsCount={pendingUpdateRequestsCount}
                onCloseMobile={() => setMobileSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <AdminHeader
            title={headerTitle}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
