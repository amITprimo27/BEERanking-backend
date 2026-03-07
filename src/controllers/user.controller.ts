import { Request, Response } from "express";
import { User, IUser } from "../models/user.model";
import { BaseController } from "./base.controler";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as fs from "fs";
import * as path from "path";
import { FileRequest } from "../middlewares/multer.middleware";

export class UserController extends BaseController<IUser> {
  constructor() {
    super(User);
  }

  // Override fetchById to include populateapte favoriteBeers for User documents
  protected override async fetchById(id: string) {
    return User.findById(id).populate("favoriteBeers");
  }

  /**
   * Get current authenticated user
   * Uses req.user from auth middleware
   */
  async getMe(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate ObjectId format
      if (!this.isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const user = await this.fetchById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json(user);
    } catch (error) {
      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  /**
   * Update authenticated user partially with optional profile picture upload
   * Handles profile pic, username, email, and favoriteBeers updates
   * Expects multipart/form-data for profile picture or JSON body
   * Supports partial updates (PATCH)
   * Uses req.user from auth middleware
   */
  async updateUser(req: AuthRequest & FileRequest, res: Response) {
    try {
      const userId = req.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate ObjectId format
      if (!this.isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const { username, favoriteBeers } = req.body;
      const updateData: Record<string, unknown> = {};

      // Validate and add username if provided
      if (username !== undefined) {
        if (typeof username !== "string" || username.trim().length < 3) {
          return res
            .status(400)
            .json({ error: "Username must be at least 3 characters" });
        }
        updateData.username = username.trim();
      }

      // Handle favoriteBeers array if provided
      if (favoriteBeers !== undefined) {
        let beersArray = favoriteBeers;

        // If it's a string (from multipart/form-data), parse it as JSON
        if (typeof favoriteBeers === "string") {
          try {
            beersArray = JSON.parse(favoriteBeers);
          } catch (e) {
            return res
              .status(400)
              .json({ error: "favoriteBeers must be a valid JSON array" });
          }
        }

        if (!Array.isArray(beersArray)) {
          return res
            .status(400)
            .json({ error: "favoriteBeers must be an array" });
        }
        updateData.favoriteBeers = beersArray;
      }

      // Handle optional profile picture upload
      if (req.file) {
        const file = req.file;
        updateData.profilePic = `/uploads/${file.filename}`;
      }

      // Ensure at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update provided" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true },
      ).populate("favoriteBeers");

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
}
