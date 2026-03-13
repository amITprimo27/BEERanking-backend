import express from "express";
import request from "supertest";
import { beerRouter } from "../../routes/beer.route";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { Beer } from "../../models/beer.model";
import { EMBEDDING_DIMENSIONS } from "../../config/embedding.config";

describe("Beer routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/beers", beerRouter);

  const embeddingVector = Array.from(
    { length: EMBEDDING_DIMENSIONS },
    () => 0.001,
  );

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("GET /api/beers/search should return fuzzy lexical results", async () => {
    await Beer.create({
      name: "Search Beer",
      brewery: "Search Brewery",
      style: "IPA",
      abv: 6,
      description: "Hoppy beer",
      searchBlob: "hoppy citrus ipa",
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
      embedding: embeddingVector,
    });

    const response = await request(app).get("/api/beers/search?q=search");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].name).toBe("Search Beer");
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(10);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.pagination.pages).toBe(1);
  });

  it("GET /api/beers/search should support page and limit", async () => {
    await Beer.create({
      name: "Search Beer A",
      brewery: "Search Brewery",
      style: "IPA",
      abv: 6,
      description: "Hoppy beer",
      searchBlob: "hoppy citrus ipa",
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
      embedding: embeddingVector,
    });

    await Beer.create({
      name: "Search Beer B",
      brewery: "Search Brewery",
      style: "IPA",
      abv: 6,
      description: "Hoppy beer",
      searchBlob: "hoppy citrus ipa",
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
      embedding: embeddingVector,
    });

    const response = await request(app).get(
      "/api/beers/search?q=search&page=2&limit=1",
    );

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].name).toBe("Search Beer B");
    expect(response.body.pagination.page).toBe(2);
    expect(response.body.pagination.limit).toBe(1);
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.pagination.pages).toBe(2);
  });

  it("GET /api/beers/search should validate q", async () => {
    const response = await request(app).get("/api/beers/search?q=a");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("at least 2 characters");
  });

  it("GET /api/beers/search/ai should not exist", async () => {
    const response = await request(app).get("/api/beers/search/ai?q=hoppy");

    expect(response.status).toBe(404);
  });

  it("POST /api/beers/ask should return stub response", async () => {
    const response = await request(app)
      .post("/api/beers/ask")
      .send({ question: "What beer is best for summer?" });

    expect(response.status).toBe(501);
    expect(response.body.error).toContain("not implemented yet");
  });
});
