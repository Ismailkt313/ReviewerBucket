import { Schema, model } from "mongoose";
import { INotificationDoc } from "./notification.types.js";

const notificationSchema = new Schema<INotificationDoc>({
  type: { type: String, required: true },
  message: { type: String, required: true },
  senderClientId: { type: String },
  experienceId: { type: String },
  reviewerUpdateId: { type: String },
  reviewerId: { type: String },
  reviewerSlug: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 9000 } // TTL: 150 minutes (9000 seconds)
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ reviewerId: 1 });

export const NotificationModel = model<INotificationDoc>("Notification", notificationSchema);
