import mongoose, { Document, Schema } from "mongoose";

export interface IPost extends Document {
  image: string;
  rating: number;
  beer: mongoose.Types.ObjectId; // Reference to Beer document
  description: string;
  user: mongoose.Types.ObjectId; // Reference to User document
  likes: mongoose.Types.ObjectId[]; // Array of user IDs who liked this post
  likesCount: number; // Persisted likes counter
  createdAt: Date;
  updatedAt: Date;
  likeCount: number; // Virtual field
  commentCount: number; // Virtual field
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
    likes: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
      select: false,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Virtual field for like count
postSchema.virtual("likeCount").get(function () {
  if (Array.isArray(this.likes)) {
    return this.likes.length;
  }

  return typeof this.likesCount === "number" ? this.likesCount : 0;
});

// Virtual populate for comment count
postSchema.virtual("commentCount", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  count: true,
});

// Ensure virtuals are included in JSON/Object output
postSchema.set("toJSON", { virtuals: true });
postSchema.set("toObject", { virtuals: true });

// Indexes for faster queries
postSchema.index({ user: 1 });
postSchema.index({ beer: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likes: 1 });
export const Post = mongoose.model<IPost>("Post", postSchema);
