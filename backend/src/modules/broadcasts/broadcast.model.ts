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

// Index for chronological ordering of broadcasts
broadcastSchema.index({ createdAt: -1 });

export const BroadcastModel = model<IBroadcastDoc>("Broadcast", broadcastSchema);
