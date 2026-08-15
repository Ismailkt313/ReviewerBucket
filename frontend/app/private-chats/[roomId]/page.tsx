import type { Metadata } from "next";
import ConversationPageClient from "./ConversationPageClient";

type Props = {
  params: Promise<{ roomId: string }>;
};

export const metadata: Metadata = {
  title: "Private Chat | Reviewer Bucket",
  description: "Anonymous private conversation.",
  robots: { index: false, follow: false }
};

export default async function ConversationPage({ params }: Props) {
  const { roomId } = await params;
  return <ConversationPageClient roomId={roomId} />;
}
