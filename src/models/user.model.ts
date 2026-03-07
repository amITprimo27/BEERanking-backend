import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string; // Optional for Google auth users
  profilePic?: string;
  favoriteBeers: mongoose.Types.ObjectId[]; // References to Beer documents
  googleId?: string; // For Google OAuth
  refreshTokens: string[]; // Store refresh tokens for rotation/revocation
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Not required for Google auth users
      select: false, // Don't include password in queries by default
    },
    profilePic: {
      type: String,
      default: null,
    },
    favoriteBeers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Beer",
      },
    ],
    googleId: {
      type: String,
      unique: true,
      select: false,
      sparse: true, // Allows multiple null values
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster lookups
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ username: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
