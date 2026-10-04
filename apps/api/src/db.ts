import mongoose from "mongoose";
import { env } from "./config.js";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  console.log("MongoDB conectado");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

