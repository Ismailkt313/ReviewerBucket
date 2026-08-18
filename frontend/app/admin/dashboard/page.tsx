"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getApiUrl } from "@/app/utils/api";
import { adminFetch } from "@/app/services/admin-auth";
import AdminShell from "@/app/admin/components/AdminShell";
import {
  FileText,
  GitPullRequest,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

interface ReviewerRequestItem {
  id: string;
  reviewerName: string;
  reviewerCode: string;
  type: "create" | "update";
  status: "pending" | "approved" | "rejected" | "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
}

interface ReviewerUpdateRequestItem {
  id: string;
  reviewerId: {
    name: string;
    code: string;
  } | null;
  proposedData: {
    name?: string;
    code?: string;
  };
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
}

interface CombinedActivityItem {
  id: string;
  targetName: string;
  code: string;
  category: "Creation Request" | "Update Request";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  href: string;
}

export default function AdminDashboardPage() {
  const [creationRequests, setCreationRequests] = useState<ReviewerRequestItem[]>([]);
  const [updateRequests, setUpdateRequests] = useState<ReviewerUpdateRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [reqRes, updateRes] = await Promise.all([
        adminFetch(getApiUrl("/api/reviewers/requests"), { cache: "no-store" }),
        adminFetch(getApiUrl("/api/reviewers/update-requests"), { cache: "no-store" }),
      ]);

      if (!reqRes.ok || !updateRes.ok) {
        throw new Error("Failed to load dashboard operational data.");
      }

      const reqJson = await reqRes.json();
      const updateJson = await updateRes.json();

      setCreationRequests(Array.isArray(reqJson.data) ? reqJson.data : []);
      setUpdateRequests(Array.isArray(updateJson.data) ? updateJson.data : []);
    } catch {
      setError("Could not connect to the server. Please verify network status and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      adminFetch(getApiUrl("/api/reviewers/requests"), { cache: "no-store" }),
      adminFetch(getApiUrl("/api/reviewers/update-requests"), { cache: "no-store" }),
    ])
      .then(async ([reqRes, updateRes]) => {
        const reqJson = await reqRes.json();
        const updateJson = await updateRes.json();
        if (!isMounted) return;
        if (!reqRes.ok || !updateRes.ok) {
          setError("Failed to fetch operational activity data.");
        } else {
          setCreationRequests(Array.isArray(reqJson.data) ? reqJson.data : []);
          setUpdateRequests(Array.isArray(updateJson.data) ? updateJson.data : []);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Could not connect to the server. Please verify network status and try again.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Derived operational statistics from real backend APIs
  const pendingRequestsCount = creationRequests.filter(
    (r) => r.status.toUpperCase() === "PENDING"
  ).length;

  const pendingUpdateRequestsCount = updateRequests.filter(
    (r) => r.status.toUpperCase() === "PENDING"
  ).length;

  const totalProcessedCount =
    creationRequests.filter((r) => r.status.toUpperCase() !== "PENDING").length +
    updateRequests.filter((r) => r.status.toUpperCase() !== "PENDING").length;

  // Combine and sort top 5 recent activities
  const recentActivities: CombinedActivityItem[] = [
    ...creationRequests.map((r) => ({
      id: r.id,
      targetName: r.reviewerName,
      code: r.reviewerCode,
      category: "Creation Request" as const,
      status: r.status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED",
      requestedAt: r.requestedAt,
      href: "/admin/requests",
    })),
    ...updateRequests.map((r) => ({
      id: r.id,
      targetName: r.reviewerId?.name || r.proposedData?.name || "Reviewer Update",
      code: r.reviewerId?.code || r.proposedData?.code || "N/A",
      category: "Update Request" as const,
      status: r.status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED",
      requestedAt: r.requestedAt,
      href: "/admin/update-requests",
    })),
  ]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .slice(0, 5);

  return (
    <AdminShell
      headerTitle="Dashboard"
      pendingRequestsCount={pendingRequestsCount}
      pendingUpdateRequestsCount={pendingUpdateRequestsCount}
    >
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted">
            Live operational overview
          </span>
        </div>
        <button
          type="button"
          onClick={fetchDashboardData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-surface text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {error ? (
        <div className="p-6 rounded-2xl bg-red-950/30 border border-red-800/40 text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Dashboard Load Failed</h3>
            <p className="text-xs text-muted mt-1">{error}</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-8">
          {/* Skeleton stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-surface border border-border p-5 animate-pulse flex flex-col justify-between"
              >
                <div className="w-24 h-4 bg-elevated rounded-md" />
                <div className="w-12 h-8 bg-elevated rounded-md" />
              </div>
            ))}
          </div>
          {/* Skeleton table */}
          <div className="h-64 rounded-2xl bg-surface border border-border p-6 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Card 1: Pending Creation Requests */}
            <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Pending Requests
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {pendingRequestsCount}
                </span>
                <Link
                  href="/admin/requests"
                  className="text-xs font-semibold text-blue-500 hover:text-blue-400 flex items-center gap-1 group"
                >
                  <span>Review</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Card 2: Pending Update Requests */}
            <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Pending Updates
                </span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400">
                  <GitPullRequest className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {pendingUpdateRequestsCount}
                </span>
                <Link
                  href="/admin/update-requests"
                  className="text-xs font-semibold text-blue-500 hover:text-blue-400 flex items-center gap-1 group"
                >
                  <span>Review</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Card 3: Total Processed Items */}
            <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Total Processed
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {totalProcessedCount}
                </span>
                <span className="text-xs font-medium text-muted">
                  Historical Records
                </span>
              </div>
            </div>
          </div>

          {/* Quick Management Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/requests"
              className="p-5 rounded-2xl bg-surface border border-border hover:border-blue-500/40 hover:bg-elevated transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-blue-500 transition-colors">
                    Reviewer Requests
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Approve or reject new reviewer submissions from students.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              href="/admin/update-requests"
              className="p-5 rounded-2xl bg-surface border border-border hover:border-blue-500/40 hover:bg-elevated transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <GitPullRequest className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-indigo-500 transition-colors">
                    Update Requests
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Review proposed reviewer modifications and code updates.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>

          {/* Recent Activity Table Section */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Recent Request Activity
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Latest reviewer creation and modification submissions.
                </p>
              </div>
            </div>

            {recentActivities.length === 0 ? (
              <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                <Clock className="w-8 h-8 text-muted/60" />
                <p className="text-sm font-medium">No recent requests recorded.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-elevated/50 text-[11px] font-bold text-muted uppercase tracking-wider">
                      <th className="py-3 px-5">Target / Reviewer</th>
                      <th className="py-3 px-5">Type</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentActivities.map((activity) => (
                      <tr
                        key={`${activity.category}-${activity.id}`}
                        className="hover:bg-elevated/40 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-foreground">
                            {activity.targetName}
                          </div>
                          <div className="text-xs text-muted font-mono">
                            {activity.code}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-xs font-medium text-secondary">
                            {activity.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-muted">
                          {new Date(activity.requestedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-5">
                          {activity.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                          {activity.status === "APPROVED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved</span>
                            </span>
                          )}
                          {activity.status === "REJECTED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                              <AlertCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Link
                            href={activity.href}
                            className="text-xs font-semibold text-blue-500 hover:text-blue-400 hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
