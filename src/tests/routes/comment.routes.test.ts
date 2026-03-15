import express from "express";
import request from "supertest";
import { postRouter } from "../../routes/post.routes";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { User } from "../../models/user.model";
import { Beer } from "../../models/beer.model";
import { Post } from "../../models/post.model";
import { Comment } from "../../models/comment.model";
import { AuthUtils } from "../../utils/auth.utils";

describe("Comment routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/posts", postRouter);

  let token1 = "";
  let token2 = "";
  let userId1 = "";
  let userId2 = "";
  let postId = "";
  let beerId = "";

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create two users
    const user1 = await User.create({
      username: "comment-user1",
      email: "comment1@test.com",
      password: "secret",
    });

    const user2 = await User.create({
      username: "comment-user2",
      email: "comment2@test.com",
      password: "secret",
    });

    // Create beer
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

    // Create post
    const post = await Post.create({
      image: "uploads/test.jpg",
      rating: 4,
      beer: beer._id,
      description: "Test post for comments",
      user: user1._id,
    });

    userId1 = user1._id.toString();
    userId2 = user2._id.toString();
    beerId = beer._id.toString();
    postId = post._id.toString();
    token1 = AuthUtils.generateAccessToken({ userId: userId1 });
    token2 = AuthUtils.generateAccessToken({ userId: userId2 });
  });

  describe("POST /api/posts/:postId/comments", () => {
    it("creates comment in DB", async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          text: "This is a great post!",
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Comment added");

      // Verify comment created in DB
      const comment = await Comment.findOne({ text: "This is a great post!" });
      expect(comment).not.toBeNull();
      expect(comment?.user.toString()).toBe(userId1);
      expect(comment?.post.toString()).toBe(postId);
    });

    it("requires authentication", async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .send({
          text: "No auth comment",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("returns 400 for empty text", async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          text: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for missing text field", async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for text exceeding 5000 chars", async () => {
      const longText = "a".repeat(5001);

      const response = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          text: longText,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("returns 404 for invalid post ID", async () => {
      const fakePostId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .post(`/api/posts/${fakePostId}/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          text: "Comment on nonexistent post",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for invalid post ID format", async () => {
      const response = await request(app)
        .post(`/api/posts/invalid-id/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          text: "Bad format",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/posts/:postId/comments", () => {
    beforeEach(async () => {
      // Create multiple comments
      for (let i = 0; i < 5; i++) {
        await Comment.create({
          text: `Comment ${i}`,
          user: i % 2 === 0 ? userId1 : userId2,
          post: postId,
        });
      }
    });

    it("returns comments with pagination", async () => {
      const response = await request(app).get(
        `/api/posts/${postId}/comments?page=1&limit=3`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it("returns comments sorted by newest first", async () => {
      const response = await request(app).get(`/api/posts/${postId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(1);

      // Verify sorting: first comment should be newer than second
      if (response.body.data.length > 1) {
        const first = new Date(response.body.data[0].createdAt);
        const second = new Date(response.body.data[1].createdAt);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });

    it("populates user data in comments", async () => {
      const response = await request(app).get(`/api/posts/${postId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);

      const comment = response.body.data[0];
      expect(comment.user).toBeDefined();
      expect(comment.user.username).toBeDefined();
    });

    it("returns empty array for post with no comments", async () => {
      // Create new post without comments
      const newPost = await Post.create({
        image: "uploads/empty.jpg",
        rating: 3,
        beer: beerId,
        description: "Empty post",
        user: userId1,
      });

      const response = await request(app).get(
        `/api/posts/${newPost._id}/comments`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    it("respects limit parameter", async () => {
      const response = await request(app).get(
        `/api/posts/${postId}/comments?limit=2`,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it("returns 404 for nonexistent post", async () => {
      const fakePostId = "507f1f77bcf86cd799439011";

      const response = await request(app).get(
        `/api/posts/${fakePostId}/comments`,
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it("returns 400 for invalid post ID format", async () => {
      const response = await request(app).get(`/api/posts/invalid-id/comments`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe("Comment concurrency", () => {
    it("multiple users can comment on same post", async () => {
      const comment1 = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          text: "User 1 comment",
        });

      const comment2 = await request(app)
        .post(`/api/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${token2}`)
        .send({
          text: "User 2 comment",
        });

      expect(comment1.status).toBe(201);
      expect(comment2.status).toBe(201);

      // Verify both comments exist
      const allComments = await Comment.find({ post: postId });
      expect(allComments.length).toBe(2);
    });

    it("pagination handles concurrent comment creation correctly", async () => {
      // Create 25 comments
      for (let i = 0; i < 25; i++) {
        await Comment.create({
          text: `Comment ${i}`,
          user: i % 2 === 0 ? userId1 : userId2,
          post: postId,
        });
      }

      // Get first page
      const page1 = await request(app).get(
        `/api/posts/${postId}/comments?page=1&limit=10`,
      );

      // Get second page
      const page2 = await request(app).get(
        `/api/posts/${postId}/comments?page=2&limit=10`,
      );

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);
      expect(page1.body.data.length).toBe(10);
      expect(page2.body.data.length).toBe(10);
      expect(page1.body.pagination.total).toBe(25);
    });
  });
});
