import { BroadcastRepository } from "./broadcast.repository.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";
import { getIO } from "../../socket/socket.js";
import { AppError } from "../../errors/app-error.js";
import type {
  IBroadcast,
  IPublicBroadcast,
  IBroadcastDoc,
  BroadcastType,
  BroadcastCategory,
  BroadcastPriority,
  BroadcastAudience,
  BroadcastDeliveryMode
} from "./broadcast.types.js";

const VALID_CATEGORIES = new Set<BroadcastCategory>([
  "FEATURE_UPDATE",
  "COMMUNITY",
  "IMPORTANT",
  "SYSTEM",
  "PRODUCT_UPDATE"
]);

const VALID_PRIORITIES = new Set<BroadcastPriority>([
  "NORMAL",
  "IMPORTANT",
  "HIGH",
  "CRITICAL"
]);

export interface CreateBroadcastServiceParams {
  adminId: string;
  title?: string;
  content: string;
  broadcastType?: BroadcastType;
  posterImageUrl?: string;
  posterMetadata?: Record<string, unknown>;
  category?: BroadcastCategory;
  priority?: BroadcastPriority;
  audience?: BroadcastAudience;
  deliveryMode?: BroadcastDeliveryMode;
}

export class BroadcastService {
  private repository = new BroadcastRepository();
  private privateMessageService = new PrivateMessageService();

  private toAdminBroadcast(doc: IBroadcastDoc): IBroadcast {
    return {
      id: doc._id.toString(),
      _id: doc._id.toString(),
      adminId: doc.adminId,
      title: doc.title || "",
      content: doc.content,
      type: doc.type || "SYSTEM_BROADCAST",
      broadcastType: doc.broadcastType || "TEXT",
      posterImageUrl: doc.posterImageUrl || "",
      posterMetadata: doc.posterMetadata,
      category: doc.category || "COMMUNITY",
      priority: doc.priority || "NORMAL",
      audience: doc.audience || "ALL_USERS",
      deliveryMode: doc.deliveryMode || "ANNOUNCEMENT",
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString()
    };
  }

  private toPublicBroadcast(doc: IBroadcastDoc): IPublicBroadcast {
    return {
      id: doc._id.toString(),
      _id: doc._id.toString(),
      title: doc.title || "",
      content: doc.content,
      type: doc.type || "SYSTEM_BROADCAST",
      broadcastType: doc.broadcastType || "TEXT",
      posterImageUrl: doc.posterImageUrl || "",
      posterMetadata: doc.posterMetadata,
      category: doc.category || "COMMUNITY",
      priority: doc.priority || "NORMAL",
      audience: doc.audience || "ALL_USERS",
      deliveryMode: doc.deliveryMode || "ANNOUNCEMENT",
      senderName: "Reviewer Bucket",
      secondaryLabel: "Official announcement",
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString()
    };
  }

  /**
   * Create and persist a new official broadcast announcement or mass message.
   * Supports both object params and legacy positional params for seamless backward compatibility.
   */
  async createBroadcast(
    adminIdOrParams: string | CreateBroadcastServiceParams,
    contentParam?: string,
    deliveryModeParam?: BroadcastDeliveryMode
  ): Promise<IBroadcast> {
    let adminId: string;
    let title: string | undefined;
    let content: string;
    let broadcastType: BroadcastType | undefined;
    let posterImageUrl: string | undefined;
    let posterMetadata: Record<string, unknown> | undefined;
    let category: BroadcastCategory | undefined;
    let priority: BroadcastPriority | undefined;
    let audience: BroadcastAudience | undefined;
    let deliveryMode: BroadcastDeliveryMode | undefined;

    if (typeof adminIdOrParams === "object" && adminIdOrParams !== null) {
      adminId = adminIdOrParams.adminId;
      title = adminIdOrParams.title;
      content = adminIdOrParams.content;
      broadcastType = adminIdOrParams.broadcastType;
      posterImageUrl = adminIdOrParams.posterImageUrl;
      posterMetadata = adminIdOrParams.posterMetadata;
      category = adminIdOrParams.category;
      priority = adminIdOrParams.priority;
      audience = adminIdOrParams.audience;
      deliveryMode = adminIdOrParams.deliveryMode;
    } else {
      adminId = adminIdOrParams;
      content = contentParam || "";
      deliveryMode = deliveryModeParam;
    }

    // 1. Content validation
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Broadcast content cannot be empty");
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > 2000) {
      throw new AppError(400, "Broadcast content cannot exceed 2000 characters");
    }

    // 2. Title validation (if provided)
    let trimmedTitle = "";
    if (title !== undefined && title !== null) {
      if (typeof title !== "string") {
        throw new AppError(400, "Broadcast title must be a string");
      }
      trimmedTitle = title.trim();
      if (title.length > 0 && trimmedTitle.length === 0) {
        throw new AppError(400, "Broadcast title cannot be empty");
      }
      if (trimmedTitle.length > 200) {
        throw new AppError(400, "Broadcast title cannot exceed 200 characters");
      }
    }

    // 3. Category validation
    const resolvedCategory: BroadcastCategory = category || "COMMUNITY";
    if (!VALID_CATEGORIES.has(resolvedCategory)) {
      throw new AppError(400, "Invalid broadcast category. Must be one of: FEATURE_UPDATE, COMMUNITY, IMPORTANT, SYSTEM, PRODUCT_UPDATE.");
    }

    // 4. Priority validation
    const resolvedPriority: BroadcastPriority = priority || "NORMAL";
    if (!VALID_PRIORITIES.has(resolvedPriority)) {
      throw new AppError(400, "Invalid broadcast priority. Must be one of: NORMAL, IMPORTANT, HIGH, CRITICAL.");
    }

    // 5. Audience validation
    if (audience && audience !== "ALL_USERS") {
      throw new AppError(400, "Invalid broadcast audience. Only ALL_USERS is supported.");
    }

    const trimmedAdminId = (adminId || "admin").trim();
    const resolvedDeliveryMode: BroadcastDeliveryMode = deliveryMode || "ANNOUNCEMENT";
    const resolvedBroadcastType: BroadcastType = broadcastType === "POSTER" ? "POSTER" : "TEXT";
    const resolvedPosterImageUrl = (posterImageUrl || "").trim();

    // 6. Persist broadcast record BEFORE socket emission
    const doc = await this.repository.create({
      adminId: trimmedAdminId,
      title: trimmedTitle,
      content: trimmedContent,
      broadcastType: resolvedBroadcastType,
      posterImageUrl: resolvedPosterImageUrl,
      posterMetadata: posterMetadata,
      category: resolvedCategory,
      priority: resolvedPriority,
      audience: "ALL_USERS",
      deliveryMode: resolvedDeliveryMode
    });

    const publicBroadcast = this.toPublicBroadcast(doc);

    // 7. Deliver based on delivery mode
    if (resolvedDeliveryMode === "DIRECT_MESSAGE") {
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
            broadcastId: publicBroadcast.id || publicBroadcast._id
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
