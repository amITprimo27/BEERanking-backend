import { Request, Response } from "express";
import { Comment, IComment } from "../models/comment.model";
import { Post } from "../models/post.model";
import { BaseController } from "./base.controller";
import { AuthRequest } from "../middlewares/auth.middleware";
import mongoose from "mongoose";

export class CommentController extends BaseController<IComment> {
  constructor() {
    super(Comment);
  }

  /**
   * Add new comment to a post
   * Expects JSON body with text field
   * Requires authentication
   */
  async addComment(req: Request, res: Response) {
    const { postId } = req.params;

    if (!this.isValidObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post ID format" });
    }

    try {
      const userId = this.requireAuthenticatedUser(req as AuthRequest);
      const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

      if (!text) {
        this.throwHttpError(400, "Comment text is required");
      }

      if (text.length > 5000) {
        this.throwHttpError(400, "Comment text must be between 1 and 5000 characters");
      }

      const postExists = await Post.exists({ _id: postId });
      if (!postExists) {
        return res.status(404).json({ error: "Post not found" });
      }

      const created = await Comment.create({
        text,
        post: new mongoose.Types.ObjectId(postId),
        user: new mongoose.Types.ObjectId(userId),
      });

      const populatedCreated = await Comment.findById(created._id).populate(
        "user",
        "username email profilePic",
      );

      return res.status(201).json({
        message: "Comment added",
        data: populatedCreated ?? created,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
      ) {
        return res
          .status((error as { status: number }).status)
          .json({ error: error.message });
      }

      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  /**
   * Get all comments for a post with pagination
   * Query params: page (default 1), limit (default 20)
   * Populates user data (username, profilePic)
   * Sorted by createdAt descending (newest first)
   */
  async getCommentsByPost(req: Request, res: Response) {
    const { postId } = req.params;

    if (!this.isValidObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post ID format" });
    }

    try {
      const postExists = await Post.exists({ _id: postId });
      if (!postExists) {
        return res.status(404).json({ error: "Post not found" });
      }

      const { page, limit, skip } = this.getPaginationParams(req, {
        defaultLimit: 20,
      });

      const [data, total] = await Promise.all([
        Comment.find({ post: postId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("user", "username email profilePic"),
        Comment.countDocuments({ post: postId }),
      ]);

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
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
