import { Request, Response, NextFunction } from "express";
import { PrivateRoomService } from "./private-room.service.js";
import { getAnonymousClientId } from "./private-room.validation.js";

const privateRoomService = new PrivateRoomService();

export const createOrGetPrivateRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = getAnonymousClientId(req);
    const { targetUserId } = req.body;

    const room = await privateRoomService.getOrCreateRoom(currentUserId, targetUserId);

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
};

export const createOrGetDeveloperRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = getAnonymousClientId(req);

    const room = await privateRoomService.createOrGetDeveloperRoom(currentUserId);

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPrivateRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = getAnonymousClientId(req);
    const limit = Number(req.query.limit) || 50;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const rooms = await privateRoomService.getUserRooms(currentUserId, limit, cursor);

    res.status(200).json({
      success: true,
      data: rooms
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPrivateUnread = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = getAnonymousClientId(req);
    const unreadData = await privateRoomService.getUserUnreadCounts(currentUserId);

    res.status(200).json({
      success: true,
      data: unreadData
    });
  } catch (error) {
    next(error);
  }
};

export const markPrivateRoomAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const currentUserId = getAnonymousClientId(req);

    await privateRoomService.markRoomAsRead(roomId, currentUserId);

    res.status(200).json({
      success: true,
      data: {
        roomId,
        unreadCount: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getPrivateRoomById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const currentUserId = getAnonymousClientId(req);

    const room = await privateRoomService.getRoomById(roomId, currentUserId);

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
};

