import jwt from "jsonwebtoken";

export type TokenContent = {
  userId: string;
};

export class AuthUtils {
  private static get secret(): string {
    return process.env.JWT_SECRET || "secretkey";
  }

  static generateAccessToken(tokenContent: TokenContent): string {
    const secret = this.secret;
    const exp = parseInt(process.env.JWT_EXPIRES_IN || "3600"); // 1 hour
    return jwt.sign(tokenContent, secret, { expiresIn: exp });
  }

  static generateRefreshToken(tokenContent: TokenContent): string {
    const secret = this.secret;
    const exp = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "86400"); // 24 hours
    return jwt.sign(tokenContent, secret, { expiresIn: exp });
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
    return jwt.verify(token, this.secret) as TokenContent;
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    return authHeader.split(" ")[1];
  }
}
