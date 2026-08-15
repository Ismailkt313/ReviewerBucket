"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Wrench,
  Megaphone,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useVisualViewport } from "@/app/hooks/useVisualViewport";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";
import ConversationList from "./ConversationList";
import ConversationView from "./ConversationView";
import BroadcastConversationView from "./BroadcastConversationView";
import { IPrivateRoom, createOrGetDeveloperRoom } from "@/app/services/private-rooms";
import { ContactIdentityResponse } from "@/app/services/private-contacts";

const NOTICE_STORAGE_KEY = "reviewerBucket:privateChatNoticeDismissed";

// ─── Empty right-panel state (desktop only) ────────────────────────────────────

interface SelectConversationPromptProps {
  onSelectBroadcast: () => void;
  onOpenDeveloperChat: () => void;
  isOpeningDev?: boolean;
}

function SelectConversationPrompt({
  onSelectBroadcast,
  onOpenDeveloperChat,
  isOpeningDev,
}: SelectConversationPromptProps) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center text-center select-none px-8 py-12 bg-background/50">
      <div className="max-w-md w-full space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
          <MessageSquare className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-foreground tracking-tight">
            Select a Conversation
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-sm mx-auto">
            Choose a private 1-on-1 chat or review official announcements from the sidebar.
          </p>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
          <button
            type="button"
            onClick={onOpenDeveloperChat}
            disabled={isOpeningDev}
            className="p-3.5 rounded-xl border border-border bg-surface hover:bg-elevated transition-colors text-left group focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground group-hover:text-blue-500 transition-colors">
                Message Developer
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Get direct developer support or report an issue anonymously.
            </p>
          </button>

          <button
            type="button"
            onClick={onSelectBroadcast}
            className="p-3.5 rounded-xl border border-border bg-surface hover:bg-elevated transition-colors text-left group focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground group-hover:text-blue-500 transition-colors">
                Announcements
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              View official updates, feature releases, and system alerts.
            </p>
          </button>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-[11px] text-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>All chats are end-to-end anonymous and private.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

interface PrivateChatsClientProps {
  initialRoomId?: string | null;
}

