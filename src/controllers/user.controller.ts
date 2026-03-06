import { Request, Response } from "express";
import { User, IUser } from "../models/user.model";
import { BaseController } from "./base.controler";

export class UserController extends BaseController<IUser> {
  constructor() {
    super(User);
  }

  /**
   * Update authenticated user partially with optional profile picture upload
   * Handles profile pic, username, email, and favoriteBeers updates
   * Expects multipart/form-data for profile picture or JSON body
   * Supports partial updates (PATCH)
   * Uses req.user from auth middleware
   */
  async updateUser(req: Request, res: Response) {
    // TODO: Implement partial user update with optional profile picture upload
    // - Get user ID from req.user (set by auth middleware)
    // - Handle multipart/form-data if profile pic provided
    // - Update user document with provided fields (profilePic, username, email, favoriteBeers, etc.)
    // - If profile pic provided, save new image and update path
    res.json({ message: "User updated", data: req.body });
  }
}
