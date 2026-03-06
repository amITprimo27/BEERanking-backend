import { Router } from "express";
import { PostController } from "../controllers/post.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { commentRouter } from "./comment.routes";

const router = Router();
const postController = new PostController();

/**
 * GET /api/posts
 * Get all posts with pagination
 * Query params: page, limit
 */
router.get("/", (req, res) => postController.getAllPosts(req, res));

/**
 * GET /api/posts/me
 * Get authenticated user's posts with pagination
 * Query params: page, limit
 * Requires authentication
 */
router.get("/me", authMiddleware, (req, res) =>
  postController.getUserPosts(req, res),
);

/**
 * GET /api/posts/:id
 * Get single post by ID
 */
router.get("/:id", (req, res) => postController.getPostById(req, res));

/**
 * POST /api/posts
 * Add new post with image upload
 * Expects multipart/form-data with image file
 * Requires authentication
 */
router.post("/", authMiddleware, (req, res) =>
  postController.addPost(req, res),
);

/**
 * PATCH /api/posts/:id
 * Update post partially with optional image upload
 * Expects multipart/form-data or JSON body
 * Requires authentication
 */
router.patch("/:id", authMiddleware, (req, res) =>
  postController.updatePost(req, res),
);

/**
 * DELETE /api/posts/:id
 * Delete post
 * Requires authentication
 */
router.delete("/:id", authMiddleware, (req, res) =>
  postController.deletePost(req, res),
);

/**
 * POST /api/posts/:id/like
 * Toggle like on a post (like if not liked, unlike if already liked)
 * Requires authentication
 */
router.post("/:id/like", authMiddleware, (req, res) =>
  postController.toggleLike(req, res),
);

/**
 * Comments sub-routes
 * /api/posts/:postId/comments
 */
router.use("/:postId/comments", commentRouter);

export { router as postRouter };
