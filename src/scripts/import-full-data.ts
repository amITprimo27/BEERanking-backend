import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { Beer } from "../models/beer.model";

const run = async () => {
  // Pass env file as arg or default to .env.dev
  const envFile = process.argv[2] || "./env/.env.dev";
  dotenv.config({ path: envFile });

  const inputPath = path.resolve(
    process.cwd(),
    "./data/golden_beers_with_vectors.json",
  );
  if (!(await fs.stat(inputPath).catch(() => false))) {
    throw new Error("Golden file not found. Run the generator script first.");
  }

  const beers = JSON.parse(await fs.readFile(inputPath, "utf-8"));

  console.log(
    `Connecting to ${process.env.MONGODB_URI?.split("@")[1] || "DB"}...`,
  );
  await mongoose.connect(process.env.MONGODB_URI!);

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
  await mongoose.disconnect();
};

run().catch(console.error);
