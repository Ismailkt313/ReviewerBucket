import { Schema, model } from "mongoose";
import type { ICommunityMessageDoc } from "./community.types";

const communityMessageSchema = new Schema<ICommunityMessageDoc>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 500
    },
    anonymousClientId: {
      type: String,
      required: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

communityMessageSchema.index({ createdAt: -1, _id: -1 });

export const CommunityMessageModel = model<ICommunityMessageDoc>(
  "CommunityMessage",
  communityMessageSchema
);
