import type { Metadata } from "next";
import PrivateChatsClient from "./PrivateChatsClient";

export const metadata: Metadata = {
  title: "Private Chats | Reviewer Bucket",
  description: "Your anonymous private conversations.",
  robots: { index: false, follow: false }
};

export default function PrivateChatsPage() {
  return <PrivateChatsClient />;
}
