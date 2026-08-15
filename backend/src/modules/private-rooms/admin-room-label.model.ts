import { Schema, model, Document, Types } from "mongoose";

export interface IAdminRoomLabelDoc extends Document {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  adminId: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminRoomLabelSchema = new Schema<IAdminRoomLabelDoc>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "PrivateRoom",
      required: true,
      unique: true,
      index: true,
    },
    adminId: {
      type: String,
      required: true,
      default: "admin",
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
);

export const AdminRoomLabelModel = model<IAdminRoomLabelDoc>(
  "AdminRoomLabel",
  adminRoomLabelSchema
);
