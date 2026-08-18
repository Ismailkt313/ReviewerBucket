"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/app/utils/api";
import { adminFetch } from "@/app/services/admin-auth";
import AdminShell from "@/app/admin/components/AdminShell";
import { GitPullRequest, RefreshCw, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

type ReviewerUpdateRequest = {
  id: string;
  reviewerId: {
    id: string;
    name: string;
    code: string;
    slug: string;
  } | null;
  proposedData: {
    name?: string;
    code?: string;
    stacks?: string[];
  };
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
};

export default function AdminUpdateRequestsPage() {
  const [requests, setRequests] = useState<ReviewerUpdateRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Rejection dialog states
  const [rejectingRequest, setRejectingRequest] = useState<ReviewerUpdateRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await adminFetch(getApiUrl("/api/reviewers/update-requests"), { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setRequests(json.data || []);
      } else {
        setError(json.message || "Failed to load update requests.");
      }
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    adminFetch(getApiUrl("/api/reviewers/update-requests"), { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!isMounted) return;
        if (res.ok) {
          setRequests(json.data || []);
        } else {
          setError(json.message || "Failed to load update requests.");
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Failed to connect to the server.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await adminFetch(getApiUrl(`/api/reviewers/update-requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: "Admin" }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Update request approved and changes merged successfully!", "success");
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "APPROVED",
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: "Admin",
                }
              : r
          )
        );
      } else {
        showToast(json.message || "Approval failed.", "error");
      }
    } catch {
      showToast("Network error occurred.", "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleOpenRejectDialog = (req: ReviewerUpdateRequest) => {
    setRejectingRequest(req);
    setRejectionReason("");
  };

  const handleRejectSubmit = async () => {
    if (!rejectingRequest || actioningId) return;
    const targetId = rejectingRequest.id;
    setActioningId(targetId);
    try {
      const res = await adminFetch(getApiUrl(`/api/reviewers/update-requests/${targetId}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim() || undefined,
          reviewedBy: "Admin",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Update request rejected successfully.", "success");
        setRequests((prev) =>
          prev.map((r) =>
            r.id === targetId
              ? {
                  ...r,
                  status: "REJECTED",
                  rejectionReason: rejectionReason.trim() || undefined,
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: "Admin",
                }
              : r
          )
        );
        setRejectingRequest(null);
      } else {
        showToast(json.message || "Rejection failed.", "error");
      }
    } catch {
      showToast("Network error occurred.", "error");
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  const pendingUpdateCount = requests.filter(
    (r) => r.status.toUpperCase() === "PENDING"
  ).length;

  return (
    <AdminShell
      headerTitle="Update Requests"
      pendingUpdateRequestsCount={pendingUpdateCount}
    >
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 animate-slide-up-fade">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-center text-white ${
              toast.type === "success" ? "bg-emerald-600 dark:bg-emerald-500" : "bg-red-600 dark:bg-red-500"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-secondary" />
          <span className="text-xs font-semibold text-muted">
            {requests.length} {requests.length === 1 ? "update request" : "update requests"} total
          </span>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-surface text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-border border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading update requests...</p>
        </div>
      ) : error ? (
        <div className="py-16 text-center border border-border rounded-2xl bg-surface p-6 space-y-4 max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <div>
            <h3 className="font-semibold text-foreground">Failed to Load Update Requests</h3>
            <p className="text-xs text-muted mt-1">{error}</p>
          </div>
          <button
            onClick={fetchRequests}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-20 text-center border border-border rounded-2xl bg-surface p-8 space-y-3">
          <div className="inline-flex p-3 rounded-full bg-indigo-500/10 text-indigo-500">
            <GitPullRequest className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-foreground">No Pending Update Requests</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            All reviewer modification submissions have been processed.
          </p>
        </div>
      ) : (
        /* Update Requests Table */
        <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-elevated/50 text-[11px] font-bold tracking-wider text-muted uppercase">
                  <th className="px-6 py-4">Target Reviewer</th>
                  <th className="px-6 py-4">Proposed Changes</th>
                  <th className="px-6 py-4">Requested Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-elevated/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">
                        {req.reviewerId?.name || "Deleted Reviewer"}
                      </div>
                      <div className="text-xs text-muted font-mono">
                        Code: {req.reviewerId?.code || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs">
                        {req.proposedData.name && (
                          <div>
                            <span className="text-muted">Name: </span>
                            <span className="font-semibold text-foreground">
                              {req.proposedData.name}
                            </span>
                          </div>
                        )}
                        {req.proposedData.code && (
                          <div>
                            <span className="text-muted">Code: </span>
                            <span className="font-semibold text-foreground font-mono">
                              {req.proposedData.code}
                            </span>
                          </div>
                        )}
                        {req.proposedData.stacks && req.proposedData.stacks.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {req.proposedData.stacks.map((stack) => (
                              <span
                                key={stack}
                                className="inline-flex items-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-medium"
                              >
                                {stack}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-secondary text-xs">
                      {formatDate(req.requestedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          req.status.toUpperCase() === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : req.status.toUpperCase() === "REJECTED"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {req.status.toUpperCase() === "PENDING" && <Clock className="w-3 h-3" />}
                        {req.status.toUpperCase() === "APPROVED" && <CheckCircle2 className="w-3 h-3" />}
                        {req.status.toUpperCase() === "REJECTED" && <AlertCircle className="w-3 h-3" />}
                        <span>{req.status}</span>
                      </span>
                      {req.status.toUpperCase() === "REJECTED" && req.rejectionReason && (
                        <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={req.rejectionReason}>
                          Reason: {req.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status.toUpperCase() === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={actioningId !== null}
                            onClick={() => handleApprove(req.id)}
                            className="inline-flex h-8 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-3 text-xs font-bold transition-colors"
                          >
                            {actioningId === req.id ? "..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={actioningId !== null}
                            onClick={() => handleOpenRejectDialog(req)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-border bg-surface text-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 disabled:opacity-40 px-3 text-xs font-bold transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">
                          {req.reviewedAt ? formatDate(req.reviewedAt) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      {rejectingRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-update-dialog-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRejectingRequest(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 id="reject-update-dialog-title" className="text-base font-bold text-foreground">
                Reject Update Request
              </h3>
              <p className="text-xs text-muted mt-1">
                Provide an optional reason for rejecting update for <strong>{rejectingRequest.reviewerId?.name || "Reviewer"}</strong>.
              </p>
            </div>
            <div>
              <label htmlFor="update-rejection-reason" className="sr-only">
                Rejection Reason
              </label>
              <textarea
                id="update-rejection-reason"
                rows={3}
                placeholder="Reason (e.g. Invalid changes, unverified code...)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={actioningId !== null}
                className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center justify-center"
              >
                {actioningId ? "..." : "Reject Update"}
              </button>
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="flex-1 h-9 rounded-xl border border-border bg-surface text-foreground font-semibold text-xs hover:bg-elevated transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
