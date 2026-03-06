import { Request, Response, NextFunction } from "express";
import { AuthUtils } from "../utils/auth.utils";

export type AuthRequest = Request & { user?: { _id: string } };

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const token = AuthUtils.extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = AuthUtils.verifyToken(token);
    req.user = { _id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
