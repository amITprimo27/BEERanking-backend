import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { Beer } from "../models/beer.model";

const PROJECT_ROOT = path.resolve(__dirname, "../../");
const DEFAULT_ENV_PATH = path.join(PROJECT_ROOT, "env", ".env.dev");
const INPUT_PATH = path.join(
  __dirname,
  "data",
  "beerDataWithEmbeddings.json",
);

const run = async () => {
  // Pass env file as arg or default to env/.env.dev at project root
  const envArg = process.argv[2];
  const envFile = envArg
    ? path.isAbsolute(envArg)
      ? envArg
      : path.resolve(PROJECT_ROOT, envArg)
    : DEFAULT_ENV_PATH;
  dotenv.config({ path: envFile });

  const inputPath = INPUT_PATH;
  if (!(await fs.stat(inputPath).catch(() => false))) {
    throw new Error("Golden file not found. Run the generator script first.");
  }

  const beers = JSON.parse(await fs.readFile(inputPath, "utf-8"));

  console.log(
    `Connecting to ${process.env.MONGODB_URI?.split("@")[1] || "DB"}...`,
  );
  await mongoose.connect(process.env.MONGODB_URI!);

  try {
    const ops = beers.map((beer: any) => ({
      updateOne: {
        filter: { name: beer.name, brewery: beer.brewery },
        update: { $set: beer },
        upsert: true,
      },
    }));

    console.log(`Syncing ${beers.length} beers to database...`);
    const result = await Beer.bulkWrite(ops);

    console.log(
      `Sync Complete: ${result.upsertedCount} new, ${result.modifiedCount} updated.`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(console.error);
