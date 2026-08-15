import { Request, Response, NextFunction } from "express";
import { PrivateContactService } from "./private-contact.service.js";
import { getAnonymousClientId } from "./private-contact.validation.js";

const privateContactService = new PrivateContactService();

export const getContactIdentity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contactId } = req.params;
    const ownerId = getAnonymousClientId(req);

    const data = await privateContactService.getContactIdentity(ownerId, contactId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const renameContact = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contactId } = req.params;
    const ownerId = getAnonymousClientId(req);
    const { nickname } = req.body;

    const data = await privateContactService.setContactNickname(ownerId, contactId, nickname);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const getMyContacts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = getAnonymousClientId(req);
    const limit = Number(req.query.limit) || 50;

    const data = await privateContactService.getOwnerContacts(ownerId, limit);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
