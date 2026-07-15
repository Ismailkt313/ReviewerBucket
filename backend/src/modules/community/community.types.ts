import { Document } from "mongoose";

export interface ICommunityMessage {
  _id: string;
  content: string;
  anonymousClientId?: string;
  createdAt: Date;
}

export interface ICommunityMessageDoc extends Document {
  content: string;
  anonymousClientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalCommunityMessage {
  id: string;
  content: string;
  createdAt: string;
  anonymousClientId?: string;
}

export interface PublicCommunityMessage {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
}

export interface ClientToServerEvents {
  "community:message:send": (
    payload: { content: string },
    ack: (response: { success: boolean; message?: string; messageId?: string }) => void
  ) => void;
  "community:history:request": () => void;
}

export interface ServerToClientEvents {
  "community:message:new": (message: PublicCommunityMessage) => void;
  "community:history": (payload: { messages: PublicCommunityMessage[] }) => void;
  "community:online-count": (payload: { count: number }) => void;
  "community:error": (payload: { message: string }) => void;
}
