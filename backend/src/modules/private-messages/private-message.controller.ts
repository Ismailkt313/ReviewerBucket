import { Request, Response, NextFunction } from "express";
import { PrivateMessageService } from "./private-message.service.js";
import { getAnonymousClientId } from "./private-message.validation.js";

const privateMessageService = new PrivateMessageService();

export const sendPrivateMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const currentUserId = getAnonymousClientId(req);
    const { content, replyTo } = req.body;

    const message = await privateMessageService.sendMessage(roomId, currentUserId, content, replyTo);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

export const getPrivateMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const currentUserId = getAnonymousClientId(req);
    const limit = Number(req.query.limit) || 50;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const result = await privateMessageService.getMessages(
      roomId,
      currentUserId,
      limit,
      cursor
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
