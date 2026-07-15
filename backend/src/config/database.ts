import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Failed to connect to MongoDB");
    throw new Error("Failed to connect to MongoDB");
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB successfully");
  } catch (error) {
    console.error("Failed to disconnect from MongoDB cleanly");
    throw new Error("Failed to disconnect from MongoDB cleanly");
  }
}
