"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/app/context/AdminAuthContext";
import { Loader2 } from "lucide-react";

export default function AdminPage() {
  const { status, isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/admin/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md max-w-sm w-full text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          <div className="relative p-3 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Admin Portal</h2>
          <p className="text-sm text-slate-400">Checking admin session...</p>
        </div>
      </div>
    </div>
  );
}
