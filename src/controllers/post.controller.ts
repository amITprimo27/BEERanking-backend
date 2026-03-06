import { Request, Response } from "express";
import { Post, IPost } from "../models/post.model";
import { BaseController } from "./base.controler";

export class PostController extends BaseController<IPost> {
  constructor() {
    super(Post);
  }

  /**
   * Add new post with image upload
   * Expects multipart/form-data with image file
   */
  async addPost(req: Request, res: Response) {
    // TODO: Implement post creation with image upload
    // - Handle multipart/form-data
    // - Save image file
    // - Create post document with image path
    res.status(201).json({ message: "Post added", data: req.body });
  }

  /**
   * Get all posts with pagination
   * Query params: page (default 1), limit (default 10)
   */
  async getAllPosts(req: Request, res: Response) {
    // TODO: Implement pagination logic
    // - Extract page and limit from query
    // - Calculate skip value
    // - Execute query with skip and limit
    // - Return posts with total count
    res.json({ message: "Get all posts", data: [] });
  }

  /**
   * Get single post by ID
   */
  async getPostById(req: Request, res: Response) {
    // TODO: Implement get post by ID
    // - Validate post ID format
    // - Fetch post from DB
    // - Return 404 if not found
    const { id } = req.params;
    res.json({ message: "Get post by ID", data: {} });
  }

  /**
   * Update post partially with optional image upload
   * Expects multipart/form-data for image or JSON body
   * Supports partial updates (PATCH)
   */
  async updatePost(req: Request, res: Response) {
    // TODO: Implement partial post update with optional image upload
    // - Handle multipart/form-data if image provided
    // - Update post document with provided fields
    // - If image provided, save new image and update path
    res.json({ message: "Post updated", data: req.body });
  }

  /**
   * Delete post
   * Inherits from BaseController.del()
   */
  async deletePost(req: Request, res: Response) {
    // TODO: Implement post deletion
    // - Delete associated image file
    // - Delete post document
    res.json({ message: "Post deleted" });
  }

  /**
   * Get current user's posts with pagination
   * Uses req.user from auth middleware
   * Query params: page (default 1), limit (default 10)
   */
  async getUserPosts(req: Request, res: Response) {
    // TODO: Implement getting current user's posts with pagination
    // - Get user ID from req.user (set by auth middleware)
    // - Extract page and limit from query
    // - Calculate skip value
    // - Query posts filtered by user ID with pagination
    // - Return posts with total count
    res.json({ message: "User posts retrieved", data: [] });
  }

  /**
   * Toggle like on a post
   * If user already liked the post, remove the like (unlike)
   * If user hasn't liked the post, add the like
   */
  async toggleLike(req: Request, res: Response) {
    // TODO: Implement toggle like functionality
    // - Get post ID from req.params.id
    // - Get user ID from req.user (set by auth middleware)
    // - Check if user already liked the post (userId in likes array)
    // - If liked: use $pull to remove userId from likes array
    // - If not liked: use $addToSet to add userId to likes array
    // - Return updated post with like status
    res.json({ message: "Like toggled" });
  }
}
