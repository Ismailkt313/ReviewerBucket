import { Schema, model } from "mongoose";
import type { IPrivateContactDoc } from "./private-contact.types.js";

const privateContactSchema = new Schema<IPrivateContactDoc>(
  {
    ownerId: {
      type: String,
      required: true,
      trim: true
    },
    contactId: {
      type: String,
      required: true,
      trim: true
    },
    nickname: {
      type: String,
      default: null,
      trim: true,
      maxlength: 50
    },
    normalizedNickname: {
      type: String,
      default: null,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Enforce unique contact record per owner + contact pair
privateContactSchema.index({ ownerId: 1, contactId: 1 }, { unique: true });

// Enforce unique nickname per owner across different contacts (partial index for non-null nicknames)
privateContactSchema.index(
  { ownerId: 1, normalizedNickname: 1 },
  {
    unique: true,
    partialFilterExpression: { normalizedNickname: { $type: "string" } }
  }
);

// Index for listing owner contacts ordered by update
privateContactSchema.index({ ownerId: 1, updatedAt: -1 });

export const PrivateContactModel = model<IPrivateContactDoc>(
  "PrivateContact",
  privateContactSchema
);
