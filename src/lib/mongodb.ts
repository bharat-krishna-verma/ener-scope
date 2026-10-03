import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ener_scope";

let cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } =
  (global as any)._mongoose || { conn: null, promise: null };
if (!(global as any)._mongoose) (global as any)._mongoose = cached;

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 20 });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
