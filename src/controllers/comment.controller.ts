import { Request, Response } from "express";
import { Comment, IComment } from "../models/comment.model";
import { Post } from "../models/post.model";
import { BaseController } from "./base.controller";

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
    // TODO: Implement comment creation
    // - Validate post exists
    // - Validate text length (1-5000 chars)
    // - Create comment with user ID from auth token
    // - Return created comment with populated user
    const { postId } = req.params;
    res.status(201).json({ message: "Comment added", data: req.body });
  }

  /**
   * Get all comments for a post with pagination
   * Query params: page (default 1), limit (default 20)
   * Populates user data (username, profilePic)
   * Sorted by createdAt descending (newest first)
   */
  async getCommentsByPost(req: Request, res: Response) {
    // TODO: Implement get comments by post ID
    // - Validate post ID format
    // - Verify post exists
    // - Extract page and limit from query
    // - Query comments where post === postId, sorted by createdAt desc
    // - Populate user (select username, email, profilePic)
    // - Return with pagination info
    const { postId } = req.params;
    res.json({ message: "Get comments", data: [], pagination: {} });
  }

  /**
   * Delete comment by ID
   * Only the comment owner or admin can delete
   * Requires authentication
   */
  async deleteComment(req: Request, res: Response) {
    // TODO: Implement comment deletion
    // - Validate comment ID format
    // - Find comment
    // - Check if current user is owner (compare user IDs)
    // - Return 403 if not owner
    // - Delete comment
    // - Return success
    const { commentId } = req.params;
    res.json({ message: "Comment deleted" });
  }

  /**
   * Update comment text
   * Only the comment owner can edit
   * Requires authentication
   */
  async updateComment(req: Request, res: Response) {
    // TODO: Implement comment update
    // - Validate comment ID format
    // - Find comment
    // - Check if current user is owner
    // - Return 403 if not owner
    // - Validate new text length (1-5000 chars)
    // - Update comment text
    // - Return updated comment
    const { commentId } = req.params;
    res.json({ message: "Comment updated", data: req.body });
  }
}
