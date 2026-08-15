import { Document, Types } from "mongoose";

export interface IPrivateMessageReplyTo {
  id: string;
  _id?: string;
  senderId: string;
  content: string;
}

export interface IPrivateMessageDoc extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  senderId: string;
  content: string;
  replyTo?: Types.ObjectId | IPrivateMessageDoc | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateMessage {
  id: string;
  _id?: string;
  roomId: string;
  senderId: string;
  content: string;
  replyTo?: IPrivateMessageReplyTo | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendPrivateMessageDTO {
  content: string;
  replyTo?: string | null;
}

export interface GetPrivateMessagesResult {
  messages: IPrivateMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

