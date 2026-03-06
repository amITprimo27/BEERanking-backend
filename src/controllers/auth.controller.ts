import { Request, Response } from "express";

export class AuthController {
  /**
   * Sign up with email and password
   * Expects { username, email, password } in body
   */
  async signup(req: Request, res: Response) {
    // TODO: Implement signup with email/password
    // - Validate input (username, email, password)
    // - Hash password
    // - Create user document
    // - Generate JWT token
    // - Return token and user info
    res.status(201).json({ message: "User signed up" });
  }

  /**
   * Sign in with email and password
   * Expects { email, password } in body
   */
  async signin(req: Request, res: Response) {
    // TODO: Implement signin with email/password
    // - Validate input (email, password)
    // - Find user by email
    // - Compare password
    // - Generate JWT token
    // - Return token and user info
    res.json({ message: "User signed in" });
  }

  /**
   * Sign up with Google OAuth
   * Expects { googleToken } in body or query param
   */
  async signupGoogle(req: Request, res: Response) {
    // TODO: Implement signup with Google
    // - Verify Google token
    // - Extract user info from token (email, name, profile pic)
    // - Check if user already exists
    // - Create user document if new
    // - Generate JWT token
    // - Return token and user info
    res.status(201).json({ message: "User signed up with Google" });
  }

  /**
   * Sign in with Google OAuth
   * Expects { googleToken } in body or query param
   */
  async signinGoogle(req: Request, res: Response) {
    // TODO: Implement signin with Google
    // - Verify Google token
    // - Extract user info from token (email, name)
    // - Find or create user
    // - Generate JWT token
    // - Return token and user info
    res.json({ message: "User signed in with Google" });
  }
}
