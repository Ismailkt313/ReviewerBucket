import { Document, Types } from "mongoose";

export type BroadcastMessageType = "SYSTEM_BROADCAST";
export type BroadcastAudience = "ALL_USERS";
export type BroadcastDeliveryMode = "ANNOUNCEMENT" | "DIRECT_MESSAGE";

export interface IBroadcastDoc extends Document {
  _id: Types.ObjectId;
  adminId: string;
  content: string;
  type: BroadcastMessageType;
  audience: BroadcastAudience;
  deliveryMode: BroadcastDeliveryMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBroadcast {
  id: string;
  _id?: string;
  adminId: string;
  content: string;
  type: BroadcastMessageType;
  audience: BroadcastAudience;
  deliveryMode: BroadcastDeliveryMode;
  createdAt: string;
  updatedAt: string;
}

export interface IPublicBroadcast {
  id: string;
  _id?: string;
  content: string;
  type: BroadcastMessageType;
  audience: BroadcastAudience;
  deliveryMode: BroadcastDeliveryMode;
  senderName: string;
  secondaryLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBroadcastDTO {
  content: string;
  deliveryMode?: BroadcastDeliveryMode;
}

export interface GetBroadcastsResult {
  broadcasts: IPublicBroadcast[];
  total: number;
}
