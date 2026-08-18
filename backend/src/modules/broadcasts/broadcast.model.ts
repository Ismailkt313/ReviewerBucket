import { Schema, model } from "mongoose";
import type { IBroadcastDoc } from "./broadcast.types.js";

const broadcastSchema = new Schema<IBroadcastDoc>(
  {
    adminId: {
      type: String,
      required: true,
      default: "admin",
      trim: true
    },
    title: {
      type: String,
      required: false,
      default: "",
      maxlength: 200,
      trim: true
    },
    content: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 2000,
      trim: true
    },
    type: {
      type: String,
      enum: ["SYSTEM_BROADCAST"],
      default: "SYSTEM_BROADCAST",
      required: true
    },
    category: {
      type: String,
      enum: [
        "FEATURE_UPDATE",
        "COMMUNITY",
        "IMPORTANT",
        "SYSTEM",
        "PRODUCT_UPDATE"
      ],
      default: "COMMUNITY",
      required: true
    },
    priority: {
      type: String,
      enum: ["NORMAL", "IMPORTANT", "HIGH", "CRITICAL"],
      default: "NORMAL",
      required: true
    },
    audience: {
      type: String,
      enum: ["ALL_USERS"],
      default: "ALL_USERS",
      required: true
    },
    deliveryMode: {
      type: String,
      enum: ["ANNOUNCEMENT", "DIRECT_MESSAGE"],
      default: "ANNOUNCEMENT",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for chronological ordering and efficient public query execution
broadcastSchema.index({ createdAt: -1 });
broadcastSchema.index({ audience: 1, deliveryMode: 1, createdAt: -1 });

export const BroadcastModel = model<IBroadcastDoc>("Broadcast", broadcastSchema);
