import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { IProfileScores } from "../models/beer.model";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_TASK_TYPE,
} from "../config/embedding.config";

const PROJECT_ROOT = path.resolve(__dirname, "../../");
const DEFAULT_ENV_PATH = path.join(PROJECT_ROOT, "env", ".env.dev");
const INPUT_PATH = path.join(__dirname, "data", "beerData.json");
const OUTPUT_PATH = path.join(__dirname, "data", "beerDataWithEmbeddings.json");

const BATCH_SIZE = 100;
const TPM_LIMIT = 28_000;

type RawBeerInput = {
  name: string;
  brewery: string;
  style: string;
  abv: number;
  description: string;
  profile_scores: IProfileScores;
  search_blob: string; // From your example input
};

const REQUIRED_KEYS: Array<keyof IProfileScores> = [
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

const processBeerRecord = (beer: RawBeerInput) => {
  // Custom confidence thresholds per category
  const categoryConfig = {
    Mouthfeel: { keys: ["Astringency", "Body", "Alcohol"], K: 15 },
    Taste: { keys: ["Bitter", "Sweet", "Sour", "Salty"], K: 35 },
    FlavorAndAroma: { keys: ["Fruits", "Hoppy", "Spices", "Malty"], K: 30 },
  };

  const normalizedProfileScores = {} as IProfileScores;
  const categoryStrings: string[] = [];

  for (const [categoryName, config] of Object.entries(categoryConfig)) {
    const clusterNotes: string[] = [];

    config.keys.forEach((k) => {
      const rawValue = beer.profile_scores[k as keyof IProfileScores] || 0;

      // Use the category-specific K
      const score = (rawValue / (rawValue + config.K)) * 10;
      normalizedProfileScores[k as keyof IProfileScores] = Number(
        score.toFixed(2),
      );

      if (score > 1.5) {
        clusterNotes.push(`${k}: ${score.toFixed(1)}/10`);
      }
    });

    if (clusterNotes.length > 0) {
      categoryStrings.push(
        `${categoryName} attributes: ${clusterNotes.join(", ")}`,
      );
    }
  }

  const searchBlob = [
    `Beer: ${beer.name}`,
    `Brewery: ${beer.brewery}`,
    `Style: ${beer.style}`,
    `Description: ${beer.description}`,
    ...categoryStrings,
  ].join(" | ");

  return {
    ...beer,
    normalizedProfileScores,
    originalProfileScores: beer.profile_scores,
    searchBlob,
  };
};

const estimateTokens = (texts: string[]) =>
  texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);

const run = async () => {
  dotenv.config({ path: DEFAULT_ENV_PATH });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_AI_API_KEY! });

  const rawData = JSON.parse(
    await fs.readFile(INPUT_PATH, "utf-8"),
  ) as RawBeerInput[];
  console.log(`🍺 Processing ${rawData.length} records...`);

  const processedData = rawData.map(processBeerRecord);
  const totalBatches = Math.ceil(processedData.length / BATCH_SIZE);
  const allEmbeddings: number[][] = [];

  let tokensInMinute = 0;
  let startTime = Date.now();

  for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
    const chunk = processedData.slice(i, i + BATCH_SIZE);
    const texts = chunk.map((b) => b.searchBlob);
    const batchTokens = estimateTokens(texts);

    if (tokensInMinute + batchTokens > TPM_LIMIT) {
      const wait = Math.max(0, 60000 - (Date.now() - startTime));
      console.log(`⏳ TPM Limit. Waiting ${Math.ceil(wait / 1000)}s...`);
      await new Promise((r) => setTimeout(r, wait));
      tokensInMinute = 0;
      startTime = Date.now();
    }

    console.log(`📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}`);

    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: {
          taskType: EMBEDDING_TASK_TYPE,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      });

      if (response.embeddings) {
        response.embeddings.forEach((emb) => {
          if (emb.values) allEmbeddings.push(emb.values);
        });
      }

      tokensInMinute += batchTokens;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error("❌ API Error:", err);
      break;
    }
  }

  const finalOutput = processedData.map((record, i) => ({
    ...record,
    embedding: allEmbeddings[i],
  }));

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalOutput, null, 2));
  console.log(`\n✅ Successfully generated ${finalOutput.length} records.`);
};

run().catch(console.error);
