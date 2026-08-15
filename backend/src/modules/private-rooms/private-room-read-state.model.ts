import { Schema, model, Document, Types } from "mongoose";

export interface IPrivateRoomReadStateDoc extends Document {
  roomId: Types.ObjectId;
  clientId: string;
  lastReadAt: Date;
}

const privateRoomReadStateSchema = new Schema<IPrivateRoomReadStateDoc>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "PrivateRoom",
      required: true,
      index: true
    },
    clientId: {
      type: String,
      required: true,
      index: true
    },
    lastReadAt: {
      type: Date,
      default: () => new Date(),
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring exactly one read state per (roomId, clientId)
privateRoomReadStateSchema.index({ roomId: 1, clientId: 1 }, { unique: true });
privateRoomReadStateSchema.index({ clientId: 1, lastReadAt: -1 });

export const PrivateRoomReadStateModel = model<IPrivateRoomReadStateDoc>(
  "PrivateRoomReadState",
  privateRoomReadStateSchema
);
