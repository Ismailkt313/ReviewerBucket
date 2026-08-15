"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVisualViewport } from "@/app/hooks/useVisualViewport";
import ConversationView from "../ConversationView";

interface ConversationPageClientProps {
  roomId: string;
}

export default function ConversationPageClient({ roomId }: ConversationPageClientProps) {
  const router = useRouter();
  useVisualViewport();

  const handleBack = useCallback(() => {
    // Navigate back to the conversation list
    router.push("/private-chats");
  }, [router]);

  return (
    <div
      className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        height: "var(--visual-viewport-height, 100dvh)",
        transform: "translateY(var(--visual-viewport-offset-top, 0px))"
      }}
    >
      <ConversationView roomId={roomId} onBack={handleBack} />
    </div>
  );
}
