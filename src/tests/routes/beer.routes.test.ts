import express from "express";
import request from "supertest";
import { beerRouter } from "../../routes/beer.route";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { Beer } from "../../models/beer.model";

describe("Beer routes integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/beers", beerRouter);

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("GET /api/beers/search/ai should call aiSearch", async () => {
    await Beer.create({
      name: "Search Beer",
      brewery: "Search Brewery",
      style: "IPA",
      abv: 6,
      description: "Hoppy beer",
      searchBlob: "hoppy citrus ipa",
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

    const response = await request(app).get("/api/beers/search/ai?q=hoppy");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });
});
