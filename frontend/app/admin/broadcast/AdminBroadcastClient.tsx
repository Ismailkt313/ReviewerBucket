"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, JSX } from "react";
import {
  IAdminBroadcast,
  BroadcastDeliveryMode,
  BroadcastCategory,
  BroadcastPriority,
  getAdminBroadcasts,
  createAdminBroadcast,
} from "@/app/services/broadcasts";
import AdminShell from "@/app/admin/components/AdminShell";
import ScrollArea from "@/app/components/ScrollArea";
import DropdownSelect from "@/app/components/DropdownSelect";
import { getSocket } from "@/app/utils/socket";
import {
  Megaphone,
  Search,
  Send,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  Plus,
  Radio,
  ShieldCheck,
  Eye,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Bot,
  CornerDownLeft,
} from "lucide-react";

export interface AdminBroadcastClientProps {
  initialBroadcastId?: string;
}

// ─── Categories & Priorities ──────────────────────────────────────────────────

interface CategoryOption {
  value: BroadcastCategory;
  label: string;
  description: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "COMMUNITY", label: "Community", description: "General community announcements and discussions" },
  { value: "FEATURE_UPDATE", label: "Feature update", description: "New features and capability enhancements" },
  { value: "PRODUCT_UPDATE", label: "Product update", description: "Product enhancements and usability changes" },
  { value: "IMPORTANT", label: "Important", description: "Noteworthy notices for all users" },
  { value: "SYSTEM", label: "System", description: "System maintenance and infrastructure updates" },
];

interface PriorityOption {
  value: BroadcastPriority;
  label: string;
  badge: string;
  line: string;
  dot: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: "NORMAL",
    label: "Normal",
    badge: "text-secondary bg-neutral-100 dark:bg-neutral-800 border-border",
    line: "bg-border/90",
    dot: "bg-secondary",
  },
  {
    value: "IMPORTANT",
    label: "Important",
    badge: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
    line: "bg-gradient-to-r from-sky-500 via-sky-500/80 to-sky-500/20",
    dot: "bg-sky-500",
  },
  {
    value: "HIGH",
    label: "High",
    badge: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    line: "bg-gradient-to-r from-amber-500 via-amber-500/80 to-amber-500/20",
    dot: "bg-amber-500",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    badge: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
    line: "bg-gradient-to-r from-rose-500 via-rose-500/80 to-rose-500/20",
    dot: "bg-rose-500",
  },
];

function getCategoryLabel(category?: BroadcastCategory | string): string {
  switch (category) {
    case "FEATURE_UPDATE":
      return "Feature update";
    case "PRODUCT_UPDATE":
      return "Product update";
    case "COMMUNITY":
      return "Community";
    case "IMPORTANT":
      return "Important";
    case "SYSTEM":
      return "System";
    default:
      return "Community";
  }
}

