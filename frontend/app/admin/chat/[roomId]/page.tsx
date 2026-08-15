"use client";

import { useParams } from "next/navigation";
import AdminChatClient from "../AdminChatClient";

export default function AdminChatRoomPage() {
  const params = useParams();
  const roomId = typeof params?.roomId === "string" ? params.roomId : undefined;

  return <AdminChatClient selectedRoomId={roomId} />;
}
