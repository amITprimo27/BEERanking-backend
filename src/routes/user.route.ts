import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const userController = new UserController();

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get("/:id", (req, res) => userController.getById(req, res));

/**
 * PATCH /api/users/me
 * Update authenticated user partially with optional profile picture upload
 * Handles profile pic, username, email, and favoriteBeers updates
 * Expects multipart/form-data or JSON body
 * Requires authentication
 */
router.patch("/me", authMiddleware, (req, res) =>
  userController.updateUser(req, res),
);

export { router as userRouter };
