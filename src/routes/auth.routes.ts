import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();
const authController = new AuthController();

/**
 * POST /api/auth/signup
 * Sign up with email and password
 * Expects: { username, email, password }
 */
router.post("/signup", (req, res) => authController.signup(req, res));

/**
 * POST /api/auth/signin
 * Sign in with email and password
 * Expects: { email, password }
 */
router.post("/signin", (req, res) => authController.signin(req, res));

/**
 * POST /api/auth/signup/google
 * Sign up with Google OAuth
 * Expects: { googleToken }
 */
router.post("/signup/google", (req, res) =>
  authController.signupGoogle(req, res),
);

/**
 * POST /api/auth/signin/google
 * Sign in with Google OAuth
 * Expects: { googleToken }
 */
router.post("/signin/google", (req, res) =>
  authController.signinGoogle(req, res),
);

export { router as authRouter };
