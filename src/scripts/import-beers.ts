import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Beer, IProfileScores } from "../models/beer.model";

interface BeerJsonRecord {
  name: string;
  brewery: string;
  style: string;
  abv: number;
  description: string;
  profile_scores: IProfileScores;
  search_blob: string;
}

const REQUIRED_PROFILE_KEYS: Array<keyof IProfileScores> = [
  "Astringency",
  "Body",
  "Alcohol",
  "Bitter",
  "Sweet",
  "Sour",
  "Salty",
  "Fruits",
  "Hoppy",
  "Spices",
  "Malty",
];

const isValidProfileScores = (scores: unknown): scores is IProfileScores => {
  if (!scores || typeof scores !== "object") {
    return false;
  }

  const typedScores = scores as Record<string, unknown>;
  // Profile scores are word counts from reviews, can range from 0-250+
  return REQUIRED_PROFILE_KEYS.every(
    (key) => typeof typedScores[key] === "number" && typedScores[key] >= 0,
  );
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const filePath = args.find((arg) => !arg.startsWith("--"));
  const replace = args.includes("--replace");

  return { filePath, replace };
};

const buildAbsolutePath = (filePath: string) => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(process.cwd(), filePath);
};

const run = async () => {
  dotenv.config({ path: "./env/.env.dev" });

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined. Set it in env/.env.dev.");
  }

  const { filePath, replace } = parseArgs();
  if (!filePath) {
    throw new Error(
      "Missing JSON path. Usage: npm run import:beers -- <path-to-json> [--replace]",
    );
  }

  const absolutePath = buildAbsolutePath(filePath);
  const rawJson = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(rawJson) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("JSON file must contain an array of beers.");
  }

  const normalized = parsed
    .map((item): BeerJsonRecord | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;

      const candidate: BeerJsonRecord = {
        name: String(record.name ?? "").trim(),
        brewery: String(record.brewery ?? "").trim(),
        style: String(record.style ?? "").trim(),
        abv: Number(record.abv),
        description: String(record.description ?? "").trim(),
        profile_scores: record.profile_scores as IProfileScores,
        search_blob: String(record.search_blob ?? "").trim(),
      };

      if (
        !candidate.name ||
        !candidate.brewery ||
        !candidate.style ||
        Number.isNaN(candidate.abv) ||
        !candidate.description ||
        !candidate.search_blob ||
        !isValidProfileScores(candidate.profile_scores)
      ) {
        return null;
      }

      return candidate;
    })
    .filter((item): item is BeerJsonRecord => item !== null);

  if (normalized.length === 0) {
    throw new Error("No valid beer records found in JSON file.");
  }

  await mongoose.connect(mongoUri);

  try {
    if (replace) {
      await Beer.deleteMany({});
    }

    const operations = normalized.map((beer) => ({
      updateOne: {
        filter: { name: beer.name, brewery: beer.brewery },
        update: {
          $set: {
            name: beer.name,
            brewery: beer.brewery,
            style: beer.style,
            abv: beer.abv,
            description: beer.description,
            profileScores: beer.profile_scores,
            searchBlob: beer.search_blob,
          },
        },
        upsert: true,
      },
    }));

    const result = await Beer.bulkWrite(operations, { ordered: false });

    console.log(`Imported ${normalized.length} beers from ${absolutePath}`);
    console.log(
      `Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`,
    );
    if (normalized.length !== parsed.length) {
      console.log(
        `Skipped invalid records: ${parsed.length - normalized.length}`,
      );
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error: unknown) => {
  console.error("Beer import failed:", error);
  process.exit(1);
});