export default function PrivateChatsClient({ initialRoomId = null }: PrivateChatsClientProps) {
  const router = useRouter();
  useVisualViewport();

  const [clientId, setClientId] = useState<string | null>(null);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId);
  const [contactsMap, setContactsMap] = useState<Record<string, ContactIdentityResponse>>({});
  const [showNotice, setShowNotice] = useState(false);
  const [isOpeningDev, setIsOpeningDev] = useState(false);

  // Sync initialRoomId when prop changes
  useEffect(() => {
    if (initialRoomId !== undefined) {
      setSelectedRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  // Check anonymous session on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const id = getAnonymousClientId();
      setClientId(id);
      setHasCheckedSession(true);

      const dismissed = localStorage.getItem(NOTICE_STORAGE_KEY);
      if (!dismissed) {
        setShowNotice(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleDismissNotice = useCallback(() => {
    localStorage.setItem(NOTICE_STORAGE_KEY, "true");
    setShowNotice(false);
  }, []);

  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleSelectRoom = useCallback(
    (room: IPrivateRoom) => {
      setSelectedRoomId(room.id);
      if (typeof window !== "undefined") {
        if (window.innerWidth >= 768) {
          window.history.pushState(null, "", `/private-chats/${room.id}`);
        } else {
          router.push(`/private-chats/${room.id}`);
        }
      }
    },
    [router]
  );

  const handleSelectBroadcast = useCallback(() => {
    setSelectedRoomId("broadcast");
    if (typeof window !== "undefined") {
      if (window.innerWidth >= 768) {
        window.history.pushState(null, "", "/private-chats/broadcast");
      } else {
        router.push("/private-chats/broadcast");
      }
    }
  }, [router]);

  const handleOpenDeveloperChat = useCallback(async () => {
    setIsOpeningDev(true);
    try {
      const room = await createOrGetDeveloperRoom();
      setSelectedRoomId(room.id);
      if (typeof window !== "undefined") {
        if (window.innerWidth >= 768) {
          window.history.pushState(null, "", `/private-chats/${room.id}`);
        } else {
          router.push(`/private-chats/${room.id}`);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsOpeningDev(false);
    }
  }, [router]);

  const handleBackFromConversation = useCallback(() => {
    setSelectedRoomId(null);
    if (typeof window !== "undefined") {
      if (window.innerWidth >= 768) {
        window.history.pushState(null, "", "/private-chats");
      } else {
        router.push("/private-chats");
      }
    }
  }, [router]);

  const handleContactUpdate = useCallback((updated: ContactIdentityResponse) => {
    setContactsMap((prev) => ({
      ...prev,
      [updated.contactId]: updated,
    }));
  }, []);

  // ── Session loss state ──────────────────────────────────────────────────────
  if (hasCheckedSession && !clientId) {
    return (
      <div
        className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-background text-foreground"
        style={{
          height: "var(--visual-viewport-height, 100dvh)",
          transform: "translateY(var(--visual-viewport-offset-top, 0px))",
        }}
      >
        <header className="relative z-50 flex-shrink-0 border-b border-border bg-surface/95 backdrop-blur-xs">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">
              Private Chats
            </h1>
          </div>
        </header>

        <div className="flex flex-col flex-1 items-center justify-center text-center select-none px-6 py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-muted mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-foreground mb-1">
            Anonymous session unavailable
          </h2>
          <p className="text-xs text-muted max-w-[280px] mb-5 leading-relaxed">
            This browser no longer has access to the anonymous identity used for these private chats.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        height: "var(--visual-viewport-height, 100dvh)",
        transform: "translateY(var(--visual-viewport-offset-top, 0px))",
      }}
    >
      {/* Top Navbar Header */}
      <header className="relative z-50 flex-shrink-0 border-b border-border bg-surface/95 backdrop-blur-xs">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
              aria-label="Go back to home"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-foreground tracking-tight">
                  Private Messages
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Active Session
                </span>
              </div>
              <p className="text-[10px] text-muted leading-tight">
                End-to-end anonymous 1-on-1 private messaging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/community"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-secondary hover:text-foreground hover:bg-elevated transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Community Chat</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Conversation List Sidebar */}
        {/* On desktop: ALWAYS visible (md:flex md:w-80 lg:w-96). On mobile: visible when no room selected */}
        <div
          className={`${
            selectedRoomId ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 lg:w-96 md:border-r border-border overflow-hidden bg-surface flex-shrink-0`}
        >
          {/* Educational notice banner */}
          {showNotice && (
            <div className="m-3 p-3 rounded-xl border border-border/80 bg-surface/90 backdrop-blur-xs text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground leading-tight text-xs">
                    Anonymous Private Messaging
                  </h3>
                  <p className="text-muted text-[11px] leading-relaxed mt-0.5">
                    Your session is tied to this browser. You can message anyone privately or contact the developer.
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleDismissNotice}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
                >
                  <span>Got it</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <ConversationList
            selectedRoomId={selectedRoomId}
            contactsMap={contactsMap}
            onSelect={handleSelectRoom}
            onSelectBroadcast={handleSelectBroadcast}
          />
        </div>

        {/* Right Column: Active Conversation Workspace */}
        {/* On desktop: ALWAYS visible (md:flex flex-1). On mobile: visible when room is selected */}
        <div
          className={`${
            selectedRoomId ? "flex" : "hidden md:flex"
          } flex-1 flex-col overflow-hidden bg-background min-w-0`}
        >
          {selectedRoomId === "broadcast" ? (
            <BroadcastConversationView onBack={handleBackFromConversation} />
          ) : selectedRoomId ? (
            <ConversationView
              key={selectedRoomId}
              roomId={selectedRoomId}
              onBack={handleBackFromConversation}
              onContactUpdate={handleContactUpdate}
              initialContactIdentity={undefined}
            />
          ) : (
            <SelectConversationPrompt
              onSelectBroadcast={handleSelectBroadcast}
              onOpenDeveloperChat={handleOpenDeveloperChat}
              isOpeningDev={isOpeningDev}
            />
          )}
        </div>
      </div>
    </div>
  );
}
