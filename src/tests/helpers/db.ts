import mongoose from "mongoose";

export const connectTestDb = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  }
};

export const clearTestDb = async () => {
  const collections = mongoose.connection.collections;
  const deleteOps = Object.values(collections).map((collection) =>
    collection.deleteMany({}),
  );

  await Promise.all(deleteOps);
};

export const disconnectTestDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};
