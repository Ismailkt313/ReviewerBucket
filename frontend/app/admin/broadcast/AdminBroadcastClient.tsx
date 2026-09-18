"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, JSX } from "react";
import {
  IAdminBroadcast,
  BroadcastDeliveryMode,
  BroadcastCategory,
  BroadcastPriority,
  BroadcastType,
  getAdminBroadcasts,
  createAdminBroadcast,
  uploadBroadcastBackground,
  uploadBroadcastPoster,
} from "@/app/services/broadcasts";
import AdminShell from "@/app/admin/components/AdminShell";
import ScrollArea from "@/app/components/ScrollArea";
import DropdownSelect from "@/app/components/DropdownSelect";
import { getSocket } from "@/app/utils/socket";
import {
  renderPosterToCanvas,
  exportPosterDataUrl,
  PRESET_BACKGROUNDS,
  PosterAspectRatio,
  PosterTextPosition,
  PosterTextAlign,
} from "@/app/utils/poster-generator";
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
  Image as ImageIcon,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Trash2,
  Palette,
  FileText,
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
  hex: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: "NORMAL",
    label: "Normal",
    badge: "text-secondary bg-neutral-100 dark:bg-neutral-800 border-border",
    line: "bg-border/90",
    dot: "bg-secondary",
    hex: "#71717a",
  },
  {
    value: "IMPORTANT",
    label: "Important",
    badge: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
    line: "bg-gradient-to-r from-sky-500 via-sky-500/80 to-sky-500/20",
    dot: "bg-sky-500",
    hex: "#0284c7",
  },
  {
    value: "HIGH",
    label: "High",
    badge: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    line: "bg-gradient-to-r from-amber-500 via-amber-500/80 to-amber-500/20",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    badge: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
    line: "bg-gradient-to-r from-rose-500 via-rose-500/80 to-rose-500/20",
    dot: "bg-rose-500",
    hex: "#e11d48",
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

  // Delivery Mode: "ANNOUNCEMENT" (official channel) | "DIRECT_MESSAGE" (personal developer message)
  const [deliveryMode, setDeliveryMode] = useState<BroadcastDeliveryMode>("ANNOUNCEMENT");

  // Broadcast Format: "TEXT" | "POSTER" (for Announcement mode)
  const [broadcastFormat, setBroadcastFormat] = useState<BroadcastType>("POSTER");

  // Common Form state
  const [title, setTitle] = useState("Reviewer Bucket is Back");
  const [content, setContent] = useState("Thank you for your patience and continued support. Explore the latest updates and community features now.");
  const [category, setCategory] = useState<BroadcastCategory>("COMMUNITY");
  const [priority, setPriority] = useState<BroadcastPriority>("NORMAL");

  // Poster-specific customisation state
  const [posterCta, setPosterCta] = useState("Explore Reviewer Bucket");
  const [posterTextPosition, setPosterTextPosition] = useState<PosterTextPosition>("center");
  const [posterTextAlign, setPosterTextAlign] = useState<PosterTextAlign>("center");
  const [posterAspectRatio, setPosterAspectRatio] = useState<PosterAspectRatio>("1:1");
  const [posterOverlayOpacity, setPosterOverlayOpacity] = useState<number>(0.65);
  const [posterPresetId, setPosterPresetId] = useState<string>("reviewer-dark");

  // Uploaded custom image state
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [uploadedBackgroundPublicId, setUploadedBackgroundPublicId] = useState<string | null>(null);
  const [uploadedImageElement, setUploadedImageElement] = useState<HTMLImageElement | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Validation and Submission state
  const [formErrors, setFormErrors] = useState<{ title?: string; content?: string; image?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Confirmation Modal state & generated confirmation preview
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [generatedConfirmationPosterUrl, setGeneratedConfirmationPosterUrl] = useState<string | null>(null);

  // Lightbox Modal state for full-screen inspection
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Mobile Tab: "composer" | "history"
  const [mobileTab, setMobileTab] = useState<"composer" | "history">("composer");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Real-time socket listener for new broadcasts
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
        (b.deliveryMode && b.deliveryMode.toLowerCase().includes(q)) ||
        (b.broadcastType && b.broadcastType.toLowerCase().includes(q))
      );
    });
  }, [broadcasts, searchQuery]);

  // Handle image upload from file picker or drag & drop
  const handleImageFile = (file: File) => {
    setImageUploadError(null);

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setImageUploadError("Unsupported image format. Please select a JPG, PNG, or WebP image.");
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError("Image size cannot exceed 5MB.");
      return;
    }

    setIsImageLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const localDataUrl = e.target?.result as string;

      try {
        // Upload draft background to Cloudinary
        const uploadResult = await uploadBroadcastBackground(localDataUrl);
        setUploadedBackgroundPublicId(uploadResult.publicId);
        setUploadedImageSrc(uploadResult.imageUrl);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setUploadedImageElement(img);
          setIsImageLoading(false);
        };
        img.onerror = () => {
          // Fallback to local data URL if cross-origin image fails
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            setUploadedImageElement(fallbackImg);
            setIsImageLoading(false);
          };
          fallbackImg.onerror = () => {
            setImageUploadError("Could not process the selected image.");
            setIsImageLoading(false);
          };
          fallbackImg.src = localDataUrl;
        };
        img.src = uploadResult.imageUrl;
      } catch (err: unknown) {
        setImageUploadError(err instanceof Error ? err.message : "Failed to upload image to Cloudinary.");
        setIsImageLoading(false);
      }
    };
    reader.onerror = () => {
      setImageUploadError("Failed to read image file.");
      setIsImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setUploadedImageSrc(null);
    setUploadedBackgroundPublicId(null);
    setUploadedImageElement(null);
    setImageUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const currentPriorityConfig = getPriorityConfig(priority);

  // Live Canvas Rendering Effect (Updates immediately as any input changes)
  useEffect(() => {
    if (deliveryMode !== "ANNOUNCEMENT" || broadcastFormat !== "POSTER" || selectedBroadcast) {
      return;
    }

    const canvas = liveCanvasRef.current;
    if (!canvas) return;

    renderPosterToCanvas(canvas, {
      title: title || "Reviewer Bucket Announcement",
      message: content || "Type your announcement message in the composer...",
      cta: posterCta,
      categoryLabel: getCategoryLabel(category),
      priorityLabel: currentPriorityConfig.label,
      priorityColor: currentPriorityConfig.hex,
      aspectRatio: posterAspectRatio,
      textPosition: posterTextPosition,
      textAlign: posterTextAlign,
      overlayOpacity: posterOverlayOpacity,
      customImageElement: uploadedImageElement,
      presetBackgroundId: posterPresetId,
    });
  }, [
    deliveryMode,
    broadcastFormat,
    selectedBroadcast,
    title,
    content,
    posterCta,
    category,
    currentPriorityConfig,
    posterAspectRatio,
    posterTextPosition,
    posterTextAlign,
    posterOverlayOpacity,
    uploadedImageElement,
    posterPresetId,
  ]);

  // Validate form based on active delivery mode and format
  const validateForm = (): boolean => {
    const errors: { title?: string; content?: string; image?: string } = {};
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
  const handleInitiateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;
    setSubmitError(null);

    // If poster broadcast, render and export the final confirmation preview
    if (deliveryMode === "ANNOUNCEMENT" && broadcastFormat === "POSTER") {
      try {
        const previewDataUrl = await exportPosterDataUrl({
          title: title.trim(),
          message: content.trim(),
          cta: posterCta.trim(),
          categoryLabel: getCategoryLabel(category),
          priorityLabel: currentPriorityConfig.label,
          priorityColor: currentPriorityConfig.hex,
          aspectRatio: posterAspectRatio,
          textPosition: posterTextPosition,
          textAlign: posterTextAlign,
          overlayOpacity: posterOverlayOpacity,
          customImageElement: uploadedImageElement,
          presetBackgroundId: posterPresetId,
        });
        setGeneratedConfirmationPosterUrl(previewDataUrl);
      } catch {
        setSubmitError("Failed to prepare poster preview. Please try again.");
        return;
      }
    } else {
      setGeneratedConfirmationPosterUrl(null);
    }

    setIsConfirmModalOpen(true);
  };

  // Confirm and send broadcast
  const handleConfirmSend = async () => {
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let finalPosterImageUrl: string | undefined = undefined;

      if (deliveryMode === "ANNOUNCEMENT" && broadcastFormat === "POSTER") {
        // 1. Generate standalone high-DPI poster data URL
        const posterDataUrl = await exportPosterDataUrl({
          title: title.trim(),
          message: content.trim(),
          cta: posterCta.trim(),
          categoryLabel: getCategoryLabel(category),
          priorityLabel: currentPriorityConfig.label,
          priorityColor: currentPriorityConfig.hex,
          aspectRatio: posterAspectRatio,
          textPosition: posterTextPosition,
          textAlign: posterTextAlign,
          overlayOpacity: posterOverlayOpacity,
          customImageElement: uploadedImageElement,
          presetBackgroundId: posterPresetId,
        });

        // 2. Upload poster image to Cloudinary storage and clean up background draft
        const uploadResult = await uploadBroadcastPoster(
          posterDataUrl,
          uploadedBackgroundPublicId || undefined
        );
        finalPosterImageUrl = uploadResult.posterImageUrl;
      }

      // 3. Create broadcast record
      const created = await createAdminBroadcast({
        title: deliveryMode === "ANNOUNCEMENT" ? title.trim() : undefined,
        content: content.trim(),
        broadcastType: deliveryMode === "ANNOUNCEMENT" && broadcastFormat === "POSTER" ? "POSTER" : "TEXT",
        posterImageUrl: finalPosterImageUrl,
        posterMetadata:
          deliveryMode === "ANNOUNCEMENT" && broadcastFormat === "POSTER"
            ? {
                cta: posterCta.trim(),
                textPosition: posterTextPosition,
                textAlign: posterTextAlign,
                aspectRatio: posterAspectRatio,
                overlayOpacity: posterOverlayOpacity,
                presetId: posterPresetId,
              }
            : undefined,
        category: deliveryMode === "ANNOUNCEMENT" ? category : "COMMUNITY",
        priority: deliveryMode === "ANNOUNCEMENT" ? priority : "NORMAL",
        audience: "ALL_USERS",
        deliveryMode,
      });

      setBroadcasts((prev) => upsertBroadcast(prev, created));
      setTitle("");
      setContent("");
      setPosterCta("");
      handleClearImage();
      setCategory("COMMUNITY");
      setPriority("NORMAL");
      setIsConfirmModalOpen(false);
      setSelectedBroadcast(created);

      if (deliveryMode === "DIRECT_MESSAGE") {
        setSuccessMessage("Personal message delivered to all users in Developer Chat.");
      } else if (broadcastFormat === "POSTER") {
        setSuccessMessage("Image-based broadcast poster published to all community members.");
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
    setTitle("Reviewer Bucket is Back");
    setContent("Thank you for your patience and continued support. Explore the latest updates and community features now.");
    setPosterCta("Explore Reviewer Bucket");
    setCategory("COMMUNITY");
    setPriority("NORMAL");
    setDeliveryMode("ANNOUNCEMENT");
    setBroadcastFormat("POSTER");
    handleClearImage();
    setFormErrors({});
    setSubmitError(null);
  };

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
            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-pointer"
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
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
        {/* ─── COLUMN 1: Broadcast History Sidebar ────── */}
        <div
          className={`w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-surface shrink-0 h-full overflow-hidden ${
            mobileTab === "history" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* History Header & Search */}
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
                  className="p-1 rounded-lg text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer"
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

          {/* History List */}
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
                  className="px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg cursor-pointer"
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
                const isPoster = broadcast.broadcastType === "POSTER" || !!broadcast.posterImageUrl;
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
                    className={`w-full text-left p-4 transition-colors relative block group focus-visible:outline-none cursor-pointer ${
                      isSelected
                        ? "bg-neutral-100 dark:bg-neutral-800 text-foreground border-l-2 border-l-foreground"
                        : "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
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

                        {isPoster && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>Poster</span>
                          </span>
                        )}
                      </div>

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

        {/* ─── COLUMN 2: Workspace Panel ────── */}
        <div
          className={`flex-1 flex flex-col bg-surface min-w-0 h-full overflow-hidden ${
            mobileTab === "composer" ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedBroadcast ? (
            /* ─── Selected Broadcast Details View ───────────────── */
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
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
                        {selectedBroadcast.broadcastType === "POSTER" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                            <ImageIcon className="w-3 h-3" />
                            <span>Visual Poster</span>
                          </span>
                        )}
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold rounded-xl text-foreground transition-colors shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New</span>
                </button>
              </div>

              {/* Body */}
              <ScrollArea className="flex-1 p-6 space-y-6 overflow-y-auto">
                {selectedBroadcast.posterImageUrl ? (
                  /* Poster Announcement Detail Display */
                  <div className="space-y-4 max-w-xl mx-auto">
                    <div className="relative rounded-2xl overflow-hidden border border-border bg-neutral-900 shadow-md group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedBroadcast.posterImageUrl}
                        alt={selectedBroadcast.title || "Announcement Poster"}
                        className="w-full h-auto object-cover max-h-[500px]"
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxImageUrl(selectedBroadcast.posterImageUrl || null)}
                        className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer shadow-lg"
                        title="View Full Size"
                        aria-label="View Full Size"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-border text-xs text-muted space-y-1">
                      <p className="font-semibold text-foreground">{selectedBroadcast.title}</p>
                      <p className="leading-relaxed">{selectedBroadcast.content}</p>
                    </div>
                  </div>
                ) : selectedBroadcast.deliveryMode === "DIRECT_MESSAGE" ? (
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
                  </div>
                ) : (
                  /* Standard Text Announcement View */
                  <div className="space-y-4">
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
                  </div>
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
            /* ─── Create Broadcast Composer (2-Column Desktop Layout) ───────────────────────── */
            <form onSubmit={handleInitiateSend} className="flex flex-col h-full overflow-hidden">
              {/* Fixed Composer Header */}
              <div className="px-6 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-foreground">
                    Create Broadcast
                  </h2>
                  <p className="text-[11px] text-muted leading-tight">
                    Publish an official visual announcement, standard text notice, or personal message.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] text-muted border border-border shrink-0">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span>Live broadcast</span>
                </div>
              </div>

              {/* Submit Error Banner */}
              {submitError && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* ─── Mode & Format Switcher Bar ────────────────────────────── */}
              <div className="px-6 py-3 border-b border-border/80 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
                {/* Delivery Mode Choice */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800/80 border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("ANNOUNCEMENT")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      deliveryMode === "ANNOUNCEMENT"
                        ? "bg-surface text-foreground shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>Official Announcement</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("DIRECT_MESSAGE")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      deliveryMode === "DIRECT_MESSAGE"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Personal Message</span>
                  </button>
                </div>

                {/* Broadcast Format Choice (Only when in Announcement mode) */}
                {deliveryMode === "ANNOUNCEMENT" && (
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800/80 border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setBroadcastFormat("POSTER")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        broadcastFormat === "POSTER"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Poster Broadcast</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastFormat("TEXT")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        broadcastFormat === "TEXT"
                          ? "bg-surface text-foreground shadow-xs"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Text Broadcast</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ─── Composer Body (2-Column on Desktop for Poster, Single Stack for Text) ─── */}
              {deliveryMode === "ANNOUNCEMENT" && broadcastFormat === "POSTER" ? (
                /* ─── 2-COLUMN LIVE POSTER COMPOSER ─── */
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
                  {/* LEFT COLUMN: Controls (Scrollable) */}
                  <div className="lg:col-span-7 flex flex-col h-full border-b lg:border-b-0 lg:border-r border-border overflow-hidden bg-surface">
                    <ScrollArea className="flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">
                      {/* 1. Image Source Controls */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-foreground">
                            Poster Image / Background
                          </label>
                          {uploadedImageSrc && (
                            <button
                              type="button"
                              onClick={handleClearImage}
                              className="text-[11px] text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove custom image</span>
                            </button>
                          )}
                        </div>

                        {/* Drag and drop upload zone */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleImageFile(e.dataTransfer.files[0]);
                            }
                          }}
                          className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 ${
                            uploadedImageSrc
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-border hover:border-foreground/40 bg-neutral-50/50 dark:bg-neutral-900/30"
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleImageFile(e.target.files[0]);
                              }
                            }}
                          />

                          {isImageLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                          ) : uploadedImageSrc ? (
                            <div className="flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Custom image uploaded (Click to change)</span>
                            </div>
                          ) : (
                            <>
                              <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-muted">
                                <Upload className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground">
                                  Upload custom image or drag & drop
                                </p>
                                <p className="text-[10px] text-muted">JPG, PNG, WEBP (Max 5MB)</p>
                              </div>
                            </>
                          )}
                        </div>

                        {imageUploadError && (
                          <p className="text-[11px] text-rose-500">{imageUploadError}</p>
                        )}

                        {/* Preset Background Styles (when no custom image or as alternative) */}
                        {!uploadedImageSrc && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                              <Palette className="w-3 h-3" />
                              <span>Or choose brand backdrop style:</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {PRESET_BACKGROUNDS.map((preset) => (
                                <button
                                  type="button"
                                  key={preset.id}
                                  onClick={() => setPosterPresetId(preset.id)}
                                  className={`p-2 rounded-xl border text-left text-[11px] transition-all flex items-center gap-2 cursor-pointer ${
                                    posterPresetId === preset.id
                                      ? "border-foreground bg-neutral-100 dark:bg-neutral-800 ring-1 ring-foreground/20 font-bold"
                                      : "border-border hover:border-neutral-400 dark:hover:border-neutral-600 bg-background text-muted"
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                                    style={{
                                      background: `linear-gradient(135deg, ${preset.gradientColors[0]}, ${preset.gradientColors[1]})`,
                                    }}
                                  />
                                  <span className="truncate">{preset.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Announcement Content Fields */}
                      <div className="space-y-3.5 pt-1">
                        {/* Title */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="poster-title" className="block text-xs font-semibold text-foreground">
                              Announcement Title <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-muted tabular-nums">
                              {title.length}/100
                            </span>
                          </div>
                          <input
                            id="poster-title"
                            type="text"
                            placeholder="e.g. Reviewer Bucket is Back"
                            maxLength={100}
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: undefined }));
                            }}
                            className={`w-full px-3.5 py-2 text-xs sm:text-sm bg-background border rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 ${
                              formErrors.title ? "border-rose-500 focus:ring-rose-500/20" : "border-border focus:ring-foreground/20"
                            }`}
                          />
                          {formErrors.title && <p className="text-[11px] text-rose-500 mt-1">{formErrors.title}</p>}
                        </div>

                        {/* Message */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="poster-message" className="block text-xs font-semibold text-foreground">
                              Message Content <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-muted tabular-nums">
                              {content.length}/500
                            </span>
                          </div>
                          <textarea
                            id="poster-message"
                            rows={3}
                            placeholder="e.g. Thank you for your patience and continued support..."
                            maxLength={500}
                            value={content}
                            onChange={(e) => {
                              setContent(e.target.value);
                              if (formErrors.content) setFormErrors((prev) => ({ ...prev, content: undefined }));
                            }}
                            className={`w-full px-3.5 py-2 text-xs sm:text-sm bg-background border rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 resize-y ${
                              formErrors.content ? "border-rose-500 focus:ring-rose-500/20" : "border-border focus:ring-foreground/20"
                            }`}
                          />
                          {formErrors.content && <p className="text-[11px] text-rose-500 mt-1">{formErrors.content}</p>}
                        </div>

                        {/* Optional CTA */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="poster-cta" className="block text-xs font-semibold text-foreground">
                              Call To Action Pill <span className="text-muted font-normal">(Optional)</span>
                            </label>
                            <span className="text-[10px] text-muted tabular-nums">{posterCta.length}/40</span>
                          </div>
                          <input
                            id="poster-cta"
                            type="text"
                            placeholder="e.g. Explore Reviewer Bucket"
                            maxLength={40}
                            value={posterCta}
                            onChange={(e) => setPosterCta(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                          />
                        </div>
                      </div>

                      {/* 3. Formatting, Alignment & Contrast Controls */}
                      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-border space-y-3.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-secondary block">
                          Poster Presentation Controls
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Text Position */}
                          <div>
                            <label className="block text-[11px] font-semibold text-foreground mb-1">
                              Text Position
                            </label>
                            <div className="flex rounded-xl bg-background border border-border p-0.5 text-xs">
                              {(["top", "center", "bottom"] as PosterTextPosition[]).map((pos) => (
                                <button
                                  type="button"
                                  key={pos}
                                  onClick={() => setPosterTextPosition(pos)}
                                  className={`flex-1 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                                    posterTextPosition === pos
                                      ? "bg-foreground text-background shadow-xs"
                                      : "text-muted hover:text-foreground"
                                  }`}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Text Alignment */}
                          <div>
                            <label className="block text-[11px] font-semibold text-foreground mb-1">
                              Text Alignment
                            </label>
                            <div className="flex rounded-xl bg-background border border-border p-0.5 text-xs">
                              <button
                                type="button"
                                onClick={() => setPosterTextAlign("left")}
                                className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  posterTextAlign === "left"
                                    ? "bg-foreground text-background shadow-xs"
                                    : "text-muted hover:text-foreground"
                                }`}
                                title="Align Left"
                              >
                                <AlignLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPosterTextAlign("center")}
                                className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  posterTextAlign === "center"
                                    ? "bg-foreground text-background shadow-xs"
                                    : "text-muted hover:text-foreground"
                                }`}
                                title="Align Center"
                              >
                                <AlignCenter className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPosterTextAlign("right")}
                                className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  posterTextAlign === "right"
                                    ? "bg-foreground text-background shadow-xs"
                                    : "text-muted hover:text-foreground"
                                }`}
                                title="Align Right"
                              >
                                <AlignRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Aspect Ratio */}
                          <div>
                            <label className="block text-[11px] font-semibold text-foreground mb-1">
                              Aspect Ratio
                            </label>
                            <div className="flex rounded-xl bg-background border border-border p-0.5 text-xs">
                              {(["1:1", "16:9", "4:5"] as PosterAspectRatio[]).map((ratio) => (
                                <button
                                  type="button"
                                  key={ratio}
                                  onClick={() => setPosterAspectRatio(ratio)}
                                  className={`flex-1 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                                    posterAspectRatio === ratio
                                      ? "bg-foreground text-background shadow-xs"
                                      : "text-muted hover:text-foreground"
                                  }`}
                                >
                                  {ratio}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Overlay Darkness / Contrast slider */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-foreground">Overlay Contrast Darkness</span>
                            <span className="text-muted tabular-nums">
                              {Math.round(posterOverlayOpacity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="0.95"
                            step="0.05"
                            value={posterOverlayOpacity}
                            onChange={(e) => setPosterOverlayOpacity(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-foreground"
                          />
                        </div>
                      </div>

                      {/* 4. Classification: Category & Priority */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <DropdownSelect<BroadcastCategory>
                          id="poster-category"
                          label="Category"
                          helperText="Classification badge"
                          options={CATEGORY_OPTIONS.map((cat) => ({
                            value: cat.value,
                            label: cat.label,
                            description: cat.description,
                          }))}
                          value={category}
                          onChange={(val) => setCategory(val)}
                        />

                        <DropdownSelect<BroadcastPriority>
                          id="poster-priority"
                          label="Priority"
                          helperText="Accent tone"
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
                    </ScrollArea>
                  </div>

                  {/* RIGHT COLUMN: Live Poster Preview Panel */}
                  <div className="lg:col-span-5 flex flex-col h-full bg-neutral-900/60 dark:bg-black/60 p-4 sm:p-6 overflow-y-auto items-center justify-center relative">
                    <div className="w-full flex items-center justify-between gap-2 mb-3 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Poster Preview</span>
                      </div>
                      <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                        Real-time Canvas
                      </span>
                    </div>

                    {/* Live Rendered Canvas */}
                    <div className="relative w-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/80 max-h-[500px]">
                      <canvas
                        ref={liveCanvasRef}
                        className="max-w-full h-auto object-contain select-none"
                        style={{ maxHeight: "480px" }}
                      />
                    </div>

                    <p className="text-[11px] text-white/60 text-center mt-3">
                      The generated poster above will be delivered directly to the community feed.
                    </p>
                  </div>
                </div>
              ) : (
                /* ─── STANDARD TEXT / DIRECT MESSAGE COMPOSER ─── */
                <ScrollArea className="flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">
                  {deliveryMode === "ANNOUNCEMENT" ? (
                    <>
                      {/* Grid Group: Category & Priority */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          <label htmlFor="broadcast-title" className="block text-xs font-semibold text-foreground">
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
                            formErrors.title ? "border-rose-500 focus:ring-rose-500/20" : "border-border focus:ring-foreground/20"
                          }`}
                        />
                        {formErrors.title && <p className="text-[11px] text-rose-500 mt-1">{formErrors.title}</p>}
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
                      <label htmlFor="broadcast-content" className="block text-xs font-semibold text-foreground">
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
                        formErrors.content ? "border-rose-500 focus:ring-rose-500/20" : "border-border focus:ring-foreground/20"
                      }`}
                    />
                    {formErrors.content && <p className="text-[11px] text-rose-500 mt-1">{formErrors.content}</p>}
                  </div>

                  {/* Text Live Preview */}
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2.5">
                      <Eye className="w-3.5 h-3.5 text-secondary" />
                      <span>Live Preview</span>
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

                        <div className="flex items-start gap-2.5">
                          <div className="max-w-[85%] rounded-2xl rounded-tl-xs px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-foreground text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs">
                            {content.trim() || "Hi 👋 I'm the developer behind Reviewer Bucket. Is there anything you'd like to see improved?"}
                            <div className="text-[9px] text-muted text-right mt-1">Just now</div>
                          </div>
                        </div>

                        <div className="p-2 rounded-xl bg-background border border-border flex items-center justify-between text-muted text-xs cursor-not-allowed select-none opacity-80">
                          <span className="text-[11px] pl-2">Users can reply to developer here...</span>
                          <div className="p-1 rounded-lg bg-foreground/10 text-foreground">
                            <CornerDownLeft className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Live Preview for Text Announcement */
                      <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-3.5 relative">
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

                        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight leading-snug break-words">
                          {title.trim() || "Announcement Title"}
                        </h3>

                        <div
                          className={`h-[2px] w-full rounded-full transition-colors ${currentPriorityConfig.line}`}
                          aria-hidden="true"
                        />

                        <p className="text-[13px] sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-normal">
                          {content.trim() || "Your message content will appear here..."}
                        </p>

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
              )}

              {/* Fixed Action Footer */}
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
                  <span>
                    {deliveryMode === "DIRECT_MESSAGE"
                      ? "Send to All Users"
                      : broadcastFormat === "POSTER"
                      ? "Send Poster Broadcast"
                      : "Send Announcement"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ─── Final Confirmation Modal with Standalone Poster Preview ────────── */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isSubmitting && setIsConfirmModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface border border-border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="space-y-1.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                  deliveryMode === "DIRECT_MESSAGE"
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : broadcastFormat === "POSTER"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {deliveryMode === "DIRECT_MESSAGE" ? (
                  <MessageSquare className="w-5 h-5" />
                ) : broadcastFormat === "POSTER" ? (
                  <ImageIcon className="w-5 h-5" />
                ) : (
                  <Megaphone className="w-5 h-5" />
                )}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {deliveryMode === "DIRECT_MESSAGE"
                  ? "Send Personal Message?"
                  : broadcastFormat === "POSTER"
                  ? "Send Poster Broadcast to Community?"
                  : "Send Announcement?"}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {deliveryMode === "DIRECT_MESSAGE"
                  ? "This message will be delivered individually to all eligible users through their Reviewer Bucket Developer conversation."
                  : "This announcement will be permanently published to all community members in the official announcements feed."}
              </p>
            </div>

            {/* If Poster broadcast, display generated poster in confirmation */}
            {generatedConfirmationPosterUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-neutral-900 shadow-sm max-h-64 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedConfirmationPosterUrl}
                  alt="Final Poster Preview"
                  className="max-h-64 w-auto object-contain"
                />
              </div>
            )}

            {/* Summary details */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted">Broadcast Type:</span>
                <span className="font-semibold text-foreground">
                  {deliveryMode === "DIRECT_MESSAGE"
                    ? "Personal Message (Developer Chat)"
                    : broadcastFormat === "POSTER"
                    ? "Visual Poster Announcement"
                    : "Standard Text Announcement"}
                </span>
              </div>

              {deliveryMode === "ANNOUNCEMENT" && (
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
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted">Audience:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">All users</span>
              </div>
            </div>

            {/* Action buttons */}
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
                    ? "Publishing..."
                    : deliveryMode === "DIRECT_MESSAGE"
                    ? "Confirm & Send Message"
                    : "Confirm & Publish Broadcast"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Lightbox Modal for Poster Zoom ─────────────────────────────────── */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImageUrl}
            alt="Full size poster"
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </AdminShell>
  );
}
