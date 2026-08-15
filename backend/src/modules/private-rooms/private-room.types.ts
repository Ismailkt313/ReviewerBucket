import { Document, Types } from "mongoose";

export interface IPrivateRoomDoc extends Document {
  _id: Types.ObjectId;
  participants: [string, string];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateRoomLastMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface IPrivateRoom {
  id: string;
  _id?: string;
  participants: [string, string];
  displayParticipants?: [string, string];
  anonymousDisplayId?: string;
  adminLabel?: string;
  unreadCount?: number;
  lastMessage?: IPrivateRoomLastMessage | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrivateRoomDTO {
  targetUserId: string;
}
