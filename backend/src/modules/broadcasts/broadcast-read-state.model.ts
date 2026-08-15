import { Schema, model, Document } from "mongoose";

export interface IBroadcastReadState extends Document {
  clientId: string;
  lastReadAt: Date;
}

const broadcastReadStateSchema = new Schema<IBroadcastReadState>({
  clientId: { type: String, required: true, unique: true },
  lastReadAt: { type: Date, default: () => new Date() }
});

export const BroadcastReadStateModel = model<IBroadcastReadState>(
  "BroadcastReadState",
  broadcastReadStateSchema
);
