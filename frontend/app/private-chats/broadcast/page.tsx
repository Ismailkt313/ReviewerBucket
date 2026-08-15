import type { Metadata } from "next";
import PrivateChatsClient from "../PrivateChatsClient";

export const metadata: Metadata = {
  title: "Official Announcements | Reviewer Bucket",
  description: "Official Reviewer Bucket announcement channel.",
  robots: { index: false, follow: false },
};

export default function BroadcastPage() {
  return <PrivateChatsClient initialRoomId="broadcast" />;
}
