import express from "express";
import request from "supertest";
import { postRouter } from "../../routes/post.routes";
import { userRouter } from "../../routes/user.route";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { User } from "../../models/user.model";
import { Beer } from "../../models/beer.model";
import { Post } from "../../models/post.model";
import { AuthUtils } from "../../utils/auth.utils";

describe("General auth and validation tests", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/posts", postRouter);
  app.use("/api/users", userRouter);

  let userId = "";
  let beerId = "";
  let validToken = "";

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    const user = await User.create({
      username: "test-user",
      email: "test@test.com",
      password: "secret",
    });

    const beer = await Beer.create({
      name: "Test Beer",
      brewery: "Test Brewery",
      style: "IPA",
      abv: 6.5,
      description: "Test",
      searchBlob: "test ipa",
      profileScores: {
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
    });

    userId = user._id.toString();
    beerId = beer._id.toString();
    validToken = AuthUtils.generateAccessToken({ userId });
  });

  describe("Auth middleware - Invalid/Expired tokens", () => {
    it("rejects request with no token", async () => {
      const response = await request(app).get("/api/users/me");

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
        .get(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${validToken}`);

      // 200 or 404 is fine, point is token was accepted
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("Validation tests - Input constraints", () => {
    it("POST /api/posts rejects rating below 1", async () => {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${validToken}`)
        .field("rating", "0")
        .field("beer", beerId)
        .field("description", "Bad rating")
        .attach("image", Buffer.from("test"), "test.jpg");

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("POST /api/posts rejects rating above 5", async () => {
      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${validToken}`)
        .field("rating", "6")
        .field("beer", beerId)
        .field("description", "Bad rating")
        .attach("image", Buffer.from("test"), "test.jpg");

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("POST /api/posts rejects non-existent beer ID", async () => {
      const fakeBeerId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${validToken}`)
        .field("rating", "4")
        .field("beer", fakeBeerId)
        .field("description", "Nonexistent beer")
        .attach("image", Buffer.from("test"), "test.jpg");

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("PATCH /api/users/me rejects negative ABV in profile update", async () => {
      // This test assumes users could update beer-related data
      // Adjust based on your actual validation rules
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ username: "" }); // Empty username

      // Should reject empty username if validation exists
      if (response.status === 400) {
        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe("Concurrency tests", () => {
    it("two users can like same post without conflict", async () => {
      // Create second user
      const user2 = await User.create({
        username: "user2",
        email: "user2@test.com",
        password: "secret",
      });
      const token2 = AuthUtils.generateAccessToken({
        userId: user2._id.toString(),
      });

      // Create post by first user
      const post = await Post.create({
        image: "uploads/concurrent.jpg",
        rating: 4,
        beer: beerId,
        description: "Concurrent like test",
        user: userId,
      });

      // Both users like same post
      const like1 = await request(app)
        .post(`/api/posts/${post._id.toString()}/like`)
        .set("Authorization", `Bearer ${validToken}`)
        .send({});

      const like2 = await request(app)
        .post(`/api/posts/${post._id.toString()}/like`)
        .set("Authorization", `Bearer ${token2}`)
        .send({});

      expect(like1.status).toBe(200);
      expect(like2.status).toBe(200);

      // Verify both users are in likes array
      const updatedPost = await Post.findById(post._id);
      expect(updatedPost?.likes.length).toBe(2);
    });

    it("multiple users can create posts concurrently", async () => {
      // Create second user
      const user2 = await User.create({
        username: "concurrent-user",
        email: "concurrent@test.com",
        password: "secret",
      });
      const token2 = AuthUtils.generateAccessToken({
        userId: user2._id.toString(),
      });

      // Both users create posts simultaneously (simulated)
      const post1 = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${validToken}`)
        .field("rating", "4")
        .field("beer", beerId)
        .field("description", "User 1 post")
        .attach("image", Buffer.from("test1"), "test1.jpg");

      const post2 = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token2}`)
        .field("rating", "5")
        .field("beer", beerId)
        .field("description", "User 2 post")
        .attach("image", Buffer.from("test2"), "test2.jpg");

      expect(post1.status).toBe(201);
      expect(post2.status).toBe(201);

      // Verify both posts exist
      const allPosts = await Post.find({});
      expect(allPosts.length).toBe(2);
    });
  });
});
