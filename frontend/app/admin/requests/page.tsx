"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/app/utils/api";
import { adminFetch } from "@/app/services/admin-auth";
import AdminShell from "@/app/admin/components/AdminShell";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { FileText, RefreshCw, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

type ReviewerRequest = {
  id: string;
  reviewerName: string;
  reviewerCode: string;
  type: "create" | "update";
  targetReviewerId?: string;
  batch?: string;
  stacks?: string[];
  status: "pending" | "approved" | "rejected" | "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<ReviewerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Rejection dialog states
  const [rejectingRequest, setRejectingRequest] = useState<ReviewerRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await adminFetch(getApiUrl("/api/reviewers/requests"), { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setRequests(json.data || []);
      } else {
        setError(json.message || "Failed to load requests.");
      }
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await adminFetch(getApiUrl(`/api/reviewers/requests/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: "Admin" }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Request approved successfully!", "success");
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "approved",
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

  const handleOpenRejectDialog = (req: ReviewerRequest) => {
    setRejectingRequest(req);
    setRejectionReason("");
  };

  const handleRejectSubmit = async () => {
    if (!rejectingRequest || actioningId) return;
    const targetId = rejectingRequest.id;
    setActioningId(targetId);
    try {
      const res = await adminFetch(getApiUrl(`/api/reviewers/requests/${targetId}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim() || undefined,
          reviewedBy: "Admin",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Request rejected successfully.", "success");
        setRequests((prev) =>
          prev.map((r) =>
            r.id === targetId
              ? {
                  ...r,
                  status: "rejected",
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

  const pendingCount = requests.filter(
    (r) => r.status.toLowerCase() === "pending"
  ).length;

  return (
    <AdminShell headerTitle="Requests" pendingRequestsCount={pendingCount}>
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

      <AdminPageHeader
        title="Reviewer Requests"
        description="Review and manage community submissions for new reviewers."
        actions={
          <button
            type="button"
            onClick={fetchRequests}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-surface text-secondary hover:text-foreground hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Loading / Error / Content */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-border border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading requests...</p>
        </div>
      ) : error ? (
        <div className="py-16 text-center border border-border rounded-2xl bg-surface p-6 space-y-4 max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <div>
            <h3 className="font-semibold text-foreground">Failed to Load Requests</h3>
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
          <div className="inline-flex p-3 rounded-full bg-blue-500/10 text-blue-500">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-foreground">No Pending Requests</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            All reviewer creation requests have been processed. New community submissions will appear here.
          </p>
        </div>
      ) : (
        /* Requests Table */
        <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-elevated/50 text-[11px] font-bold tracking-wider text-muted uppercase">
                  <th className="px-6 py-4">Reviewer Details</th>
                  <th className="px-6 py-4">Batch</th>
                  <th className="px-6 py-4">Requested Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-elevated/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            req.type === "update"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {req.type || "CREATE"}
                        </span>
                        <div className="font-semibold text-foreground">{req.reviewerName}</div>
                      </div>
                      <div className="text-xs text-muted font-mono">Code: {req.reviewerCode}</div>
                      {req.stacks && req.stacks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {req.stacks.map((stack) => (
                            <span
                              key={stack}
                              className="inline-flex items-center rounded-full bg-elevated px-2 py-0.5 text-[10px] text-secondary font-medium"
                            >
                              {stack}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-secondary text-xs">{req.batch || "—"}</td>
                    <td className="px-6 py-4 text-secondary text-xs">{formatDate(req.requestedAt)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          req.status.toLowerCase() === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : req.status.toLowerCase() === "rejected"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {req.status.toLowerCase() === "pending" && <Clock className="w-3 h-3" />}
                        {req.status.toLowerCase() === "approved" && <CheckCircle2 className="w-3 h-3" />}
                        {req.status.toLowerCase() === "rejected" && <AlertCircle className="w-3 h-3" />}
                        <span>{req.status}</span>
                      </span>
                      {req.status.toLowerCase() === "rejected" && req.rejectionReason && (
                        <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={req.rejectionReason}>
                          Reason: {req.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status.toLowerCase() === "pending" ? (
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
          aria-labelledby="reject-dialog-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRejectingRequest(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 id="reject-dialog-title" className="text-base font-bold text-foreground">
                Reject Reviewer Request
              </h3>
              <p className="text-xs text-muted mt-1">
                Provide an optional reason for rejecting the submission for <strong>{rejectingRequest.reviewerName}</strong>.
              </p>
            </div>
            <div>
              <label htmlFor="rejection-reason" className="sr-only">
                Rejection Reason
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                placeholder="Reason (e.g. Duplicate info, incorrect code format...)"
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
                {actioningId ? "..." : "Reject Request"}
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
