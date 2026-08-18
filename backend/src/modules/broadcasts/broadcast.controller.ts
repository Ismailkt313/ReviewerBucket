import { Request, Response, NextFunction } from "express";
import { BroadcastService } from "./broadcast.service.js";

const broadcastService = new BroadcastService();

export async function createAdminBroadcast(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminId = req.admin?.sub || "admin";
    const { title, content, category, priority, audience, deliveryMode } = req.body;

    const broadcast = await broadcastService.createBroadcast({
      adminId,
      title,
      content,
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
