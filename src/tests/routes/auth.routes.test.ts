import express from "express";
import request from "supertest";
import { authRouter } from "../../routes/auth.routes";
import { postRouter } from "../../routes/post.routes";
import { userRouter } from "../../routes/user.route";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { User } from "../../models/user.model";
import { Beer } from "../../models/beer.model";
import { AuthUtils } from "../../utils/auth.utils";
import { OAuth2Client } from "google-auth-library";

jest.mock("google-auth-library");

describe("Auth routes and middleware integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use("/api/posts", postRouter);
  app.use("/api/users", userRouter);

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe("Auth utils security", () => {
    it("throws when JWT_SECRET is missing or too short", () => {
      const originalSecret = process.env.JWT_SECRET;

      process.env.JWT_SECRET = "short-secret";

      expect(() =>
        AuthUtils.generateAccessToken({ userId: "123456789012" }),
      ).toThrow(
        "JWT_SECRET is required and must be at least 32 characters long",
      );

      if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalSecret;
      }
    });
  });

  describe("POST /api/auth/signup", () => {
    it("creates user in DB with hashed password", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        username: "newuser",
        email: "newuser@test.com",
        password: "securepassword",
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("User signed up");
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("newuser@test.com");

      // Verify user created in DB with hashed password
      const user = await User.findOne({ email: "newuser@test.com" }).select(
        "+password",
      );
      expect(user).not.toBeNull();
      expect(user?.password).not.toBe("securepassword"); // Password should be hashed
    });

    it("rejects duplicate email", async () => {
      // Create first user
      await User.create({
        username: "user1",
        email: "duplicate@test.com",
        password: "hashedpass",
      });

      // Try to signup with same email
      const response = await request(app).post("/api/auth/signup").send({
        username: "user2",
        email: "duplicate@test.com",
        password: "password",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing username", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        email: "test@test.com",
        password: "password",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        username: "testuser",
        password: "password",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing password", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        username: "testuser",
        email: "test@test.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for invalid email format", async () => {
      const response = await request(app).post("/api/auth/signup").send({
        username: "testuser",
        email: "not-an-email",
        password: "password",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for duplicate username", async () => {
      // Create first user
      await User.create({
        username: "duplicate-username",
        email: "user1@test.com",
        password: "hashedpass",
      });

      // Try to signup with same username
      const response = await request(app).post("/api/auth/signup").send({
        username: "duplicate-username",
        email: "user2@test.com",
        password: "password",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/signin", () => {
    beforeEach(async () => {
      // Create a user for signin tests with hashed password (like signup controller does)
      const hashedPassword = await AuthUtils.hashPassword("correctpassword");
      await User.create({
        username: "signinuser",
        email: "signin@test.com",
        password: hashedPassword,
      });
    });

    it("signs in user with correct credentials", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        username: "signinuser",
        password: "correctpassword",
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User signed in");
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe("signinuser");
    });

    it("returns 401 for wrong password", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        username: "signinuser",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("returns 401 for non-existent user", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        username: "nonexistentuser",
        password: "password",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing username", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        password: "password",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing password", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        username: "signinuser",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns valid JWT token after signin", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        username: "signinuser",
        password: "correctpassword",
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Verify token is parseable and contains userId
      const decodedToken = AuthUtils.verifyToken(response.body.token);
      expect(decodedToken.userId).toBeDefined();

      // Verify refresh token is parseable and contains userId
      const decodedRefreshToken = AuthUtils.verifyToken(
        response.body.refreshToken,
      );
      expect(decodedRefreshToken.userId).toBeDefined();
    });
  });

  describe("POST /api/auth/signup/google", () => {
    const mockVerifyIdToken = jest.fn();

    beforeEach(() => {
      const MockedOAuth2Client = OAuth2Client as jest.MockedClass<
        typeof OAuth2Client
      >;
      MockedOAuth2Client.mockImplementation(
        () =>
          ({
            verifyIdToken: mockVerifyIdToken,
          }) as any,
      );
      mockVerifyIdToken.mockClear();
    });

    it("creates user from Google token", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "google-id-123",
          email: "newgoogleuser@test.com",
          name: "Google User",
          picture: "https://example.com/picture.jpg",
        }),
      });

      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("User signed up with Google");
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("newgoogleuser@test.com");

      const user = await User.findOne({
        email: "newgoogleuser@test.com",
      }).select("+googleId");
      expect(user).not.toBeNull();
      expect(user?.googleId).toBe("google-id-123");
      expect(user?.profilePic).toBe("https://example.com/picture.jpg");
    });

    it("handles duplicate username by appending random numeric suffix", async () => {
      await User.create({
        username: "Google User",
        email: "existing@test.com",
        password: "hashedpassword",
      });

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "google-id-456",
          email: "another@test.com",
          name: "Google User",
        }),
      });

      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.username).toMatch(/^Google User\d{6}$/);
    });

    it("returns 409 if Google account already registered", async () => {
      await User.create({
        username: "existinguser",
        email: "existing@test.com",
        googleId: "google-id-789",
      });

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "google-id-789",
          email: "different@test.com",
          name: "Different User",
        }),
      });

      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Google account already registered");
    });

    it("returns 409 if email already exists", async () => {
      await User.create({
        username: "existinguser",
        email: "duplicate@test.com",
        password: "hashedpassword",
      });

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "google-id-new",
          email: "duplicate@test.com",
          name: "New User",
        }),
      });

      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email already exists");
    });

    it("returns 400 for missing Google token", async () => {
      const response = await request(app)
        .post("/api/auth/signup/google")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Google token is required");
    });

    it("returns 401 for invalid Google token", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid Google token");
    });
  });

  describe("POST /api/auth/signin/google", () => {
    const mockVerifyIdToken = jest.fn();

    beforeEach(async () => {
      const MockedOAuth2Client = OAuth2Client as jest.MockedClass<
        typeof OAuth2Client
      >;
      MockedOAuth2Client.mockImplementation(
        () =>
          ({
            verifyIdToken: mockVerifyIdToken,
          }) as any,
      );
      mockVerifyIdToken.mockClear();

      await User.create({
        username: "googlesigninuser",
        email: "google@test.com",
        googleId: "google-signin-123",
      });
    });

    it("signs in user with valid Google token", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "google-signin-123",
          email: "google@test.com",
        }),
      });

      const response = await request(app).post("/api/auth/signin/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User signed in with Google");
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("google@test.com");
    });

    it("returns 401 if user not found", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "nonexistent-google-id",
          email: "notfound@test.com",
        }),
      });

      const response = await request(app).post("/api/auth/signin/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("User not found. Please sign up first.");
    });

    it("returns 400 for missing Google token", async () => {
      const response = await request(app)
        .post("/api/auth/signin/google")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Google token is required");
    });

    it("returns 401 for invalid Google token", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const response = await request(app).post("/api/auth/signin/google").send({
        googleToken: "invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid Google token");
    });
  });

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create user and get tokens
      const hashedPassword = await AuthUtils.hashPassword("password");
      const user = await User.create({
        username: "refreshuser",
        email: "refresh@test.com",
        password: hashedPassword,
      });
      userId = user._id.toString();

      const { token, refreshToken: rt } = AuthUtils.generateTokens({
        userId,
      });
      refreshToken = rt;

      // Store token in user
      user.refreshTokens.push(refreshToken);
      await user.save();
    });

    it("returns new tokens with valid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Token refreshed");
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Verify new token is valid
      const decoded = AuthUtils.verifyToken(response.body.token);
      expect(decoded.userId).toBe(userId);
    });

    it("rotates refresh token by removing old and adding new", async () => {
      const user = await User.findById(userId).select("+refreshTokens");
      user!.refreshTokens.splice(0, user!.refreshTokens.length);
      user!.refreshTokens.push(
        "old-token-1",
        "old-token-2",
        refreshToken,
        "old-token-3",
      );
      await user!.save();

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);

      const updatedUser = await User.findById(userId).select("+refreshTokens");
      const tokens = updatedUser!.refreshTokens;

      expect(tokens).not.toContain(refreshToken);
      expect(tokens).toContain(response.body.refreshToken);
      expect(tokens).toContain("old-token-1");
      expect(tokens).toContain("old-token-2");
      expect(tokens).toContain("old-token-3");
    });

    it("returns 401 for invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("returns 401 for revoked refresh token", async () => {
      // Remove token from user's refresh tokens
      const user = await User.findById(userId).select("+refreshTokens");
      user!.refreshTokens = [];
      await user!.save();

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or revoked refresh token");
    });

    it("returns 400 for missing refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Refresh token is required");
    });
  });

  describe("Auth middleware - Invalid/Expired tokens", () => {
    let userId = "";
    let beerId = "";
    let validToken = "";

    beforeEach(async () => {
      const user = await User.create({
        username: "middleware-test-user",
        email: "middleware@test.com",
        password: "secret",
      });

      const beer = await Beer.create({
        name: "Test Beer",
        brewery: "Test Brewery",
        style: "IPA",
        abv: 6.5,
        description: "Test",
        searchBlob: "test ipa",
        normalizedProfileScores: {
          Astringency: 1,
          Body: 2,
          Alcohol: 3,
          Bitter: 4,
          Sweet: 1,
          Sour: 1,
          Salty: 0,
          Fruits: 2,
          Hoppy: 5,
          Spices: 1,
          Malty: 1,
        },
        originalProfileScores: {
          Astringency: 10,
          Body: 20,
          Alcohol: 30,
          Bitter: 40,
          Sweet: 10,
          Sour: 10,
          Salty: 0,
          Fruits: 20,
          Hoppy: 50,
          Spices: 10,
          Malty: 10,
        },
      });

      userId = user._id.toString();
      beerId = beer._id.toString();
      validToken = AuthUtils.generateAccessToken({ userId });
    });

    it("rejects request with no token", async () => {
      const response = await request(app).get("/api/posts/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("rejects request with invalid token format", async () => {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", "Bearer invalid-token-format")
        .send({
          rating: 4,
          beer: beerId,
          description: "Test",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("rejects request with malformed Authorization header", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", "InvalidHeaderFormat validtoken")
        .send({ username: "test" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("accepts valid token", async () => {
      const response = await request(app)
        .get("/api/posts/me")
        .set("Authorization", `Bearer ${validToken}`);

      // Should not be 401, point is token was accepted
      expect(response.status).not.toBe(401);
      expect(response.body.error).not.toBe("Unauthorized");
    });
  });
});
