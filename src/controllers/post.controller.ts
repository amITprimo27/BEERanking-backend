import { Request, Response } from "express";
import { Post, IPost } from "../models/post.model";
import { BaseController } from "./base.controller";
import { AuthRequest } from "../middlewares/auth.middleware";
import { FileRequest } from "../middlewares/multer.middleware";
import mongoose from "mongoose";
import { Beer } from "../models/beer.model";
import {
  UPLOADS_ROUTE_PREFIX,
  toPublicAbsolutePath,
} from "../utils/paths.utils";
import { Comment } from "../models/comment.model";
import * as fs from "fs";

export class PostController extends BaseController<IPost> {
  constructor() {
    super(Post);
  }

  //#region Read hooks

  /**
   * Override fetchById to populate related data
   */
  protected override async fetchById(id: string) {
    return Post.findById(id)
      .populate("user", "username profilePic")
      .populate("beer")
      .populate("commentCount");
  }

  /**
   * Customize query to add sorting and population
   */
  protected override customizeQuery(
    query: mongoose.Query<Array<IPost>, IPost>,
  ) {
    return query
      .sort({ createdAt: -1 })
      .populate("user", "username profilePic")
      .populate("beer")
      .populate("commentCount");
  }
  //#endregion

  //#region Delete hooks
  protected override async authorizeDelete(req: AuthRequest, entity: IPost) {
    const userId = this.requireAuthenticatedUser(req);

    if (entity.user.toString() !== userId) {
      this.throwHttpError(403, "Forbidden");
    }
  }

  protected override async afterDelete(_req: AuthRequest, entity: IPost) {
    if (entity.image && entity.image.startsWith(UPLOADS_ROUTE_PREFIX)) {
      const imageAbsolutePath = toPublicAbsolutePath(entity.image);
      if (fs.existsSync(imageAbsolutePath)) {
        fs.unlinkSync(imageAbsolutePath);
      }
    }

    await Comment.deleteMany({ post: entity._id });
  }

  protected override async formatDeleteResponse(
    _deleted: IPost,
  ): Promise<unknown> {
    return { message: "Post deleted" };
  }
  //#endregion

  //#region Create hooks
  protected override async validateCreate(
    req: AuthRequest & FileRequest,
  ): Promise<void> {
    if (!req.file) {
      this.throwHttpError(400, "Image file is required");
    }

    const { rating, beer, description } = req.body;
    const parsedRating = Number(rating);
    if (
      !Number.isFinite(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      this.throwHttpError(400, "Rating must be a number between 1 and 5");
    }

    if (!beer || typeof beer !== "string" || !this.isValidObjectId(beer)) {
      this.throwHttpError(400, "Invalid beer ID format");
    }

    const beerExists = await Beer.exists({ _id: beer });
    if (!beerExists) {
      this.throwHttpError(400, "Beer not found");
    }

    if (
      !description ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      this.throwHttpError(400, "Description is required");
    }
  }

  /**
   * Build create payload for post document
   */
  protected override async buildCreateData(
    req: AuthRequest & FileRequest,
  ): Promise<Partial<IPost>> {
    return {
      image: `${UPLOADS_ROUTE_PREFIX}${req.file!.filename}`,
      rating: Number(req.body.rating),
      beer: req.body.beer,
      description: req.body.description.trim(),
      user: new mongoose.Types.ObjectId(req.user!._id),
    };
  }

  /**
   * Format create response
   */
  protected override async formatCreateResponse(created: IPost) {
    const populatedCreated = await this.fetchById(created._id.toString());

    return {
      message: "Post added",
      data: populatedCreated,
    };
  }
  //#endregion

  //#region Update hooks
  protected override async authorizeUpdate(
    req: AuthRequest,
    entity: IPost,
  ): Promise<void> {
    const userId = this.requireAuthenticatedUser(req);

    if (entity.user.toString() !== userId) {
      this.throwHttpError(403, "Forbidden");
    }
  }

  protected override async validatePatch(
    req: AuthRequest & FileRequest,
    _entity: IPost,
  ): Promise<void> {
    const { rating, beer, description } = req.body;

    if (rating !== undefined) {
      const parsedRating = Number(rating);
      if (
        !Number.isFinite(parsedRating) ||
        parsedRating < 1 ||
        parsedRating > 5
      ) {
        this.throwHttpError(400, "Rating must be a number between 1 and 5");
      }
      req.body.rating = parsedRating;
    }

    if (beer !== undefined) {
      if (typeof beer !== "string" || !this.isValidObjectId(beer)) {
        this.throwHttpError(400, "Invalid beer ID format");
      }

      const beerExists = await Beer.exists({ _id: beer });
      if (!beerExists) {
        this.throwHttpError(400, "Beer not found");
      }
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        this.throwHttpError(400, "Description is required");
      }
      req.body.description = description.trim();
    }

    if (req.file) {
      req.body.image = `${UPLOADS_ROUTE_PREFIX}${req.file.filename}`;
    }

    if (
      req.body.rating === undefined &&
      req.body.beer === undefined &&
      req.body.description === undefined &&
      req.body.image === undefined
    ) {
      this.throwHttpError(400, "No fields to update provided");
    }
  }

