import mongoose from "mongoose";
import { logger } from "./logger.js";

let conn: Promise<typeof mongoose> | null = null;

export async function connectMongo(uri: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!conn) {
    conn = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 5
      })
      .then((m) => {
        logger.info("mongodb_connected");
        return m;
      })
      .catch((e) => {
        conn = null;
        logger.error("mongodb_connect_failed", { err: String(e) });
        throw e;
      });
  }
  return conn;
}
