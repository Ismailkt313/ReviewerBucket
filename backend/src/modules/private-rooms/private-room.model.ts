import { Schema, model } from "mongoose";
import type { IPrivateRoomDoc } from "./private-room.types.js";

const privateRoomSchema = new Schema<IPrivateRoomDoc>(
  {
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: function (val: string[]): boolean {
          return Array.isArray(val) && val.length === 2 && val[0] !== val[1];
        },
        message: "A private room must contain exactly two distinct participants"
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on sorted participants ensuring exactly one room per pair at the database level
privateRoomSchema.index({ "participants.0": 1, "participants.1": 1 }, { unique: true });

// Multikey index on participants for fast lookups of all rooms belonging to a participant
privateRoomSchema.index({ participants: 1 });

// Composite index for querying participant's rooms ordered by recent activity
privateRoomSchema.index({ participants: 1, updatedAt: -1 });

export const PrivateRoomModel = model<IPrivateRoomDoc>(
  "PrivateRoom",
  privateRoomSchema
);
