import mongoose, { Document, Schema } from "mongoose";

export interface IProfileScores {
  Astringency: number;
  Body: number;
  Alcohol: number;
  Bitter: number;
  Sweet: number;
  Sour: number;
  Salty: number;
  Fruits: number;
  Hoppy: number;
  Spices: number;
  Malty: number;
}

export interface IBeer extends Document {
  name: string;
  brewery: string;
  style: string;
  abv: number;
  description: string;
  profileScores: IProfileScores;
  searchBlob: string;
  createdAt: Date;
  updatedAt: Date;
}

const profileScoresSchema = new Schema<IProfileScores>(
  {
    Astringency: { type: Number, required: true, min: 0 },
    Body: { type: Number, required: true, min: 0 },
    Alcohol: { type: Number, required: true, min: 0 },
    Bitter: { type: Number, required: true, min: 0 },
    Sweet: { type: Number, required: true, min: 0 },
    Sour: { type: Number, required: true, min: 0 },
    Salty: { type: Number, required: true, min: 0 },
    Fruits: { type: Number, required: true, min: 0 },
    Hoppy: { type: Number, required: true, min: 0 },
    Spices: { type: Number, required: true, min: 0 },
    Malty: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const beerSchema = new Schema<IBeer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brewery: {
      type: String,
      required: true,
      trim: true,
    },
    style: {
      type: String,
      required: true,
      trim: true,
    },
    abv: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      required: true,
    },
    profileScores: {
      select: false,
      type: profileScoresSchema,
      required: true,
    },
    searchBlob: {
      select: false,
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for search and filtering
beerSchema.index({ name: 1 });
beerSchema.index({ brewery: 1 });
beerSchema.index({ style: 1 });
beerSchema.index({ searchBlob: "text" }); // Full-text search index

export const Beer = mongoose.model<IBeer>("Beer", beerSchema);
