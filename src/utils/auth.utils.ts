import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

export type TokenContent = {
  userId: string;
};

export class AuthUtils {
  private static get _secret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error(
        "JWT_SECRET is required and must be at least 32 characters long",
      );
    }

    return secret;
  }

  static generateAccessToken(tokenContent: TokenContent): string {
    const secret = this._secret;
    const exp = parseInt(process.env.JWT_EXPIRES_IN || "3600"); // 1 hour
    return jwt.sign(tokenContent, secret, { expiresIn: exp });
  }

  static generateRefreshToken(tokenContent: TokenContent): string {
    const secret = this._secret;
    const exp = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "86400"); // 24 hours
    return jwt.sign(tokenContent, secret, {
      expiresIn: exp,
      jwtid: randomUUID(),
    });
  }

  static generateTokens(tokenContent: TokenContent): {
    token: string;
    refreshToken: string;
  } {
    return {
      token: this.generateAccessToken(tokenContent),
      refreshToken: this.generateRefreshToken(tokenContent),
    };
  }

  static verifyToken(token: string): TokenContent {
    return jwt.verify(token, this._secret) as TokenContent;
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    return authHeader.split(" ")[1];
  }

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
