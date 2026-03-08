import express from "express";
import request from "supertest";
import { postRouter } from "../../routes/post.routes";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { User } from "../../models/user.model";
import { Beer } from "../../models/beer.model";
import { Post } from "../../models/post.model";
import { AuthUtils } from "../../utils/auth.utils";
import { UPLOADS_DIR, toPublicAbsolutePath } from "../../utils/paths.utils";
import * as fs from "fs";

describe("Post routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/posts", postRouter);

  let token = "";
  let userId = "";
  let beerId = "";
  const uploadDir = UPLOADS_DIR;
  const uploadedFiles: string[] = [];

  beforeAll(async () => {
    await connectTestDb();
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(() => {
    // Clean up uploaded files after each test
    uploadedFiles.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    uploadedFiles.length = 0; // Clear the array
  });

  beforeEach(async () => {
    await clearTestDb();

    const user = await User.create({
      username: "post-user",
      email: "post-user@test.com",
      password: "secret",
    });

    const beer = await Beer.create({
      name: "Test Beer",
      brewery: "Test Brewery",
      style: "Lager",
      abv: 5,
      description: "A test beer",
      searchBlob: "test lager",
      profileScores: {
        Astringency: 1,
        Body: 1,
        Alcohol: 1,
        Bitter: 1,
        Sweet: 1,
        Sour: 1,
        Salty: 1,
        Fruits: 1,
        Hoppy: 1,
        Spices: 1,
        Malty: 1,
      },
    });

    userId = user._id.toString();
    beerId = beer._id.toString();
    token = AuthUtils.generateAccessToken({ userId });
  });

  it("POST /api/posts creates post in DB with image file", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .field("rating", "4")
      .field("beer", beerId)
      .field("description", "Great beer!")
      .attach("image", Buffer.from("fake image data"), "test.jpg");

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Post added");

    // Verify the post was created in DB with image path
    const createdPost = await Post.findOne({ description: "Great beer!" });
    expect(createdPost).not.toBeNull();
    expect(createdPost?.image).toBeDefined();
    expect(createdPost?.image).toContain("uploads/");

    // Verify the file exists in public/uploads
    const imagePath = toPublicAbsolutePath(createdPost!.image);
    expect(fs.existsSync(imagePath)).toBe(true);
    uploadedFiles.push(imagePath); // Track for cleanup
  });

  it("POST /api/posts rejects rating below 1", async () => {
    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
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
      .set("Authorization", `Bearer ${token}`)
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
      .set("Authorization", `Bearer ${token}`)
      .field("rating", "4")
      .field("beer", fakeBeerId)
      .field("description", "Nonexistent beer")
      .attach("image", Buffer.from("test"), "test.jpg");

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it("GET /api/posts returns stored posts", async () => {
    await Post.create({
      image: "uploads/test2.jpg",
      rating: 5,
      beer: beerId,
      description: "Another beer",
      user: userId,
    });

    const response = await request(app).get("/api/posts");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.pagination).toBeDefined();
  });

  it("GET /api/posts/me requires authentication", async () => {
    const response = await request(app).get("/api/posts/me");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Unauthorized");
  });

  it("GET /api/posts/me returns only current user's posts", async () => {
    // Create another user
    const otherUser = await User.create({
      username: "other-user",
      email: "other@test.com",
      password: "secret",
    });

    // Create posts for current user
    await Post.create({
      image: "uploads/my-post1.jpg",
      rating: 4,
      beer: beerId,
      description: "My first post",
      user: userId,
    });

    await Post.create({
      image: "uploads/my-post2.jpg",
      rating: 5,
      beer: beerId,
      description: "My second post",
      user: userId,
    });

    // Create post for other user
    await Post.create({
      image: "uploads/other-post.jpg",
      rating: 3,
      beer: beerId,
      description: "Someone else's post",
      user: otherUser._id,
    });

    const response = await request(app)
      .get("/api/posts/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("User posts retrieved");
    expect(response.body.data).toBeDefined();
  });

  it("GET /api/posts/me supports pagination", async () => {
    // Create multiple posts
    for (let i = 0; i < 15; i++) {
      await Post.create({
        image: `uploads/post${i}.jpg`,
        rating: 4,
        beer: beerId,
        description: `Post ${i}`,
        user: userId,
      });
    }

    const response = await request(app)
      .get("/api/posts/me?page=1&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });

  it("GET /api/posts/:id returns single post by ID", async () => {
    const post = await Post.create({
      image: "uploads/single.jpg",
      rating: 4,
      beer: beerId,
      description: "Single post",
      user: userId,
    });

    const response = await request(app).get(
      `/api/posts/${post._id.toString()}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data._id).toBe(post._id.toString());
  });

  it("GET /api/posts/:id returns 400 for invalid post ID format", async () => {
    const response = await request(app).get("/api/posts/invalid-id");

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it("GET /api/posts/:id returns 404 for non-existent post", async () => {
    const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId but doesn't exist

    const response = await request(app).get(`/api/posts/${fakeId}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });

  it("POST /api/posts/:id/like toggles like in DB", async () => {
    const post = await Post.create({
      image: "uploads/like.jpg",
      rating: 4,
      beer: beerId,
      description: "Like me",
      user: userId,
    });

    const likeResponse = await request(app)
      .post(`/api/posts/${post._id.toString()}/like`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(likeResponse.status).toBe(200);
    expect(likeResponse.body.hasLiked).toBe(true);

    const likedPost = await Post.findById(post._id);
    expect(likedPost?.likes.length).toBe(1);

    const unlikeResponse = await request(app)
      .post(`/api/posts/${post._id.toString()}/like`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(unlikeResponse.status).toBe(200);
    expect(unlikeResponse.body.hasLiked).toBe(false);

    const unlikedPost = await Post.findById(post._id);
    expect(unlikedPost?.likes.length).toBe(0);
  });

  it("PATCH /api/posts/:id updates post with optional image file", async () => {
    const post = await Post.create({
      image: "uploads/update.jpg",
      rating: 3,
      beer: beerId,
      description: "Original description",
      user: userId,
    });

    const response = await request(app)
      .patch(`/api/posts/${post._id.toString()}`)
      .set("Authorization", `Bearer ${token}`)
      .field("rating", "5")
      .field("description", "Updated description")
      .attach("image", Buffer.from("updated image data"), "updated.jpg");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Post updated");

    // Verify the updated post has new image path
    const updatedPost = await Post.findById(post._id);
    expect(updatedPost?.image).toBeDefined();
    expect(updatedPost?.image).toContain("uploads/");

    // Verify the new file exists in public/uploads
    const newImagePath = toPublicAbsolutePath(updatedPost!.image);
    expect(fs.existsSync(newImagePath)).toBe(true);
    uploadedFiles.push(newImagePath); // Track for cleanup
  });

  it("PATCH /api/posts/:id returns 403 if user is not post owner", async () => {
    // Create another user
    const otherUser = await User.create({
      username: "other-user",
      email: "other@test.com",
      password: "secret",
    });
    const otherToken = AuthUtils.generateAccessToken({
      userId: otherUser._id.toString(),
    });

    // Create post by current user
    const post = await Post.create({
      image: "uploads/update.jpg",
      rating: 3,
      beer: beerId,
      description: "Original description",
      user: userId,
    });

    // Try to update with other user's token
    const response = await request(app)
      .patch(`/api/posts/${post._id.toString()}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ rating: 5 });

    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();
  });

  it("PATCH /api/posts/:id returns 400 for invalid post ID", async () => {
    const response = await request(app)
      .patch("/api/posts/invalid-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ rating: 5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it("PATCH /api/posts/:id returns 404 for non-existent post", async () => {
    const fakeId = "507f1f77bcf86cd799439011";

    const response = await request(app)
      .patch(`/api/posts/${fakeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ rating: 5 });

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });

  it("DELETE /api/posts/:id removes post from DB", async () => {
    const post = await Post.create({
      image: "uploads/delete.jpg",
      rating: 4,
      beer: beerId,
      description: "To be deleted",
      user: userId,
    });

    const postId = post._id.toString();
    const postExistsBefore = await Post.findById(postId);
    expect(postExistsBefore).not.toBeNull();

    const response = await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    const postExistsAfter = await Post.findById(postId);
    expect(postExistsAfter).toBeNull();

    // Verify the associated image file was also deleted
    const imagePath = toPublicAbsolutePath(post.image);
    expect(fs.existsSync(imagePath)).toBe(false);
  });

  it("DELETE /api/posts/:id returns 403 if user is not post owner", async () => {
    // Create another user
    const otherUser = await User.create({
      username: "other-delete-user",
      email: "other-delete@test.com",
      password: "secret",
    });
    const otherToken = AuthUtils.generateAccessToken({
      userId: otherUser._id.toString(),
    });

    // Create post by current user
    const post = await Post.create({
      image: "uploads/delete.jpg",
      rating: 4,
      beer: beerId,
      description: "To be deleted",
      user: userId,
    });

    // Try to delete with other user's token
    const response = await request(app)
      .delete(`/api/posts/${post._id.toString()}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();

    // Verify post still exists
    const postStillExists = await Post.findById(post._id);
    expect(postStillExists).not.toBeNull();
  });

  it("DELETE /api/posts/:id returns 400 for invalid post ID", async () => {
    const response = await request(app)
      .delete("/api/posts/invalid-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it("DELETE /api/posts/:id returns 404 for non-existent post", async () => {
    const fakeId = "507f1f77bcf86cd799439011";

    const response = await request(app)
      .delete(`/api/posts/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });
});
