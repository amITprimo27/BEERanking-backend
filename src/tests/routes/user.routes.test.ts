import express from "express";
import request from "supertest";
import { userRouter } from "../../routes/user.route";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { User } from "../../models/user.model";
import { Beer } from "../../models/beer.model";
import { AuthUtils } from "../../utils/auth.utils";
import * as fs from "fs";
import * as path from "path";

describe("User routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRouter);

  let token = "";
  let userId = "";
  let beerId = "";
  const uploadDir = path.join(__dirname, "../../../public/uploads");
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
      username: "user-route",
      email: "user-route@test.com",
      password: "secret",
    });

    const beer = await Beer.create({
      name: "Test Beer",
      brewery: "Test Brewery",
      style: "IPA",
      abv: 6.5,
      description: "A test beer for favorites",
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
    token = AuthUtils.generateAccessToken({ userId });
  });

  describe("GET /api/users/:id", () => {
    it("returns user from DB by ID", async () => {
      const response = await request(app).get(`/api/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(userId);
      expect(response.body.username).toBe("user-route");
      expect(response.body.email).toBe("user-route@test.com");
      expect(response.body.password).toBeUndefined(); // Password should not be returned
    });

    it("returns 400 for invalid user ID format", async () => {
      const response = await request(app).get("/api/users/invalid-id");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid ID format");
    });

    it("returns 404 for non-existent user ID", async () => {
      const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId but doesn't exist

      const response = await request(app).get(`/api/users/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Data not found");
    });

    it("returns user with favorite beers populated", async () => {
      await User.findByIdAndUpdate(userId, {
        $push: { favoriteBeers: beerId },
      });

      const response = await request(app).get(`/api/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.favoriteBeers).toBeDefined();
      expect(Array.isArray(response.body.favoriteBeers)).toBe(true);
    });
  });

  describe("PATCH /api/users/me", () => {
    it("requires authentication", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .send({ username: "new-name" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("updates username only", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "updated-username" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");
    });

    it("updates email only", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "newemail@test.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");
    });

    it("updates multiple fields at once", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "multi-update",
          email: "multi@test.com",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");
    });

    it("updates favorite beers array", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          favoriteBeers: [beerId],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");
    });

    it("uploads profile picture with multipart/form-data", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .attach("profilePic", Buffer.from("profile image data"), "profile.jpg");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");

      // Verify the user has a profile picture path in DB
      const updatedUser = await User.findById(userId);
      expect(updatedUser?.profilePic).toBeDefined();
      expect(updatedUser?.profilePic).toContain("uploads/");

      // Verify the file exists in public/uploads
      const imagePath = path.join(
        __dirname,
        "../../../public",
        updatedUser!.profilePic!,
      );
      expect(fs.existsSync(imagePath)).toBe(true);
      uploadedFiles.push(imagePath); // Track for cleanup
    });

    it("updates both fields and uploads profile picture", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .field("username", "new-name")
        .field("email", "new-email@test.com")
        .attach("profilePic", Buffer.from("profile image data"), "profile.jpg");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");

      // Verify the user has updated fields AND profile picture
      const updatedUser = await User.findById(userId);
      expect(updatedUser?.profilePic).toBeDefined();
      expect(updatedUser?.profilePic).toContain("uploads/");

      // Verify the file exists in public/uploads
      const imagePath = path.join(
        __dirname,
        "../../../public",
        updatedUser!.profilePic!,
      );
      expect(fs.existsSync(imagePath)).toBe(true);
      uploadedFiles.push(imagePath); // Track for cleanup
    });

    it("clears favorite beers with empty array", async () => {
      await User.findByIdAndUpdate(userId, {
        $push: { favoriteBeers: beerId },
      });

      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ favoriteBeers: [] });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("User updated");
    });

    it("does not include password in PATCH response", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "updated-name" });

      expect(response.status).toBe(200);
      expect(response.body.password).toBeUndefined();
    });

    it("prevents email change", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "newemail@test.com" });

      expect(response.status).toBe(200);

      const user = await User.findById(userId);

      expect(user?.email).toBe("user-route@test.com"); // Email should not change
    });

    it("returns 409 for duplicate username", async () => {
      // Create another user with different username
      const otherUser = await User.create({
        username: "other-user",
        email: "other@test.com",
        password: "secret",
      });

      // Try to update current user with other user's username
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "other-user" });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();

      // Verify username unchanged
      const user = await User.findById(userId);
      expect(user?.username).toBe("user-route");
    });
  });
});
