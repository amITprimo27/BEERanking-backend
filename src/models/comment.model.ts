import { Schema, model, Document, Types } from "mongoose";

export interface IComment extends Document {
  text: string;
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    text: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 5000,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ user: 1 });

// Configure virtuals in toJSON
commentSchema.set("toJSON", { virtuals: true });
commentSchema.set("toObject", { virtuals: true });

export const Comment = model<IComment>("Comment", commentSchema);
