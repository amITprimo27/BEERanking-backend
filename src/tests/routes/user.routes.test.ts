import express from "express";
import request from "supertest";
import { userRouter } from "../../routes/user.route";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { MAX_FAVORITE_BEERS, User } from "../../models/user.model";
import { Beer } from "../../models/beer.model";
import { AuthUtils } from "../../utils/auth.utils";
import { UPLOADS_DIR, toPublicAbsolutePath } from "../../utils/paths.utils";
import * as fs from "fs";

describe("User routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRouter);

  let token = "";
  let userId = "";
  let beerId = "";
  const uploadDir = UPLOADS_DIR;
  const uploadedFiles: string[] = [];

  const getUploadedFileAbsolutePath = (profilePicPath: string) =>
    toPublicAbsolutePath(profilePicPath);

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
    token = AuthUtils.generateAccessToken({ userId });
  });

  describe("GET /api/users/me", () => {
    it("returns current authenticated user", async () => {
      const response = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(userId);
      expect(response.body.username).toBe("user-route");
      expect(response.body.email).toBe("user-route@test.com");
      expect(response.body.password).toBeUndefined(); // Password should not be returned
    });

    it("returns 401 without authentication token", async () => {
      const response = await request(app).get("/api/users/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("returns user with favorite beers populated", async () => {
      await User.findByIdAndUpdate(userId, {
        $push: { favoriteBeers: beerId },
      });

      const response = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${token}`);

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

    it("returns 400 when no fields are provided", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("No fields to update provided");
    });

    it("updates username only", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "updated-username" });

      expect(response.status).toBe(200);

      const updatedUser = await User.findById(userId);
      expect(updatedUser?.username).toBe("updated-username");
    });

    it("returns 400 for username shorter than 3 characters", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "ab" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        "Username must be at least 3 characters",
      );

      const unchangedUser = await User.findById(userId);
      expect(unchangedUser?.username).toBe("user-route");
    });

    it("prevents email change", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "newemail@test.com" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();

      const user = await User.findById(userId);
      expect(user?.email).toBe("user-route@test.com");
    });

    it("updates multiple fields at once", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "multi-update",
          favoriteBeers: [beerId],
        });

      expect(response.status).toBe(200);
    });

    it("updates favorite beers array", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          favoriteBeers: [beerId],
        });

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body.user.favoriteBeers)).toBe(true);
      expect(response.body.user.favoriteBeers[0]).toBeDefined();
      expect(response.body.user.favoriteBeers[0]._id.toString()).toBe(beerId);

      const userWithFavorites =
        await User.findById(userId).populate("favoriteBeers");
      expect(userWithFavorites?.favoriteBeers).toHaveLength(1);
    });

    it("updates favorite beers array up to the maximum allowed", async () => {
      const beers = await Beer.create([
        {
          name: "Favorite Beer 1",
          brewery: "Test Brewery",
          style: "IPA",
          abv: 6.1,
          description: "Favorite beer 1",
          searchBlob: "favorite beer 1",
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
        },
        {
          name: "Favorite Beer 2",
          brewery: "Test Brewery",
          style: "Stout",
          abv: 7.2,
          description: "Favorite beer 2",
          searchBlob: "favorite beer 2",
          normalizedProfileScores: {
            Astringency: 2,
            Body: 3,
            Alcohol: 4,
            Bitter: 5,
            Sweet: 2,
            Sour: 1,
            Salty: 0,
            Fruits: 1,
            Hoppy: 4,
            Spices: 2,
            Malty: 3,
          },
          originalProfileScores: {
            Astringency: 20,
            Body: 30,
            Alcohol: 40,
            Bitter: 50,
            Sweet: 20,
            Sour: 10,
            Salty: 0,
            Fruits: 10,
            Hoppy: 40,
            Spices: 20,
            Malty: 30,
          },
        },
      ]);

      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          favoriteBeers: [beerId, ...beers.map((beer) => beer._id.toString())],
        });

      expect(response.status).toBe(200);
      expect(response.body.user.favoriteBeers).toHaveLength(MAX_FAVORITE_BEERS);
    });

    it("returns 400 when favoriteBeers exceeds the maximum allowed", async () => {
      const beers = await Beer.create([
        {
          name: "Favorite Beer 1",
          brewery: "Test Brewery",
          style: "IPA",
          abv: 6.1,
          description: "Favorite beer 1",
          searchBlob: "favorite beer 1",
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
        },
        {
          name: "Favorite Beer 2",
          brewery: "Test Brewery",
          style: "Stout",
          abv: 7.2,
          description: "Favorite beer 2",
          searchBlob: "favorite beer 2",
          normalizedProfileScores: {
            Astringency: 2,
            Body: 3,
            Alcohol: 4,
            Bitter: 5,
            Sweet: 2,
            Sour: 1,
            Salty: 0,
            Fruits: 1,
            Hoppy: 4,
            Spices: 2,
            Malty: 3,
          },
          originalProfileScores: {
            Astringency: 20,
            Body: 30,
            Alcohol: 40,
            Bitter: 50,
            Sweet: 20,
            Sour: 10,
            Salty: 0,
            Fruits: 10,
            Hoppy: 40,
            Spices: 20,
            Malty: 30,
          },
        },
        {
          name: "Favorite Beer 3",
          brewery: "Test Brewery",
          style: "Lager",
          abv: 5.4,
          description: "Favorite beer 3",
          searchBlob: "favorite beer 3",
          normalizedProfileScores: {
            Astringency: 1,
            Body: 2,
            Alcohol: 2,
            Bitter: 2,
            Sweet: 2,
            Sour: 1,
            Salty: 0,
            Fruits: 1,
            Hoppy: 2,
            Spices: 1,
            Malty: 2,
          },
          originalProfileScores: {
            Astringency: 10,
            Body: 20,
            Alcohol: 20,
            Bitter: 20,
            Sweet: 20,
            Sour: 10,
            Salty: 0,
            Fruits: 10,
            Hoppy: 20,
            Spices: 10,
            Malty: 20,
          },
        },
      ]);

      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          favoriteBeers: [beerId, ...beers.map((beer) => beer._id.toString())],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        `favoriteBeers can contain at most ${MAX_FAVORITE_BEERS} beers`,
      );

      const unchangedUser = await User.findById(userId);
      expect(unchangedUser?.favoriteBeers).toHaveLength(0);
    });

    it("returns 400 when favoriteBeers is not an array", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          favoriteBeers: "not-an-array",
        });

      expect(response.status).toBe(400);
    });

    it("returns 400 when favoriteBeers contains invalid ObjectId", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          favoriteBeers: ["invalid-object-id"],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("uploads profile picture with multipart/form-data", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .attach("profilePic", Buffer.from("profile image data"), "profile.jpg");

      expect(response.status).toBe(200);

      // Verify the user has a profile picture path in DB
      const updatedUser = await User.findById(userId);
      expect(updatedUser?.profilePic).toBeDefined();
      expect(updatedUser?.profilePic).toContain("uploads/");

      // Verify the file exists in public/uploads
      const imagePath = getUploadedFileAbsolutePath(updatedUser!.profilePic!);
      expect(fs.existsSync(imagePath)).toBe(true);
      uploadedFiles.push(imagePath); // Track for cleanup
    });

    it("updates both fields and uploads profile picture", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .field("username", "new-name")
        .attach("profilePic", Buffer.from("profile image data"), "profile.jpg");

      expect(response.status).toBe(200);

      // Verify the user has updated fields AND profile picture
      const updatedUser = await User.findById(userId);
      expect(updatedUser?.profilePic).toBeDefined();
      expect(updatedUser?.profilePic).toContain("uploads/");

      // Verify the file exists in public/uploads
      const imagePath = getUploadedFileAbsolutePath(updatedUser!.profilePic!);
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
    });

    it("does not include password in PATCH response", async () => {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "updated-name" });

      expect(response.status).toBe(200);
      expect(response.body.password).toBeUndefined();
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

    describe("file cleanup", () => {
      it("deletes uploaded file when request fails validation", async () => {
        const filesBefore = fs.readdirSync(uploadDir).sort();

        const response = await request(app)
          .patch("/api/users/me")
          .set("Authorization", `Bearer ${token}`)
          .field("username", "ab")
          .attach("profilePic", Buffer.from("profile image data"), "bad.jpg");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(
          "Username must be at least 3 characters",
        );

        const filesAfter = fs.readdirSync(uploadDir).sort();
        expect(filesAfter).toEqual(filesBefore);
      });

      it("deletes uploaded file when request fails with 409", async () => {
        await User.create({
          username: "taken-user",
          email: "taken@test.com",
          password: "secret",
        });

        const filesBefore = fs.readdirSync(uploadDir).sort();

        const response = await request(app)
          .patch("/api/users/me")
          .set("Authorization", `Bearer ${token}`)
          .field("username", "taken-user")
          .attach("profilePic", Buffer.from("profile image data"), "dup.jpg");

        expect(response.status).toBe(409);

        const filesAfter = fs.readdirSync(uploadDir).sort();
        expect(filesAfter).toEqual(filesBefore);
      });

      it("deletes old profile picture when replacing it", async () => {
        const firstUpload = await request(app)
          .patch("/api/users/me")
          .set("Authorization", `Bearer ${token}`)
          .attach("profilePic", Buffer.from("first image"), "first.jpg");

        expect(firstUpload.status).toBe(200);

        const userAfterFirst = await User.findById(userId);
        const firstImagePath = getUploadedFileAbsolutePath(
          userAfterFirst!.profilePic!,
        );
        expect(fs.existsSync(firstImagePath)).toBe(true);

        const secondUpload = await request(app)
          .patch("/api/users/me")
          .set("Authorization", `Bearer ${token}`)
          .attach("profilePic", Buffer.from("second image"), "second.jpg");

        expect(secondUpload.status).toBe(200);

        const userAfterSecond = await User.findById(userId);
        const secondImagePath = getUploadedFileAbsolutePath(
          userAfterSecond!.profilePic!,
        );

        expect(fs.existsSync(firstImagePath)).toBe(false);
        expect(fs.existsSync(secondImagePath)).toBe(true);

        uploadedFiles.push(secondImagePath);
      });
    });
  });
});
