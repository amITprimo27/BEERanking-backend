import express from "express";
import request from "supertest";
import { authRouter } from "../../routes/auth.routes";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { User } from "../../models/user.model";
import { AuthUtils } from "../../utils/auth.utils";

describe("Auth routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
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
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("newuser@test.com");

      // Verify user created in DB with hashed password
      const user = await User.findOne({ email: "newuser@test.com" });
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
        email: "signin@test.com",
        password: "correctpassword",
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User signed in");
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("signin@test.com");
    });

    it("returns 401 for wrong password", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        email: "signin@test.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("returns 401 for non-existent user", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        email: "nonexistent@test.com",
        password: "password",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing email", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        password: "password",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing password", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        email: "signin@test.com",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns valid JWT token after signin", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        email: "signin@test.com",
        password: "correctpassword",
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();

      // Verify token is parseable and contains userId
      const decodedToken = AuthUtils.verifyToken(response.body.token);
      expect(decodedToken.userId).toBeDefined();
    });
  });

  describe("POST /api/auth/signup/google", () => {
    it("creates user from Google token with empty password", async () => {
      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("User signed up with Google");
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();

      // Verify user created in DB with empty password (Google users don't have passwords)
      const user = await User.findOne({
        googleId: response.body.user.googleId,
      });
      expect(user).not.toBeNull();
      expect(user?.password).toBe(""); // Password should be empty for Google users
    });

    it("returns 400 for missing Google token", async () => {
      const response = await request(app)
        .post("/api/auth/signup/google")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 401 for invalid Google token", async () => {
      const response = await request(app).post("/api/auth/signup/google").send({
        googleToken: "invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/signin/google", () => {
    beforeEach(async () => {
      // Create a user with Google ID for signin tests
      const hashedPassword = await AuthUtils.hashPassword(""); // Empty password for Google users
      await User.create({
        username: "googlesigninuser",
        email: "google@test.com",
        googleId: "google-id-123",
        password: hashedPassword,
      });
    });

    it("signs in user with valid Google token", async () => {
      const response = await request(app).post("/api/auth/signin/google").send({
        googleToken: "valid-google-token",
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User signed in with Google");
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
    });

    it("returns 400 for missing Google token", async () => {
      const response = await request(app)
        .post("/api/auth/signin/google")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 401 for invalid Google token", async () => {
      const response = await request(app).post("/api/auth/signin/google").send({
        googleToken: "invalid-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });
});
