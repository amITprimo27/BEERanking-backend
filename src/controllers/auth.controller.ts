import { Request, Response } from "express";
import { User } from "../models/user.model";
import { AuthUtils } from "../utils/auth.utils";
import { OAuth2Client } from "google-auth-library";

export class AuthController {
  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private generateRandomNumericSuffix(length = 6): string {
    const max = 10 ** length;
    const min = 10 ** (length - 1);
    return Math.floor(Math.random() * (max - min) + min).toString();
  }

  private async createGoogleUserWithUniqueUsername(params: {
    username: string;
    email: string;
    googleId: string;
    profilePic?: string;
  }) {
    const { username, email, googleId, profilePic } = params;
    const maxAttempts = 25;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidateUsername =
        attempt === 0
          ? username
          : `${username}${this.generateRandomNumericSuffix(6)}`;

      try {
        return await User.create({
          username: candidateUsername,
          email,
          googleId,
          profilePic,
        });
      } catch (error) {
        if (!this.isDuplicateKeyError(error)) {
          throw error;
        }

        const keyPattern = (error as { keyPattern?: Record<string, unknown> })
          .keyPattern;

        if (keyPattern?.googleId) {
          throw new Error("GOOGLE_ID_EXISTS");
        }

        if (keyPattern?.email) {
          throw new Error("EMAIL_EXISTS");
        }

        if (!keyPattern?.username) {
          throw error;
        }
      }
    }

    throw new Error("USERNAME_GENERATION_FAILED");
  }

  /**
   * Sign up with email and password
   * Expects { username, email, password } in body
   */
  async signup(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const hashedPassword = await AuthUtils.hashPassword(password);

      const user = await User.create({
        username,
        email,
        password: hashedPassword,
      });

      const { token, refreshToken } = AuthUtils.generateTokens({
        userId: user._id.toString(),
      });

      user.refreshTokens.push(refreshToken);
      await user.save();

      const userResponse = {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        favoriteBeers: user.favoriteBeers,
      };

      return res.status(201).json({
        message: "User signed up",
        token,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Sign in with username and password
   * Expects { username, password } in body
   */
  async signin(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await User.findOne({ username })
        .select("+password +refreshTokens")
        .populate("favoriteBeers");

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isPasswordValid = await AuthUtils.comparePassword(
        password,
        user.password || "",
      );

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const { token, refreshToken } = AuthUtils.generateTokens({
        userId: user._id.toString(),
      });

      user.refreshTokens.push(refreshToken);
      await user.save();

      const userResponse = {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        favoriteBeers: user.favoriteBeers,
      };

      return res.json({
        message: "User signed in",
        token,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Refresh access token using refresh token
   * Expects { refreshToken } in body
   */
  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const decoded = AuthUtils.verifyToken(refreshToken);

      const user = await User.findById(decoded.userId).select("+refreshTokens");
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const tokenExists = user.refreshTokens.includes(refreshToken);

      if (!tokenExists) {
        user.refreshTokens = [];
        await user.save();
        return res
          .status(401)
          .json({ error: "Invalid or revoked refresh token" });
      }

      const { token, refreshToken: newRefreshToken } = AuthUtils.generateTokens(
        { userId: user._id.toString() },
      );

      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
      user.refreshTokens.push(newRefreshToken);
      await user.save();

      return res.json({
        message: "Token refreshed",
        token,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  }

  /**
   * Sign up with Google OAuth
   * Expects { googleToken } in body
   */
  async signupGoogle(req: Request, res: Response) {
    try {
      const { googleToken } = req.body;

      if (!googleToken) {
        return res.status(400).json({ error: "Google token is required" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res
          .status(500)
          .json({ error: "Google OAuth is not configured" });
      }

      const client = new OAuth2Client(clientId);

      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: clientId,
        });
      } catch (error) {
        return res.status(401).json({ error: "Invalid Google token" });
      }

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        return res.status(401).json({ error: "Invalid Google token payload" });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const username = payload.name || email.split("@")[0];
      const profilePic = payload.picture;
      const existingUserByGoogleId = await User.findOne({ googleId }).select(
        "+googleId",
      );
      if (existingUserByGoogleId) {
        return res
          .status(409)
          .json({ error: "Google account already registered" });
      }

      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const user = await this.createGoogleUserWithUniqueUsername({
        username,
        email,
        googleId,
        profilePic,
      });

      const { token, refreshToken } = AuthUtils.generateTokens({
        userId: user._id.toString(),
      });

      user.refreshTokens.push(refreshToken);
      await user.save();

      const userResponse = {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        favoriteBeers: user.favoriteBeers,
      };

      return res.status(201).json({
        message: "User signed up with Google",
        token,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "GOOGLE_ID_EXISTS") {
        return res
          .status(409)
          .json({ error: "Google account already registered" });
      }

      if (error instanceof Error && error.message === "EMAIL_EXISTS") {
        return res.status(409).json({ error: "Email already exists" });
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Sign in with Google OAuth
   * Expects { googleToken } in body
   */
  async signinGoogle(req: Request, res: Response) {
    try {
      const { googleToken } = req.body;

      if (!googleToken) {
        return res.status(400).json({ error: "Google token is required" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res
          .status(500)
          .json({ error: "Google OAuth is not configured" });
      }

      const client = new OAuth2Client(clientId);

      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken: googleToken,
          audience: clientId,
        });
      } catch (error) {
        return res.status(401).json({ error: "Invalid Google token" });
      }

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        return res.status(401).json({ error: "Invalid Google token payload" });
      }

      const googleId = payload.sub;

      const user = await User.findOne({ googleId })
        .select("+googleId +refreshTokens")
        .populate("favoriteBeers");

      if (!user) {
        return res
          .status(401)
          .json({ error: "User not found. Please sign up first." });
      }

      const { token, refreshToken } = AuthUtils.generateTokens({
        userId: user._id.toString(),
      });

      user.refreshTokens.push(refreshToken);
      await user.save();

      const userResponse = {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        favoriteBeers: user.favoriteBeers,
      };

      return res.json({
        message: "User signed in with Google",
        token,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
