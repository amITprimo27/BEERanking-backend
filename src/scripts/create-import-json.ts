import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { IProfileScores } from "../models/beer.model";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_TASK_TYPE,
} from "../config/embedding.config";

type RawBeerRecord = {
  name: string;
  brewery: string;
  style: string;
  abv: number;
  profile_scores: IProfileScores;
};

type ProcessedBeerRecord = RawBeerRecord & {
  normalizedProfileScores: IProfileScores;
  originalProfileScores: IProfileScores;
  searchBlob: string;
};

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

const generateFlavorProse = (beer: RawBeerRecord): string => {
  const sortedTraits = [...REQUIRED_PROFILE_KEYS]
    .sort((a, b) => beer.profile_scores[b] - beer.profile_scores[a])
    .slice(0, 3)
    .map((t) => t.toLowerCase());

  return (
    `Beer: ${beer.name} | Brewery: ${beer.brewery} | Style: ${beer.style} | ABV: ${beer.abv}% | ` +
    `Notes: ${sortedTraits.join(", ")}. ` +
    `Profile: ${REQUIRED_PROFILE_KEYS.map((k) => `${k}: ${beer.profile_scores[k]}`).join(", ")}`
  );
};

const batchEmbedWithGemini = async (
  input: string[],
  apiKey: string,
): Promise<number[][]> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: input.map((text) => ({
          model: EMBEDDING_MODEL,
          taskType: EMBEDDING_TASK_TYPE,
          content: {
            parts: [{ text }],
          },
        })),
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini embedding request failed (${response.status}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    embeddings?: Array<{ values?: number[] }>;
  };

  const vectors = (payload.embeddings ?? []).map((entry) => entry.values ?? []);

  if (
    vectors.length !== input.length ||
    vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error(
      `Gemini embedding response mismatch. Expected ${input.length} vectors of ${EMBEDDING_DIMENSIONS} dimensions.`,
    );
  }

  return vectors;
};

const run = async () => {
  dotenv.config({ path: "./env/.env.dev" });
  const geminiApiKey = process.env.GEMINI_AI_API_KEY;

  if (!geminiApiKey) {
    throw new Error("Missing GEMINI_AI_API_KEY in env/.env.dev");
  }

  const inputPath = path.resolve(process.cwd(), "./data/raw_beers.json");
  const outputPath = path.resolve(
    process.cwd(),
    "./data/golden_beers_with_vectors.json",
  );

  const rawData = JSON.parse(
    await fs.readFile(inputPath, "utf-8"),
  ) as RawBeerRecord[];

  // 1. Normalize
  const maxValues = {} as Record<keyof IProfileScores, number>;
  REQUIRED_PROFILE_KEYS.forEach(
    (k) =>
      (maxValues[k] =
        Math.max(...rawData.map((b) => b.profile_scores[k])) || 1),
  );

  const processedWithoutVectors: ProcessedBeerRecord[] = rawData.map(
    (beer) => ({
      ...beer,
      normalizedProfileScores: REQUIRED_PROFILE_KEYS.reduce(
        (acc, k) => ({
          ...acc,
          [k]: (beer.profile_scores[k] / maxValues[k]) * 10,
        }),
        {} as IProfileScores,
      ),
      originalProfileScores: beer.profile_scores,
      searchBlob: generateFlavorProse(beer),
    }),
  );

  // 2. Embed (batch requests to stay under provider limits)
  const batchSize = 100;
  const embeddings: number[][] = [];
  console.log(`Embedding ${processedWithoutVectors.length} beers...`);

  for (let i = 0; i < processedWithoutVectors.length; i += batchSize) {
    const batch = processedWithoutVectors.slice(i, i + batchSize);
    const batchVectors = await batchEmbedWithGemini(
      batch.map((b) => b.searchBlob),
      geminiApiKey,
    );
    embeddings.push(...batchVectors);
    console.log(
      `Embedded ${Math.min(i + batchSize, processedWithoutVectors.length)}/${processedWithoutVectors.length}`,
    );
  }

  // 3. Save "Golden" File
  const finalData = processedWithoutVectors.map((beer, i: number) => ({
    ...beer,
    embedding: embeddings[i],
    embeddingModel: EMBEDDING_MODEL,
  }));

  await fs.writeFile(outputPath, JSON.stringify(finalData, null, 2));
  console.log(
    `Successfully created Golden File with vectors at: ${outputPath}`,
  );
};

run().catch(console.error);
