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
    <div className="flex flex-col flex-1 items-center justify-center text-center select-none px-8 py-12 bg-black">
      <div className="max-w-md w-full space-y-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-neutral-300 flex items-center justify-center">
          <MessageSquare className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Select a Conversation
          </h2>
          <p className="text-xs text-neutral-500 font-normal leading-relaxed max-w-sm mx-auto">
            Choose a private 1-on-1 chat or review official announcements from the sidebar.
          </p>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
          <button
            type="button"
            onClick={onOpenDeveloperChat}
            disabled={isOpeningDev}
            className="p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-colors text-left group focus:outline-none disabled:opacity-50"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-neutral-300 flex items-center justify-center">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-white group-hover:text-white transition-colors">
                Message Developer
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-normal leading-snug">
              Get direct developer support or report an issue anonymously.
            </p>
          </button>

          <button
            type="button"
            onClick={onSelectBroadcast}
            className="p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-colors text-left group focus:outline-none"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-neutral-300 flex items-center justify-center">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-white group-hover:text-white transition-colors">
                Announcements
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-normal leading-snug">
              View official updates, feature releases, and system alerts.
            </p>
          </button>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/10 text-[11px] text-neutral-500 font-normal">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
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

  // Popstate listener for seamless browser/hardware back button handling
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const match = path.match(/\/private-chats\/(.+)/);
        if (match && match[1]) {
          setSelectedRoomId(match[1]);
        } else {
          setSelectedRoomId(null);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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
        window.history.pushState({ roomId: room.id }, "", `/private-chats/${room.id}`);
      }
    },
    []
  );

  const handleSelectBroadcast = useCallback(() => {
    setSelectedRoomId("broadcast");
    if (typeof window !== "undefined") {
      window.history.pushState({ roomId: "broadcast" }, "", "/private-chats/broadcast");
    }
  }, []);

  const handleOpenDeveloperChat = useCallback(async () => {
    setIsOpeningDev(true);
    try {
      const room = await createOrGetDeveloperRoom();
      setSelectedRoomId(room.id);
      if (typeof window !== "undefined") {
        window.history.pushState({ roomId: room.id }, "", `/private-chats/${room.id}`);
      }
    } catch {
      // ignore
    } finally {
      setIsOpeningDev(false);
    }
  }, []);

  const handleBackFromConversation = useCallback(() => {
    setSelectedRoomId(null);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/private-chats");
    }
  }, []);

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
        className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-black text-white"
        style={{
          height: "var(--visual-viewport-height, 100dvh)",
          transform: "translateY(var(--visual-viewport-offset-top, 0px))",
        }}
      >
        <header className="relative z-50 flex-shrink-0 border-b border-white/5 bg-black/90 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 rounded-full border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold text-white tracking-tight">
              Private Chats
            </h1>
          </div>
        </header>

        <div className="flex flex-col flex-1 items-center justify-center text-center select-none px-6 py-12 bg-black">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-neutral-400 mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-white mb-1">
            Anonymous session unavailable
          </h2>
          <p className="text-xs text-neutral-500 font-normal max-w-[280px] mb-5 leading-relaxed">
            This browser no longer has access to the anonymous identity used for these private chats.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-semibold px-4 py-2 transition-colors focus-visible:outline-none"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-black text-white"
      style={{
        height: "var(--visual-viewport-height, 100dvh)",
        transform: "translateY(var(--visual-viewport-offset-top, 0px))",
      }}
    >
      {/* Top Navbar Header */}
      <header className="relative z-50 flex-shrink-0 border-b border-white/5 bg-black/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 rounded-full border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Go back to home"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-white tracking-tight">
                  Private Messages
                </h1>
                <span className="border border-white/10 text-neutral-400 bg-transparent text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full">
                  Active Session
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-normal leading-tight">
                End-to-end anonymous 1-on-1 private messaging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/community"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
              <span>Community Chat</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden bg-black">
        {/* Left Column: Conversation List Sidebar */}
        <div
          className={`${
            selectedRoomId ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 lg:w-96 md:border-r border-white/5 overflow-hidden bg-black flex-shrink-0`}
        >
          {/* Educational notice banner */}
          {showNotice && (
            <div className="m-3 p-3.5 rounded-2xl border border-white/10 bg-white/5 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white leading-tight text-xs">
                    Anonymous Private Messaging
                  </h3>
                  <p className="text-neutral-500 font-normal text-[11px] leading-relaxed mt-0.5">
                    Your session is tied to this browser. You can message anyone privately or contact the developer.
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleDismissNotice}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-black hover:bg-neutral-200 text-[11px] font-medium transition-colors"
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
        <div
          className={`${
            selectedRoomId ? "flex" : "hidden md:flex"
          } flex-1 flex-col overflow-hidden bg-black min-w-0`}
        >
          {selectedRoomId === "broadcast" ? (
            <BroadcastConversationView onBack={handleBackFromConversation} />
          ) : selectedRoomId ? (
            <ConversationView
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

