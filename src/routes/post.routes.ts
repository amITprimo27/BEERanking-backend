import { Router } from "express";
import { PostController } from "../controllers/post.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadImage } from "../middlewares/multer.middleware";
import { commentRouter } from "./comment.routes";

const router = Router();
const postController = new PostController();

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all posts
 *     description: Returns paginated posts.
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         required: false
 *         description: Items per page (default 10)
 *     responses:
 *       200:
 *         description: Posts fetched successfully
 */
router.get("/", (req, res) => postController.get(req, res));

/**
 * @swagger
 * /api/posts/me:
 *   get:
 *     summary: Get current user's posts
 *     description: Returns paginated posts created by the authenticated user.
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         required: false
 *     responses:
 *       200:
 *         description: User posts fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authMiddleware, (req, res) =>
  postController.getUserPosts(req, res),
);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     tags:
 *       - Posts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post fetched successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Post not found
 */
router.get("/:id", (req, res) => postController.getById(req, res));

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a post
 *     description: Creates a new post with image, rating, beer, and description.
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *               - rating
 *               - beer
 *               - description
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               beer:
 *                 type: string
 *               description:
 *                 type: string
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - beer
 *               - description
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               beer:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", authMiddleware, ...uploadImage.single("image"), (req, res) =>
  postController.post(req, res),
);

/**
 * @swagger
 * /api/posts/{id}:
 *   patch:
 *     summary: Update a post
 *     description: Partially updates a post. Supports optional image upload.
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               beer:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               beer:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.patch(
  "/:id",
  authMiddleware,
  ...uploadImage.single("image"),
  (req, res) => postController.patch(req, res),
);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.delete("/:id", authMiddleware, (req, res) =>
  postController.del(req, res),
);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post
 *     description: Likes a post if not liked, otherwise removes the like.
 *     tags:
 *       - Posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like status toggled successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
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
