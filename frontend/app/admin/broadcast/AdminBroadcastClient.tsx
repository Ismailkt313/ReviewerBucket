"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IAdminBroadcast,
  BroadcastDeliveryMode,
  getAdminBroadcasts,
  createAdminBroadcast,
} from "@/app/services/broadcasts";
import AdminShell from "@/app/admin/components/AdminShell";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import {
  Megaphone,
  Search,
  Send,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Clock,
  Check,
  X,
  Plus,
  MessageSquare,
  Users,
  ShieldCheck,
  Edit3,
} from "lucide-react";

export interface AdminBroadcastClientProps {
  initialBroadcastId?: string;
}

function formatBroadcastDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminBroadcastClient({
  initialBroadcastId,
}: AdminBroadcastClientProps) {
  const router = useRouter();

  // State
  const [broadcasts, setBroadcasts] = useState<IAdminBroadcast[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mobile View Navigation: "composer" or "history"
  const [mobileTab, setMobileTab] = useState<"composer" | "history">("composer");

  // Active view: null means composer mode, or specific broadcast object
  const [selectedBroadcast, setSelectedBroadcast] = useState<IAdminBroadcast | null>(null);

  // Composer form state
  const [deliveryMode, setDeliveryMode] = useState<BroadcastDeliveryMode>("ANNOUNCEMENT");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Confirmation Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAdminBroadcasts(50);
      setBroadcasts(data);
      if (initialBroadcastId) {
        const found = data.find((b) => b.id === initialBroadcastId || (b as any)._id === initialBroadcastId);
        if (found) {
          setSelectedBroadcast(found);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load broadcast history.");
    } finally {
      setIsLoading(false);
    }
  }, [initialBroadcastId]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Handle composer submission initiation
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;
    setSubmitError(null);
    setIsConfirmModalOpen(true);
  };

  // Confirm and send broadcast
  const handleConfirmSend = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createAdminBroadcast(content.trim(), deliveryMode);
      setBroadcasts((prev) => [created, ...prev]);
      setContent("");
      setIsConfirmModalOpen(false);
      setSelectedBroadcast(created);
      setSuccessMessage(
        deliveryMode === "DIRECT_MESSAGE"
          ? "Direct message sent to all active users. Users can reply directly in their Developer Chat."
          : "Official announcement published to the Reviewer Bucket channel for all users."
      );
      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Broadcast could not be sent. Try again.");
      setIsConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedBroadcast(null);
    setMobileTab("composer");
    setSubmitError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Filtered broadcast history
  const filteredBroadcasts = broadcasts.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      b.content.toLowerCase().includes(q) ||
      b.audience.toLowerCase().includes(q) ||
      (b.deliveryMode && b.deliveryMode.toLowerCase().includes(q))
    );
  });

  return (
    <AdminShell headerTitle="Broadcast & Mass Messaging">
      <AdminPageHeader
        title="Broadcast Messaging"
        description="Share official announcements with all users or send mass direct messages with two-way reply capability."
      />

      {/* MOBILE SEGMENTED VIEW SWITCHER (Visible on Mobile & Tablet < lg) */}
      <div className="flex lg:hidden p-1 bg-surface border border-border rounded-2xl mb-3 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setSelectedBroadcast(null);
            setMobileTab("composer");
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            selectedBroadcast === null && mobileTab === "composer"
              ? "bg-accent text-background shadow-xs"
              : "text-secondary hover:text-foreground hover:bg-elevated/50"
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Compose Form</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileTab("history");
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            mobileTab === "history" || selectedBroadcast !== null
              ? "bg-accent text-background shadow-xs"
              : "text-secondary hover:text-foreground hover:bg-elevated/50"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Sent History ({broadcasts.length})</span>
        </button>
      </div>

      {/* Main 2-Column Broadcast Container */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col lg:flex-row h-[calc(100vh-14rem)] min-h-[560px]">
        {/* LEFT COLUMN: Broadcast List & Navigation */}
        <div
          className={`w-full lg:w-80 border-r border-border flex flex-col bg-surface shrink-0 ${
            mobileTab === "history" && selectedBroadcast === null
              ? "flex flex-1 lg:flex-initial"
              : "hidden lg:flex"
          }`}
        >
          {/* Header Action: Compose New Broadcast Button */}
          <div className="p-3.5 border-b border-border space-y-2.5">
            <button
              type="button"
              onClick={handleCreateNew}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedBroadcast === null && mobileTab === "composer"
                  ? "bg-accent text-background shadow-xs ring-2 ring-accent/20"
                  : "bg-elevated hover:bg-neutral-200 dark:hover:bg-neutral-750 text-foreground"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Compose Message / Announcement</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quick Context Switcher to Private Chats */}
          <div className="px-3.5 py-2 border-b border-border bg-surface/50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              Sent History ({broadcasts.length})
            </span>
            <Link
              href="/admin/chat"
              className="text-[11px] font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Private Chats</span>
            </Link>
          </div>

          {/* List Items Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-6 text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                <p className="text-xs text-muted">Loading broadcast history...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center space-y-3">
                <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                <p className="text-xs text-muted">{error}</p>
                <button
                  onClick={fetchBroadcasts}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                >
                  Retry
                </button>
              </div>
            ) : filteredBroadcasts.length === 0 ? (
              <div className="p-8 text-center text-muted space-y-2">
                <Megaphone className="w-8 h-8 text-muted/50 mx-auto" />
                <p className="text-xs font-medium">No messages found.</p>
                <p className="text-[11px] text-muted">
                  Broadcasts and mass direct messages will appear here.
                </p>
              </div>
            ) : (
              filteredBroadcasts.map((broadcast) => {
                const isSelected = selectedBroadcast?.id === broadcast.id;
                const isDM = broadcast.deliveryMode === "DIRECT_MESSAGE";

                return (
                  <button
                    key={broadcast.id || (broadcast as any)._id}
                    type="button"
                    onClick={() => {
                      setSelectedBroadcast(broadcast);
                      setSubmitError(null);
                    }}
                    className={`w-full text-left p-3.5 transition-colors relative block ${
                      isSelected
                        ? "bg-elevated border-l-4 border-l-blue-500"
                        : "hover:bg-elevated/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                            isDM
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isDM ? (
                            <MessageSquare className="w-3 h-3" />
                          ) : (
                            <Megaphone className="w-3 h-3" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-foreground truncate">
                          {isDM ? "Direct to All" : "Announcement"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted shrink-0 tabular-nums">
                        {formatBroadcastDate(broadcast.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-secondary line-clamp-2 pl-6 leading-relaxed">
                      {broadcast.content}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Workspace (Composer Form or History View) */}
        <div
          className={`flex-1 flex flex-col bg-background min-w-0 ${
            (mobileTab === "composer" && selectedBroadcast === null) || selectedBroadcast !== null
              ? "flex"
              : "hidden lg:flex"
          }`}
        >
          {/* COMPOSER FORM VIEW */}
          {selectedBroadcast === null ? (
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
              {/* Composer Header */}
              <div className="h-14 px-4 sm:px-5 border-b border-border bg-surface flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      deliveryMode === "DIRECT_MESSAGE"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-blue-500/10 text-blue-500"
                    }`}
                  >
                    {deliveryMode === "DIRECT_MESSAGE" ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : (
                      <Megaphone className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {deliveryMode === "DIRECT_MESSAGE"
                        ? "Mass Direct Message (Two-Way)"
                        : "Official System Announcement (Read-Only)"}
                    </h3>
                    <p className="text-[11px] text-muted hidden sm:block">
                      {deliveryMode === "DIRECT_MESSAGE"
                        ? "Delivered into each user's Developer Chat with reply capability"
                        : "Published to Reviewer Bucket Official announcements channel"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-elevated text-foreground text-[11px] font-semibold">
                    <Users className="w-3 h-3 text-muted" />
                    <span>All users</span>
                  </span>
                </div>
              </div>

              {/* Composer Body */}
              <div className="p-4 sm:p-6 lg:p-8 max-w-3xl flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  {/* Success Alert with Action */}
                  {successMessage && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between gap-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>{successMessage}</span>
                      </div>
                      {deliveryMode === "DIRECT_MESSAGE" && (
                        <Link
                          href="/admin/chat"
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[11px] shrink-0"
                        >
                          View Private Chats
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Submit Error Alert */}
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* 2-OPTION MODE SELECTOR */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-secondary">
                      Choose Broadcast Option
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Official Announcement (Read-Only) */}
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("ANNOUNCEMENT")}
                        className={`p-3.5 rounded-xl border text-left transition-all relative ${
                          deliveryMode === "ANNOUNCEMENT"
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                            : "border-border bg-surface hover:bg-elevated/70 text-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Megaphone
                              className={`w-4 h-4 ${
                                deliveryMode === "ANNOUNCEMENT"
                                  ? "text-blue-500"
                                  : "text-muted"
                              }`}
                            />
                            <span className="text-xs font-bold text-foreground">
                              Official Announcement
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/15 text-blue-500 uppercase tracking-wider">
                            Read-Only
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-relaxed">
                          For feature releases and notices. Published to the official Reviewer Bucket channel.
                        </p>
                      </button>

                      {/* Option 2: Direct Message to All (Two-Way Reply Enabled) */}
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("DIRECT_MESSAGE")}
                        className={`p-3.5 rounded-xl border text-left transition-all relative ${
                          deliveryMode === "DIRECT_MESSAGE"
                            ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                            : "border-border bg-surface hover:bg-elevated/70 text-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <MessageSquare
                              className={`w-4 h-4 ${
                                deliveryMode === "DIRECT_MESSAGE"
                                  ? "text-emerald-500"
                                  : "text-muted"
                              }`}
                            />
                            <span className="text-xs font-bold text-foreground">
                              Direct Message to All
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Replies Enabled
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-relaxed">
                          For personal questions or outreach (e.g., &quot;hi bro&quot;). Delivered to each user&apos;s Developer Chat with reply enabled.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Message Composer Form */}
                  <form id="broadcast-form" onSubmit={handleInitiateSend} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="broadcast-content"
                        className="text-xs font-bold uppercase tracking-wider text-secondary"
                      >
                        {deliveryMode === "DIRECT_MESSAGE"
                          ? "Personal Direct Message Content"
                          : "Announcement Content"}
                      </label>
                      <span className="text-[11px] text-muted tabular-nums">
                        {content.length}/2000
                      </span>
                    </div>

                    <textarea
                      ref={textareaRef}
                      id="broadcast-content"
                      rows={6}
                      placeholder={
                        deliveryMode === "DIRECT_MESSAGE"
                          ? "Write your personal message to all users (e.g., 'hi bro, how is your experience so far?')..."
                          : "Write your official announcement (e.g., 'We have launched new features in Reviewer Bucket!')..."
                      }
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        setSubmitError(null);
                      }}
                      maxLength={2000}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none resize-none transition-colors"
                      required
                    />
                  </form>
                </div>

                {/* Composer Footer Actions */}
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-muted text-[11px]">
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${
                        deliveryMode === "DIRECT_MESSAGE"
                          ? "text-emerald-500"
                          : "text-blue-500"
                      }`}
                    />
                    <span>
                      {deliveryMode === "DIRECT_MESSAGE"
                        ? "Sender: Reviewer Bucket Developer (Users can reply)"
                        : "Sender: Reviewer Bucket (Official announcement channel)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="submit"
                      form="broadcast-form"
                      disabled={!content.trim() || isSubmitting}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 shadow-sm ${
                        deliveryMode === "DIRECT_MESSAGE"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-accent text-background hover:opacity-90"
                      }`}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>
                        {deliveryMode === "DIRECT_MESSAGE"
                          ? "Send Direct Message to All"
                          : "Publish Announcement"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* DETAIL / READ-ONLY MODE FOR SENT BROADCAST */
            <div className="flex-1 flex flex-col h-full overflow-y-auto">
              {/* Detail Header */}
              <div className="h-14 px-4 sm:px-5 border-b border-border bg-surface flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBroadcast(null);
                      setMobileTab("history");
                    }}
                    className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-elevated lg:hidden"
                    aria-label="Back to history"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground truncate">
                        {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                          ? "Direct Message to All"
                          : "Official Announcement"}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                          ? "Replies Enabled"
                          : "Read-Only"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      Audience: {selectedBroadcast.audience} • {formatBroadcastDate(selectedBroadcast.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE" && (
                    <Link
                      href="/admin/chat"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border hover:bg-elevated text-secondary"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">View Replies</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent text-background hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Compose New</span>
                  </button>
                </div>
              </div>

              {/* Detail Body */}
              <div className="p-4 sm:p-6 lg:p-8 max-w-3xl flex-1 flex flex-col space-y-6">
                <div className="space-y-4">
                  {/* System Announcement Display Box */}
                  <div className="p-5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE" ? (
                            <MessageSquare className="w-4 h-4" />
                          ) : (
                            <Megaphone className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                              ? "Reviewer Bucket Developer"
                              : "Reviewer Bucket"}
                          </p>
                          <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                            {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                              ? "Direct message to all users"
                              : "Official announcement"}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs text-muted tabular-nums">
                        {formatBroadcastDate(selectedBroadcast.createdAt)}
                      </span>
                    </div>

                    <div className="py-2">
                      <p className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap break-words">
                        {selectedBroadcast.content}
                      </p>
                    </div>
                  </div>

                  {/* Mode Info Box */}
                  <div className="p-3.5 rounded-xl border border-border/60 bg-elevated/40 text-xs text-muted flex items-start gap-2.5">
                    {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE" ? (
                      <>
                        <MessageSquare className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">
                          This message was placed directly in each user&apos;s Developer Chat. When users respond, their replies arrive individually in your <strong>Private Chats</strong> workspace.
                        </p>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">
                          This announcement was published to the official Reviewer Bucket channel. It is displayed as a read-only update to all eligible users.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                {deliveryMode === "DIRECT_MESSAGE" ? (
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Megaphone className="w-4 h-4 text-blue-500" />
                )}
                <span>
                  {deliveryMode === "DIRECT_MESSAGE"
                    ? "Send Direct Message to All?"
                    : "Publish Official Announcement?"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              {deliveryMode === "DIRECT_MESSAGE" ? (
                <>
                  This message will be delivered into{" "}
                  <strong className="text-foreground">
                    every user&apos;s Reviewer Bucket Developer private chat
                  </strong>
                  . Users will be able to reply directly.
                </>
              ) : (
                <>
                  This announcement will be published to the{" "}
                  <strong className="text-foreground">
                    official Reviewer Bucket channel
                  </strong>{" "}
                  for all eligible users. It is read-only.
                </>
              )}
            </p>

            <div className="p-3 rounded-xl border border-border bg-background text-xs text-foreground/90 max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
              {content}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-secondary hover:bg-elevated hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSubmitting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
                  deliveryMode === "DIRECT_MESSAGE"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-accent text-background hover:opacity-90"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {deliveryMode === "DIRECT_MESSAGE"
                    ? "Send to All Users"
                    : "Publish Announcement"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