  protected override async buildPatchData(
    req: AuthRequest & FileRequest,
    _id: string,
  ): Promise<Partial<IPost>> {
    const updateData: Partial<IPost> = {};

    if (req.body.rating !== undefined) {
      updateData.rating = req.body.rating;
    }
    if (req.body.beer !== undefined) {
      updateData.beer = req.body.beer;
    }
    if (req.body.description !== undefined) {
      updateData.description = req.body.description;
    }
    if (req.body.image !== undefined) {
      updateData.image = req.body.image;
    }

    return updateData;
  }

  protected override async afterPatch(
    req: AuthRequest & FileRequest,
    oldEntity: IPost,
    _updatedEntity: IPost,
  ): Promise<void> {
    // If a new image was uploaded and the old post had a different image, delete the old one
    if (
      req.file &&
      oldEntity.image &&
      oldEntity.image.startsWith(UPLOADS_ROUTE_PREFIX)
    ) {
      const oldImagePath = toPublicAbsolutePath(oldEntity.image);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (error) {
          console.error("Failed to delete old image:", error);
        }
      }
    }
  }

  protected override async formatPatchResponse(updated: IPost) {
    const populatedUpdated = await this.fetchById(updated._id.toString());

    return { message: "Post updated", data: populatedUpdated };
  }
  //#endregion

  //#region Route methods
  /**
   * Toggle like on a post
   * If user already liked the post, remove the like (unlike)
   * If user hasn't liked the post, add the like
   */
  async toggleLike(req: AuthRequest, res: Response) {
    const postId = req.params.id;

    if (!this.isValidObjectId(postId)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const userId = this.requireAuthenticatedUser(req);

      const post = await Post.findById(postId).select("+likes");
      if (!post) {
        return res.status(404).json({ error: "Data not found" });
      }

      const alreadyLiked = post.likes.some((likeUserId) => {
        return likeUserId.toString() === userId;
      });

      const update = alreadyLiked
        ? {
            $pull: { likes: new mongoose.Types.ObjectId(userId) },
            $inc: { likesCount: -1 },
          }
        : {
            $addToSet: { likes: new mongoose.Types.ObjectId(userId) },
            $inc: { likesCount: 1 },
          };

      const updatedPost = await Post.findByIdAndUpdate(postId, update, {
        new: true,
      });

      if (!updatedPost) {
        return res.status(404).json({ error: "Data not found" });
      }

      return res.json({
        message: alreadyLiked ? "Post unliked" : "Post liked",
        liked: !alreadyLiked,
        likeCount: updatedPost.likesCount,
      });
    } catch (error) {
      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  /**
   * Get current user's posts with pagination
   * Uses req.user from auth middleware
   * Query params: page (default 1), limit (default 10)
   */
  async getUserPosts(req: AuthRequest, res: Response) {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return this.getPaginated(req, res, { user: userId });
  }

  //#endregion
}
