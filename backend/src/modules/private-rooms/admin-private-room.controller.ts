import { Request, Response, NextFunction } from "express";
import { PrivateRoomService } from "./private-room.service.js";
import { PrivateMessageService } from "../private-messages/private-message.service.js";

const privateRoomService = new PrivateRoomService();
const privateMessageService = new PrivateMessageService();

export const getAdminPrivateRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 50;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const rooms = await privateRoomService.getAdminDeveloperRooms(limit, cursor);

    res.status(200).json({
      success: true,
      data: rooms
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPrivateRoomById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;

    const room = await privateRoomService.getAdminRoomById(roomId);

    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPrivateRoomMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const limit = Number(req.query.limit) || 50;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const result = await privateMessageService.getAdminMessages(roomId, limit, cursor);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const sendAdminPrivateRoomMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { content, replyTo } = req.body;

    const message = await privateMessageService.sendAdminMessage(roomId, content, replyTo);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

export const setAdminRoomLabel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { label } = req.body;

    const updatedLabel = await privateRoomService.setAdminRoomLabel(roomId, String(label ?? ""));

    res.status(200).json({
      success: true,
      data: { roomId, label: updatedLabel }
    });
  } catch (error) {
    next(error);
  }
};
