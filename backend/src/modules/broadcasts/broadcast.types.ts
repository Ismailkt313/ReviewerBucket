import { Document, Types } from "mongoose";

export type BroadcastMessageType = "SYSTEM_BROADCAST";
export type BroadcastAudience = "ALL_USERS";
export type BroadcastDeliveryMode = "ANNOUNCEMENT" | "DIRECT_MESSAGE";
export type BroadcastType = "TEXT" | "POSTER";

export type BroadcastCategory =
  | "FEATURE_UPDATE"
  | "COMMUNITY"
  | "IMPORTANT"
  | "SYSTEM"
  | "PRODUCT_UPDATE";

export type BroadcastPriority = "NORMAL" | "IMPORTANT" | "HIGH" | "CRITICAL";

export interface IBroadcastDoc extends Document {
  _id: Types.ObjectId;
  adminId: string;
  title: string;
  content: string;
  type: BroadcastMessageType;
  broadcastType?: BroadcastType;
  posterImageUrl?: string;
  posterMetadata?: Record<string, unknown>;
  category: BroadcastCategory;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  deliveryMode: BroadcastDeliveryMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBroadcast {
  id: string;
  _id?: string;
  adminId: string;
  title: string;
  content: string;
  type: BroadcastMessageType;
  broadcastType?: BroadcastType;
  posterImageUrl?: string;
  posterMetadata?: Record<string, unknown>;
  category: BroadcastCategory;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  deliveryMode: BroadcastDeliveryMode;
  createdAt: string;
  updatedAt: string;
}

export interface IPublicBroadcast {
  id: string;
  _id?: string;
  title: string;
  content: string;
  type: BroadcastMessageType;
  broadcastType?: BroadcastType;
  posterImageUrl?: string;
  posterMetadata?: Record<string, unknown>;
  category: BroadcastCategory;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  deliveryMode: BroadcastDeliveryMode;
  senderName: string;
  secondaryLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBroadcastDTO {
  title?: string;
  content: string;
  broadcastType?: BroadcastType;
  posterImageUrl?: string;
  posterMetadata?: Record<string, unknown>;
  category?: BroadcastCategory;
  priority?: BroadcastPriority;
  audience?: BroadcastAudience;
  deliveryMode?: BroadcastDeliveryMode;
}

export interface GetBroadcastsResult {
  broadcasts: IPublicBroadcast[];
  total: number;
}