function getPriorityConfig(priority?: BroadcastPriority | string): PriorityOption {
  const found = PRIORITY_OPTIONS.find((p) => p.value === priority);
  return found || PRIORITY_OPTIONS[0];
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

// Helper to extract normalized unique ID from broadcast record
const getBroadcastId = (b: IAdminBroadcast | { id?: string; _id?: string } | null | undefined): string => {
  if (!b) return "";
  return (b.id || (b as { _id?: string })._id || "").toString();
};

// Helper to safely insert or update broadcast without duplicate keys
const upsertBroadcast = (list: IAdminBroadcast[], item: IAdminBroadcast): IAdminBroadcast[] => {
  const itemId = getBroadcastId(item);
  if (!itemId) return [item, ...list];
  const exists = list.some((b) => getBroadcastId(b) === itemId);
  if (exists) {
    return list.map((b) => (getBroadcastId(b) === itemId ? item : b));
  }
  return [item, ...list];
};

// ─── Main Admin Broadcast Client Component ───────────────────────────────────

export default function AdminBroadcastClient({
  initialBroadcastId,
}: AdminBroadcastClientProps = {}): JSX.Element {
  // Broadcasts list state
  const [broadcasts, setBroadcasts] = useState<IAdminBroadcast[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view: null means composer mode, or specific broadcast object
  const [selectedBroadcast, setSelectedBroadcast] = useState<IAdminBroadcast | null>(null);

  // Delivery Mode: "ANNOUNCEMENT" (official channel) | "DIRECT_MESSAGE" (personal developer message to all users)
  const [deliveryMode, setDeliveryMode] = useState<BroadcastDeliveryMode>("ANNOUNCEMENT");

  // Composer form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<BroadcastCategory>("COMMUNITY");
  const [priority, setPriority] = useState<BroadcastPriority>("NORMAL");

  const [formErrors, setFormErrors] = useState<{ title?: string; content?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Confirmation Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Mobile Tab: "composer" | "history"
  const [mobileTab, setMobileTab] = useState<"composer" | "history">("composer");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Manual refresh / retry handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAdminBroadcasts(50);
      const seen = new Set<string>();
      const uniqueData = data.filter((b) => {
        const id = getBroadcastId(b);
        if (id && seen.has(id)) return false;
        if (id) seen.add(id);
        return true;
      });
      setBroadcasts(uniqueData);
      if (initialBroadcastId) {
        const found = uniqueData.find((b) => getBroadcastId(b) === initialBroadcastId);
        if (found) {
          setSelectedBroadcast(found);
          setMobileTab("history");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load broadcast history.");
    } finally {
      setIsLoading(false);
    }
  }, [initialBroadcastId]);

  // Initial fetch on mount
  useEffect(() => {
    let isMounted = true;

    getAdminBroadcasts(50)
      .then((data) => {
        if (!isMounted) return;
        const seen = new Set<string>();
        const uniqueData = data.filter((b) => {
          const id = getBroadcastId(b);
          if (id && seen.has(id)) return false;
          if (id) seen.add(id);
          return true;
        });
        setBroadcasts(uniqueData);
        if (initialBroadcastId) {
          const found = uniqueData.find((b) => getBroadcastId(b) === initialBroadcastId);
          if (found) {
            setSelectedBroadcast(found);
            setMobileTab("history");
          }
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load broadcast history.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialBroadcastId]);

  // Real-time socket listener for new broadcasts (e.g. from other admin sessions)
  useEffect(() => {
    const socket = getSocket();

    const handleNewBroadcast = (newBroadcast: IAdminBroadcast) => {
      if (!newBroadcast) return;
      setBroadcasts((prev) => upsertBroadcast(prev, newBroadcast));
    };

    socket.on("broadcast:new", handleNewBroadcast);

    return () => {
      socket.off("broadcast:new", handleNewBroadcast);
    };
  }, []);

  // Filtered broadcast history with strict uniqueness guarantee
  const filteredBroadcasts = useMemo(() => {
    const seen = new Set<string>();
    const unique: IAdminBroadcast[] = [];
    for (const b of broadcasts) {
      const id = getBroadcastId(b);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      unique.push(b);
    }

    if (!searchQuery.trim()) return unique;
    const q = searchQuery.toLowerCase();
    return unique.filter((b) => {
      return (
        (b.title && b.title.toLowerCase().includes(q)) ||
        b.content.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q)) ||
        (b.priority && b.priority.toLowerCase().includes(q)) ||
        (b.deliveryMode && b.deliveryMode.toLowerCase().includes(q))
      );
    });
  }, [broadcasts, searchQuery]);

  // Validate form based on active delivery mode
  const validateForm = (): boolean => {
    const errors: { title?: string; content?: string } = {};

    const trimmedContent = content.trim();

    if (deliveryMode === "ANNOUNCEMENT") {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        errors.title = "Announcement title is required.";
      } else if (trimmedTitle.length > 200) {
        errors.title = "Title cannot exceed 200 characters.";
      }
    }

    if (!trimmedContent) {
      errors.content = "Message content is required.";
    } else if (trimmedContent.length > 2000) {
      errors.content = "Content cannot exceed 2000 characters.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open confirmation modal
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;
    setSubmitError(null);
    setIsConfirmModalOpen(true);
  };

  // Confirm and send broadcast
  const handleConfirmSend = async () => {
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createAdminBroadcast({
        title: deliveryMode === "ANNOUNCEMENT" ? title.trim() : undefined,
        content: content.trim(),
        category: deliveryMode === "ANNOUNCEMENT" ? category : "COMMUNITY",
        priority: deliveryMode === "ANNOUNCEMENT" ? priority : "NORMAL",
        audience: "ALL_USERS",
        deliveryMode,
      });

      setBroadcasts((prev) => upsertBroadcast(prev, created));
      setTitle("");
      setContent("");
      setCategory("COMMUNITY");
      setPriority("NORMAL");
      setIsConfirmModalOpen(false);
      setSelectedBroadcast(created);

      if (deliveryMode === "DIRECT_MESSAGE") {
        setSuccessMessage("Personal message delivered to all users in Developer Chat.");
      } else {
        setSuccessMessage("Official announcement published to all eligible users.");
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 6000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Broadcast could not be sent. Please try again.");
      setIsConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewBroadcast = () => {
    setSelectedBroadcast(null);
    setMobileTab("composer");
    setTitle("");
    setContent("");
    setCategory("COMMUNITY");
    setPriority("NORMAL");
    setDeliveryMode("ANNOUNCEMENT");
    setFormErrors({});
    setSubmitError(null);
  };

  const currentPriorityConfig = getPriorityConfig(priority);

  return (
    <AdminShell headerTitle="Broadcast">
      {/* Global Feedback Banner */}
      {successMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/80 p-1 border border-border mb-3">
        <button
          type="button"
          onClick={() => setMobileTab("composer")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === "composer"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted hover:text-foreground"
          }`}
        >
          {selectedBroadcast ? "View Broadcast" : "Create Broadcast"}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("history")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === "history"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted hover:text-foreground"
          }`}
        >
          History ({broadcasts.length})
        </button>
      </div>

      {/* ─── Unified Fixed-Height 2-Column Workspace Container ─────────── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col lg:flex-row h-[calc(100vh-6.5rem)] min-h-[580px]">
          {/* ─── COLUMN 1: Broadcast History Sidebar (Fixed in place) ────── */}
          <div
            className={`w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-surface shrink-0 h-full overflow-hidden ${
              mobileTab === "history" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* History Header & Search (Fixed top) */}
            <div className="p-3.5 sm:p-4 border-b border-border space-y-2.5 shrink-0 bg-surface">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-secondary" />
                  <h2 className="text-sm font-bold text-foreground">History</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleStartNewBroadcast}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-foreground text-background hover:opacity-90 text-[11px] font-semibold rounded-lg shadow-xs transition-opacity cursor-pointer"
                    title="New Broadcast"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="p-1 rounded-lg text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
                    aria-label="Refresh broadcast history"
                    title="Refresh history"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search broadcasts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>

            {/* History List (Scrollable inside sidebar) */}
            <ScrollArea className="flex-1 divide-y divide-border overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-surface space-y-2 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-20" />
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-12" />
                      </div>
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
                      <div className="h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-8 text-center space-y-3">
                  <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                  <p className="text-xs text-muted">{error}</p>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredBroadcasts.length === 0 ? (
                <div className="p-8 text-center space-y-2 select-none">
                  <Megaphone className="w-7 h-7 text-muted mx-auto" />
                  <p className="text-xs font-semibold text-foreground">No broadcasts yet</p>
                  <p className="text-[11px] text-muted max-w-xs mx-auto">
                    Messages and announcements you send will appear here.
                  </p>
                </div>
              ) : (
                filteredBroadcasts.map((broadcast, index) => {
                  const bId = getBroadcastId(broadcast) || `broadcast-${index}`;
                  const isSelected = selectedBroadcast && getBroadcastId(selectedBroadcast) === bId;
                  const isDirect = broadcast.deliveryMode === "DIRECT_MESSAGE";
                  const priorityCfg = getPriorityConfig(broadcast.priority);
                  const catLabel = getCategoryLabel(broadcast.category);

                  return (
                    <button
                      type="button"
                      key={bId}
                      onClick={() => {
                        setSelectedBroadcast(broadcast);
                        setMobileTab("composer");
                      }}
                      className={`w-full text-left p-4 transition-colors relative block group focus-visible:outline-none ${
                        isSelected
                          ? "bg-neutral-100 dark:bg-neutral-800 text-foreground border-l-2 border-l-foreground"
                          : "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        {isDirect ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            <MessageSquare className="w-3 h-3" />
                            <span>Personal Message</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                            {catLabel}
                          </span>
                        )}

                        {isDirect ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                            Dev Chat
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${priorityCfg.badge}`}
                          >
                            <span className={`w-1 h-1 rounded-full ${priorityCfg.dot}`} />
                            <span>{priorityCfg.label}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-foreground leading-snug truncate mb-1">
                        {broadcast.title || broadcast.content}
                      </h4>

                      <div className="flex items-center justify-between text-[10px] text-muted tabular-nums">
                        <span>{isDirect ? "All users (Dev Chat)" : "All users"}</span>
                        <span>{formatBroadcastDate(broadcast.createdAt)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* ─── COLUMN 2: Workspace Panel (Fixed Header & Footer, Scrollable Form Area) */}
          <div
            className={`flex-1 flex flex-col bg-surface min-w-0 h-full overflow-hidden ${
              mobileTab === "composer" ? "flex" : "hidden lg:flex"
            }`}
          >
            {selectedBroadcast ? (
              /* ─── Selected Broadcast Details View ───────────────── */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Fixed Details Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0 bg-surface">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Personal Message · Developer Chat</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                            {getCategoryLabel(selectedBroadcast.category)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                              getPriorityConfig(selectedBroadcast.priority).badge
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                getPriorityConfig(selectedBroadcast.priority).dot
                              }`}
                            />
                            <span>{getPriorityConfig(selectedBroadcast.priority).label}</span>
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
                      {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                        ? "Personal Developer Message"
                        : selectedBroadcast.title || "Announcement Details"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartNewBroadcast}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold rounded-xl text-foreground transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New</span>
                  </button>
                </div>

                {/* Scrollable Details Body */}
                <ScrollArea className="flex-1 p-6 space-y-6 overflow-y-auto">
                  {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE" ? (
                    /* Personal Direct Message View */
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-border space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                          <span>Reviewer Bucket (Developer)</span>
                          <span className="text-[10px] font-normal text-muted ml-auto">
                            {formatBroadcastDate(selectedBroadcast.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words pl-8">
                          {selectedBroadcast.content}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>
                          Delivered to every user&apos;s Developer Chat. Users can reply individually to this message.
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Announcement View */
                    <>
                      <div
                        className={`h-[2px] w-full rounded-full ${
                          getPriorityConfig(selectedBroadcast.priority).line
                        }`}
                        aria-hidden="true"
                      />

                      <div className="prose dark:prose-invert max-w-none">
                        <p className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap break-words">
                          {selectedBroadcast.content}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Sent Metadata */}
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-border text-xs text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-secondary" />
                      <span>Sent: {formatBroadcastDate(selectedBroadcast.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>
                        {selectedBroadcast.deliveryMode === "DIRECT_MESSAGE"
                          ? "Audience: All users (Developer Chats)"
                          : "Audience: All users (Official Announcement Channel)"}
                      </span>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* ─── Create Broadcast Composer (Fixed Header/Footer, Scrollable Body) */
              <form onSubmit={handleInitiateSend} className="flex flex-col h-full overflow-hidden">
                {/* Fixed Composer Header */}
                <div className="px-6 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-foreground">
                      Create Broadcast
                    </h2>
                    <p className="text-[11px] text-muted leading-tight">
                      Publish an official announcement or send a personal developer message.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] text-muted border border-border shrink-0">
                    <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                    <span>Live broadcast</span>
                  </div>
                </div>

                {/* ─── ONLY THIS FORM SECTION IS SCROLLABLE ───────────────── */}
                <ScrollArea className="flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">
                  {/* Submit Error Banner */}
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* ─── Delivery Mode Selector (Announcement vs Personal Message) ─── */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">
                      Delivery Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Official Announcement */}
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("ANNOUNCEMENT")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          deliveryMode === "ANNOUNCEMENT"
                            ? "border-foreground bg-neutral-100/80 dark:bg-neutral-800/80 ring-1 ring-foreground/20 shadow-xs"
                            : "border-border hover:border-neutral-400 dark:hover:border-neutral-600 bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-foreground shrink-0" />
                            <span className="text-xs font-bold text-foreground">Announcement</span>
                          </div>
                          {deliveryMode === "ANNOUNCEMENT" && (
                            <span className="w-2 h-2 rounded-full bg-foreground" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted leading-snug">
                          Official one-way announcement · Read-only feed
                        </p>
                      </button>

                      {/* Option 2: Personal Message */}
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("DIRECT_MESSAGE")}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          deliveryMode === "DIRECT_MESSAGE"
                            ? "border-indigo-600 dark:border-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-500/20 shadow-xs"
                            : "border-border hover:border-neutral-400 dark:hover:border-neutral-600 bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-bold text-foreground">Personal Message</span>
                          </div>
                          {deliveryMode === "DIRECT_MESSAGE" && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted leading-snug">
                          Delivered to every user&apos;s Developer Chat · Users can reply
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* ─── Mode-Specific Fields ────────────────────────────────── */}
                  {deliveryMode === "ANNOUNCEMENT" ? (
                    <>
                      {/* Grid Group: Audience, Category & Priority */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Fixed Audience */}
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Audience
                          </label>
                          <div className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-border text-muted flex items-center justify-between cursor-not-allowed">
                            <span>All users</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <p className="text-[10px] text-muted mt-1">Official announcement channel</p>
                        </div>

                        {/* Category Selector */}
                        <DropdownSelect<BroadcastCategory>
                          id="broadcast-category"
                          label="Category"
                          helperText="Classification in feed"
                          options={CATEGORY_OPTIONS.map((cat) => ({
                            value: cat.value,
                            label: cat.label,
                            description: cat.description,
                          }))}
                          value={category}
                          onChange={(val) => setCategory(val)}
                        />

                        {/* Priority Selector */}
                        <DropdownSelect<BroadcastPriority>
                          id="broadcast-priority"
                          label="Priority"
                          helperText="Visual accent & urgency"
                          options={PRIORITY_OPTIONS.map((p) => ({
                            value: p.value,
                            label: p.label,
                            badge: p.badge,
                            dot: p.dot,
                          }))}
                          value={priority}
                          onChange={(val) => setPriority(val)}
                        />
                      </div>

                      {/* Title Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="broadcast-title"
                            className="block text-xs font-semibold text-foreground"
                          >
                            Title <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-muted tabular-nums">
                            {title.length}/200
                          </span>
                        </div>
                        <input
                          id="broadcast-title"
                          type="text"
                          placeholder="e.g. Private messaging is now live"
                          maxLength={200}
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: undefined }));
                          }}
                          className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-background border rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 ${
                            formErrors.title
                              ? "border-rose-500 focus:ring-rose-500/20"
                              : "border-border focus:ring-foreground/20"
                          }`}
                        />
                        {formErrors.title && (
                          <p className="text-[11px] text-rose-500 mt-1">{formErrors.title}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Personal Message Destination Note */
                    <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          Delivered individually from <strong>Reviewer Bucket (Developer)</strong> to every user&apos;s Developer Chat.
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 border border-indigo-500/30 uppercase shrink-0">
                        Reply Enabled
                      </span>
                    </div>
                  )}

                  {/* Message Content Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="broadcast-content"
                        className="block text-xs font-semibold text-foreground"
                      >
                        {deliveryMode === "DIRECT_MESSAGE" ? "Direct Message" : "Message Content"}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-muted tabular-nums">
                        {content.length}/2000
                      </span>
                    </div>
                    <textarea
                      id="broadcast-content"
                      ref={textareaRef}
                      rows={4}
                      placeholder={
                        deliveryMode === "DIRECT_MESSAGE"
                          ? "Hi 👋 I'm the developer behind Reviewer Bucket. Is there anything you'd like to see improved?"
                          : "Write the complete official announcement content here..."
                      }
                      maxLength={2000}
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        if (formErrors.content) setFormErrors((prev) => ({ ...prev, content: undefined }));
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-background border rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 resize-y leading-relaxed ${
                        formErrors.content
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-border focus:ring-foreground/20"
                      }`}
                    />
                    {formErrors.content && (
                      <p className="text-[11px] text-rose-500 mt-1">{formErrors.content}</p>
                    )}
                  </div>

                  {/* ─── Live Real-Time Preview ────────────────────────────── */}
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2.5">
                      <Eye className="w-3.5 h-3.5 text-secondary" />
                      <span>Live Preview</span>
                      <span className="text-[10px] font-normal text-muted ml-1">
                        {deliveryMode === "DIRECT_MESSAGE"
                          ? "(As seen in user Developer Chat)"
                          : "(As seen in official announcement feed)"}
                      </span>
                    </div>

                    {deliveryMode === "DIRECT_MESSAGE" ? (
                      /* Live Preview for Personal Developer Message */
                      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4 relative">
                        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              <Bot className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-foreground">Reviewer Bucket</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                  Developer
                                </span>
                              </div>
                              <span className="text-[10px] text-muted block">Direct Private Conversation</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted">Preview only</span>
                        </div>

                        {/* Chat Message Bubble */}
                        <div className="flex items-start gap-2.5">
                          <div className="max-w-[85%] rounded-2xl rounded-tl-xs px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-foreground text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs">
                            {content.trim() || "Hi 👋 I'm the developer behind Reviewer Bucket. Is there anything you'd like to see improved?"}
                            <div className="text-[9px] text-muted text-right mt-1">
                              Just now
                            </div>
                          </div>
                        </div>

                        {/* Mock User Reply Composer (Demonstrates replyability to admin) */}
                        <div className="p-2 rounded-xl bg-background border border-border flex items-center justify-between text-muted text-xs cursor-not-allowed select-none opacity-80">
                          <span className="text-[11px] pl-2">Users can reply to developer here...</span>
                          <div className="p-1 rounded-lg bg-foreground/10 text-foreground">
                            <CornerDownLeft className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Live Preview for Official Announcement */
                      <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-3.5 relative">
                        {/* Top Metadata */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                            {getCategoryLabel(category)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${currentPriorityConfig.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentPriorityConfig.dot}`} />
                            <span>{currentPriorityConfig.label}</span>
                          </span>
                        </div>

                        {/* Announcement Title */}
                        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight leading-snug break-words">
                          {title.trim() || "Announcement Title"}
                        </h3>

                        {/* Priority Accent Line */}
                        <div
                          className={`h-[2px] w-full rounded-full transition-colors ${currentPriorityConfig.line}`}
                          aria-hidden="true"
                        />

                        {/* Content */}
                        <p className="text-[13px] sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-normal">
                          {content.trim() || "Your message content will appear here..."}
                        </p>

                        {/* Preview-only footer marker */}
                        <div className="flex items-center justify-between pt-1 text-[11px] text-muted font-normal">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted" />
                            <span>Preview only</span>
                          </div>
                          <span className="text-[10px] text-secondary font-medium">
                            Audience: All users (Official Feed)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Fixed Form Action Footer */}
                <div className="px-6 py-3.5 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-surface">
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !content.trim() ||
                      (deliveryMode === "ANNOUNCEMENT" && !title.trim())
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background hover:opacity-90 text-xs font-semibold rounded-xl shadow-xs transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{deliveryMode === "DIRECT_MESSAGE" ? "Send to All Users" : "Send Announcement"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      {/* ─── Confirmation Modal ────────────────────────────────────────────── */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isSubmitting && setIsConfirmModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface border border-border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                  deliveryMode === "DIRECT_MESSAGE"
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {deliveryMode === "DIRECT_MESSAGE" ? (
                  <MessageSquare className="w-5 h-5" />
                ) : (
                  <Megaphone className="w-5 h-5" />
                )}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {deliveryMode === "DIRECT_MESSAGE" ? "Send Personal Message?" : "Send Announcement?"}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {deliveryMode === "DIRECT_MESSAGE"
                  ? "This message will be delivered individually to all eligible users through their Reviewer Bucket Developer conversation. Users will be able to reply."
                  : "This official message will be permanently recorded and delivered to all eligible community members in the read-only announcements feed."}
              </p>
            </div>

            {/* Summary preview inside confirmation */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted">Delivery Mode:</span>
                <span className="font-semibold text-foreground">
                  {deliveryMode === "DIRECT_MESSAGE" ? "Personal Message (Developer Chat)" : "Official Announcement"}
                </span>
              </div>

              {deliveryMode === "ANNOUNCEMENT" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Category:</span>
                    <span className="font-semibold text-foreground">{getCategoryLabel(category)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Priority:</span>
                    <span className="font-semibold text-foreground">{currentPriorityConfig.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Title:</span>
                    <span className="font-semibold text-foreground truncate max-w-[200px]">{title.trim()}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Sender Identity:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Reviewer Bucket (Developer)</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted">Audience:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">All users</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSend}
                className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:opacity-90 text-xs font-semibold rounded-xl shadow-xs transition-opacity disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSubmitting
                    ? "Sending..."
                    : deliveryMode === "DIRECT_MESSAGE"
                    ? "Confirm & Send Message"
                    : "Confirm & Send Announcement"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
