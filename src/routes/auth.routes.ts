import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Sign up a new user
 *     description: Creates a new user with email and password.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Internal server error
 */
router.post("/signup", (req, res) => authController.signup(req, res));

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in a user
 *     description: Authenticates a user with username and password.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User signed in successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post("/signin", (req, res) => authController.signin(req, res));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Uses a refresh token to obtain a new access token.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid refresh token
 */
router.post("/refresh", (req, res) => authController.refresh(req, res));

/**
 * @swagger
 * /api/auth/signup/google:
 *   post:
 *     summary: Sign up with Google OAuth
 *     description: Creates a new user from Google token.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - googleToken
 *             properties:
 *               googleToken:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Google token is required
 *       401:
 *         description: Invalid Google token
 *       409:
 *         description: Google account already registered
 *       500:
 *         description: Internal server error
 */
router.post("/signup/google", (req, res) =>
  authController.signupGoogle(req, res),
);

/**
 * @swagger
 * /api/auth/signin/google:
 *   post:
 *     summary: Sign in with Google OAuth
 *     description: Authenticates a user with Google token.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - googleToken
 *             properties:
 *               googleToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: User signed in successfully
 *       400:
 *         description: Google token is required
 *       401:
 *         description: Invalid Google token or user not found
 *       500:
 *         description: Internal server error
 */
router.post("/signin/google", (req, res) =>
  authController.signinGoogle(req, res),
);

export { router as authRouter };
