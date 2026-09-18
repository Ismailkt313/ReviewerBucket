import { Request, Response, NextFunction } from "express";
import { BroadcastService } from "./broadcast.service.js";
import { AppError } from "../../errors/app-error.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../config/cloudinary.js";

const broadcastService = new BroadcastService();

export async function uploadBroadcastBackgroundImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { imageData } = req.body;
    if (!imageData || typeof imageData !== "string") {
      throw new AppError(400, "Background image data is required.");
    }

    if (imageData.length > 8 * 1024 * 1024) {
      throw new AppError(400, "Background image cannot exceed 5MB.");
    }

    const result = await uploadToCloudinary(imageData, "reviewer-bucket/broadcasts/backgrounds");

    res.status(201).json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadBroadcastPosterImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { imageData, backgroundPublicId } = req.body;
    if (!imageData || typeof imageData !== "string") {
      throw new AppError(400, "Poster image data is required.");
    }

    if (imageData.length > 8 * 1024 * 1024) {
      throw new AppError(400, "Poster image cannot exceed 6MB.");
    }

    const result = await uploadToCloudinary(imageData, "reviewer-bucket/broadcasts/posters");

    // Clean up temporary background draft asset if provided
    if (backgroundPublicId && typeof backgroundPublicId === "string") {
      deleteFromCloudinary(backgroundPublicId).catch(() => {});
    }

    res.status(201).json({
      success: true,
      posterImageUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    next(error);
  }
}

export async function createAdminBroadcast(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminId = req.admin?.sub || "admin";
    const {
      title,
      content,
      broadcastType,
      posterImageUrl,
      posterMetadata,
      category,
      priority,
      audience,
      deliveryMode
    } = req.body;

    const broadcast = await broadcastService.createBroadcast({
      adminId,
      title,
      content,
      broadcastType,
      posterImageUrl,
      posterMetadata,
      category,
      priority,
      audience,
      deliveryMode
    });

    res.status(201).json({
      success: true,
      broadcast
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminBroadcasts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const broadcasts = await broadcastService.getAdminBroadcasts(limit);

    res.status(200).json({
      success: true,
      broadcasts
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminBroadcastById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const broadcast = await broadcastService.getAdminBroadcastById(id);

    res.status(200).json({
      success: true,
      broadcast
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserBroadcasts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const broadcasts = await broadcastService.getUserBroadcasts(limit);

    res.status(200).json({
      success: true,
      broadcasts
    });
  } catch (error) {
    next(error);
  }
}

export async function getBroadcastUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = (req.headers["x-anonymous-client-id"] || req.query.anonymousClientId || "") as string;
    const unreadCount = await broadcastService.getUserUnreadCount(clientId);

    res.status(200).json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    next(error);
  }
}

export async function markBroadcastsAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId = (req.headers["x-anonymous-client-id"] || req.body.anonymousClientId || "") as string;
    await broadcastService.markAsRead(clientId);

    res.status(200).json({
      success: true,
      message: "Broadcast announcements marked as read"
    });
  } catch (error) {
    next(error);
  }
}
