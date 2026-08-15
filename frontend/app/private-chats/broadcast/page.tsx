"use client";

import { useRouter } from "next/navigation";
import BroadcastConversationView from "../BroadcastConversationView";

export default function MobileBroadcastPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 w-full h-full bg-background overflow-hidden">
      <BroadcastConversationView onBack={() => router.push("/private-chats")} />
    </div>
  );
}
