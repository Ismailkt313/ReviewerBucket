import { Schema, model } from "mongoose";
import type { IPrivateMessageDoc } from "./private-message.types.js";

const privateMessageSchema = new Schema<IPrivateMessageDoc>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "PrivateRoom",
      required: true,
      index: true
    },
    senderId: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 2000
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "PrivateMessage",
      required: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying room messages efficiently with cursor-based pagination
privateMessageSchema.index({ roomId: 1, createdAt: -1, _id: -1 });

export const PrivateMessageModel = model<IPrivateMessageDoc>(
  "PrivateMessage",
  privateMessageSchema
);
