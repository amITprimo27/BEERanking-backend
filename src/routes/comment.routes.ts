import { Router } from "express";
import { CommentController } from "../controllers/comment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });
const commentController = new CommentController();

/**
 * @swagger
 * /api/posts/{postId}/comments:
 *   post:
 *     summary: Add a new comment to a post
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Invalid post ID or comment text
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */
router.post("/", authMiddleware, (req, res) =>
  commentController.addComment(req, res),
);

/**
 * @swagger
 * /api/posts/{postId}/comments:
 *   get:
 *     summary: Get paginated comments for a post
 *     tags:
 *       - Comments
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Items per page (default 20)
 *     responses:
 *       200:
 *         description: Comments fetched successfully
 *       400:
 *         description: Invalid post ID format
 *       404:
 *         description: Post not found
 */
router.get("/", (req, res) => commentController.getCommentsByPost(req, res));

export { router as commentRouter };
