import mongoose from "mongoose";
import dotenv from "dotenv";
import { Beer } from "../models/beer.model";
import { AI_CONFIG } from "../config/ai.config";

const INDEX_DEFINITION = {
  name: AI_CONFIG.DB.VECTOR_INDEX_NAME,
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: AI_CONFIG.COHERE.DIMENSIONS,
        similarity: "cosine",
      },
      {
        type: "filter",
        path: "style",
      },
      {
        type: "filter",
        path: "abv",
      },
    ],
  },
};

// Used on app startup — skips silently if index already exists.
export const ensureVectorIndex = async () => {
  try {
    const collection = Beer.collection;
    const existingIndexes = await collection.listSearchIndexes().toArray();
    if (
      existingIndexes.find((idx) => idx.name === AI_CONFIG.DB.VECTOR_INDEX_NAME)
    ) {
      console.log("Vector index already exists.");
      return;
    }
    await collection.createSearchIndex(INDEX_DEFINITION);
    console.log("Vector index creation initiated...");
  } catch (err) {
    console.error("Error creating vector index:", err);
  }
};

// Used from CLI — drops existing index so it can be recreated by ensureVectorIndex.
const dropVectorIndex = async () => {
  const collection = Beer.collection;
  const existingIndexes = await collection.listSearchIndexes().toArray();
  const existing = existingIndexes.find(
    (idx) => idx.name === AI_CONFIG.DB.VECTOR_INDEX_NAME,
  );

  if (existing) {
    console.log(
      `Dropping existing "${AI_CONFIG.DB.VECTOR_INDEX_NAME}" index...`,
    );
    await collection.dropSearchIndex(AI_CONFIG.DB.VECTOR_INDEX_NAME);

    // Atlas needs a moment before the index can be recreated
    console.log("Waiting for index to finish dropping...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } else {
    console.log(
      `No existing "${AI_CONFIG.DB.VECTOR_INDEX_NAME}" found, nothing to drop.`,
    );
  }
};

// Run directly:
//   ts-node ./src/scripts/vector-index.ts            → connect → ensureVectorIndex() → disconnect
//   ts-node ./src/scripts/vector-index.ts --recreate → connect → drop → ensureVectorIndex() → disconnect
if (require.main === module) {
  dotenv.config({ path: "./env/.env.dev" });

  const shouldRecreate = process.argv.includes("--recreate");

  const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
    try {
      if (shouldRecreate) {
        await dropVectorIndex();
      }
      await ensureVectorIndex();
    } finally {
      await mongoose.disconnect();
    }
  };

  main().catch((err) => {
    console.error("Vector index operation failed:", err);
    process.exit(1);
  });
}
