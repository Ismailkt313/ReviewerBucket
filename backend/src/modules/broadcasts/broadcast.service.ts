import { BroadcastRepository } from "./broadcast.repository.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";
import { getIO } from "../../socket/socket.js";
import { AppError } from "../../errors/app-error.js";
import type {
  IBroadcast,
  IPublicBroadcast,
  IBroadcastDoc,
  BroadcastDeliveryMode
} from "./broadcast.types.js";

export class BroadcastService {
  private repository = new BroadcastRepository();
  private privateMessageService = new PrivateMessageService();

  private toAdminBroadcast(doc: IBroadcastDoc): IBroadcast {
    return {
      id: doc._id.toString(),
      _id: doc._id.toString(),
      adminId: doc.adminId,
      content: doc.content,
      type: doc.type,
      audience: doc.audience,
      deliveryMode: doc.deliveryMode || "ANNOUNCEMENT",
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString()
    };
  }

  private toPublicBroadcast(doc: IBroadcastDoc): IPublicBroadcast {
    return {
      id: doc._id.toString(),
      _id: doc._id.toString(),
      content: doc.content,
      type: doc.type,
      audience: doc.audience,
      deliveryMode: doc.deliveryMode || "ANNOUNCEMENT",
      senderName: "Reviewer Bucket",
      secondaryLabel: "Official announcement",
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString()
    };
  }

  async createBroadcast(
    adminId: string,
    content: string,
    deliveryMode: BroadcastDeliveryMode = "ANNOUNCEMENT"
  ): Promise<IBroadcast> {
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Broadcast content cannot be empty");
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 2000) {
      throw new AppError(400, "Broadcast content cannot exceed 2000 characters");
    }

    const trimmedAdminId = (adminId || "admin").trim();

    // 1. Persist broadcast record
    const doc = await this.repository.create(
      trimmedAdminId,
      trimmedContent,
      "ALL_USERS",
      deliveryMode
    );

    const publicBroadcast = this.toPublicBroadcast(doc);

    // 2. Deliver based on delivery mode
    if (deliveryMode === "DIRECT_MESSAGE") {
      // Deliver as personal direct message into every user's developer chat
      try {
        await this.privateMessageService.sendMassAdminMessage(trimmedContent);
      } catch {
        // Non-blocking mass delivery catch
      }

      // Notify admin history
      try {
        const io = getIO();
        if (io) {
          io.to("user:admin").emit("broadcast:new", publicBroadcast);
        }
      } catch {
        // Socket emission failure ignored
      }
    } else {
      // Official Announcement: Deliver to the announcement channel stream for all eligible users
      try {
        const io = getIO();
        if (io) {
          io.to("audience:eligible_users").to("user:admin").emit("broadcast:new", publicBroadcast);
          io.to("audience:eligible_users").emit("broadcast:unread:increment", {
            broadcastId: publicBroadcast.id || (publicBroadcast as any)._id
          });
        }
      } catch {
        // Socket emission failure ignored
      }
    }

    return this.toAdminBroadcast(doc);
  }

  async getAdminBroadcasts(limit = 50): Promise<IBroadcast[]> {
    const docs = await this.repository.findAll(limit);
    return docs.map((doc) => this.toAdminBroadcast(doc));
  }

  async getAdminBroadcastById(id: string): Promise<IBroadcast> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new AppError(404, "Broadcast not found");
    }
    return this.toAdminBroadcast(doc);
  }

  async getUserBroadcasts(limit = 50): Promise<IPublicBroadcast[]> {
    const docs = await this.repository.findRecentForUsers(limit);
    return docs.map((doc) => this.toPublicBroadcast(doc));
  }

  async getUserUnreadCount(clientId: string): Promise<number> {
    const trimmedId = (clientId || "").trim();
    if (!trimmedId) return 0;

    const { BroadcastReadStateModel } = await import("./broadcast-read-state.model.js");
    const { BroadcastModel } = await import("./broadcast.model.js");

    const readState = await BroadcastReadStateModel.findOne({ clientId: trimmedId });
    const lastReadAt = readState ? readState.lastReadAt : new Date(0);

    return await BroadcastModel.countDocuments({
      audience: "ALL_USERS",
      deliveryMode: "ANNOUNCEMENT",
      createdAt: { $gt: lastReadAt }
    });
  }

  async markAsRead(clientId: string): Promise<void> {
    const trimmedId = (clientId || "").trim();
    if (!trimmedId) return;

    const { BroadcastReadStateModel } = await import("./broadcast-read-state.model.js");
    await BroadcastReadStateModel.findOneAndUpdate(
      { clientId: trimmedId },
      { lastReadAt: new Date() },
      { upsert: true, new: true }
    );

    const io = getIO();
    if (io) {
      io.to(`user:${trimmedId}`).emit("broadcast:unread:sync", { unreadCount: 0 });
    }
  }
}
