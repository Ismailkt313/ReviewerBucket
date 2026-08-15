import { Request, Response, NextFunction } from "express";
import { AdminAuthService } from "./admin-auth.service.js";

const adminAuthService = new AdminAuthService();

export const loginAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = adminAuthService.loginAdmin(req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
