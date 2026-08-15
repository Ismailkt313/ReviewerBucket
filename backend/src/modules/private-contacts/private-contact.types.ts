import { Document, Types } from "mongoose";

export interface IPrivateContactDoc extends Document {
  _id: Types.ObjectId;
  ownerId: string;
  contactId: string;
  nickname: string | null;
  normalizedNickname: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateContact {
  id: string;
  _id?: string;
  ownerId: string;
  contactId: string;
  nickname: string | null;
  normalizedNickname: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactIdentityResponse {
  contactId: string;
  displayName: string;
  nickname: string | null;
  isCustomName: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RenameContactDTO {
  nickname?: string | null;
}
