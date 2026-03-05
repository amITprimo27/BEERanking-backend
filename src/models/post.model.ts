import mongoose, { Document, Schema } from "mongoose";

export interface IPost extends Document {
  image: string;
  rating: number;
  beer: mongoose.Types.ObjectId; // Reference to Beer document
  description: string;
  user: mongoose.Types.ObjectId; // Reference to User document
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    image: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    beer: {
      type: Schema.Types.ObjectId,
      ref: "Beer",
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
postSchema.index({ user: 1 });
postSchema.index({ beer: 1 });
postSchema.index({ createdAt: -1 });

export const Post = mongoose.model<IPost>("Post", postSchema);
