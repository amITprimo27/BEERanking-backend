import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { Beer } from "../models/beer.model";
import { EnvConfig } from "../config/env.config";

const PROJECT_ROOT = path.resolve(__dirname, "../../");
const DEFAULT_ENV_PATH = path.join(PROJECT_ROOT, "env", ".env.dev");
const INPUT_PATH = path.join(__dirname, "data", "beerDataWithEmbeddings.json");

const run = async () => {
  const inputPath = INPUT_PATH;
  if (!(await fs.stat(inputPath).catch(() => false))) {
    throw new Error("Golden file not found. Run the generator script first.");
  }

  const beers = JSON.parse(await fs.readFile(inputPath, "utf-8"));

  console.log(
    `Connecting to ${EnvConfig.instance.MONGODB_URI.split("@")[1] || "DB"}...`,
  );
  await mongoose.connect(EnvConfig.instance.MONGODB_URI);

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
