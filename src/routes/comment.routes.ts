import { Router } from "express";
import { CommentController } from "../controllers/comment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });
const commentController = new CommentController();

/**
 * POST /api/posts/:postId/comments
 * Add new comment to a post
 * Expects JSON body: { text: string }
 * Requires authentication
 */
router.post("/", authMiddleware, (req, res) =>
  commentController.addComment(req, res),
);

/**
 * GET /api/posts/:postId/comments
 * Get all comments for a post with pagination
 * Query params: page (default 1), limit (default 20)
 * Populates user data
 */
router.get("/", (req, res) => commentController.getCommentsByPost(req, res));

/**
 * PATCH /api/comments/:commentId
 * Update comment text
 * Requires authentication (owner only)
 */
router.patch("/:commentId", authMiddleware, (req, res) =>
  commentController.updateComment(req, res),
);

/**
 * DELETE /api/comments/:commentId
 * Delete comment
 * Requires authentication (owner only)
 */
router.delete("/:commentId", authMiddleware, (req, res) =>
  commentController.deleteComment(req, res),
);

export { router as commentRouter };
