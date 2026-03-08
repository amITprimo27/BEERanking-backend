import { Router, Request, Response } from "express";
import { UserController } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadProfilePic } from "../middlewares/multer.middleware";

const router = Router();
const userController = new UserController();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the currently authenticated user with favorite beers populated.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user returned successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/me", authMiddleware, (req, res) => userController.getMe(req, res));

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update current authenticated user
 *     description: Partially updates username, favorite beers, and optional profile picture.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: []
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *               favoriteBeers:
 *                 type: string
 *                 description: JSON stringified array of beer ObjectIds (e.g. ["<beerId>"])
 *               profilePic:
 *                 type: string
 *                 format: binary
 *           encoding:
 *             profilePic:
 *               contentType: image/*
 *         application/json:
 *           schema:
 *             type: object
 *             required: []
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *               favoriteBeers:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Beer ObjectId
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid input or no fields to update
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Duplicate username
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/me",
  authMiddleware,
  ...uploadProfilePic.single("profilePic"),
  (req: Request, res: Response) => userController.updateUser(req, res),
);

export { router as userRouter };
